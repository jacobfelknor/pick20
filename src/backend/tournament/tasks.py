from django.db.models import Case, F, IntegerField, Max, Sum, When, Window
from django.db.models.functions import Coalesce, Rank
from django.utils import timezone

from .models import SEED_POINT_BANDS, Entry, Tournament, TournamentTeam


def calculate_optimistic_gain(picks, current_round, total_tournament_wins):
    """
    Calculates the maximum possible points (optimistic potential gain) a list of picks can earn
    for the rest of the tournament. It does this by using a greedy strategy that allocates
    remaining available tournament wins per round to the highest-scoring teams first.

    To enforce physical tournament rules in a simulated manner:
    1. A team can only win a game in round `r` if they have successfully "won" `r - 1` games previously.
    2. The number of wins assigned in any round cannot exceed the remaining available win slots in that round.
    """
    # Step 1: Only consider active picks (teams that are not yet eliminated)
    eligible_teams = list(filter(lambda x: not x.is_eliminated, picks))

    # Step 2: Track hypothetical wins for each team during the greedy simulation.
    # We initialize this mapping with the actual wins each active team currently has.
    hypothetical_wins = {team.id: team.wins for team in eligible_teams}

    total_potential_gain = 0

    # Step 3: Chronologically simulate every round from the current round up to the championship (MAX_WINS = 6).
    for r in range(current_round, TournamentTeam.MAX_WINS + 1):
        # Determine the number of global win slots remaining/unplayed in this specific round.
        if r == current_round:
            # First round of simulation needs special handling because it might be partially completed.
            # Calculate the total wins that should have occurred in all prior rounds combined.
            # e.g., Before Round 2, Round 1 must have exactly 32 wins.
            total_wins_prior_to_this_round = sum(2 ** (TournamentTeam.MAX_WINS - i) for i in range(1, r))

            # Determine how many wins in the current round have already finished and been recorded globally.
            wins_already_finished_in_round = max(total_tournament_wins - total_wins_prior_to_this_round, 0)

            # A full round 'r' has 2^(MAX_WINS - r) total games/wins (e.g., Round 1 = 32, Round 2 = 16, etc.)
            wins_to_complete_this_round = 2 ** (TournamentTeam.MAX_WINS - r)

            # The remaining win slots to allocate in the current round is the difference.
            wins_remaining_in_this_round = max(wins_to_complete_this_round - wins_already_finished_in_round, 0)
        else:
            # Future rounds are completely unplayed, so all 2^(MAX_WINS - r) slots are available.
            wins_remaining_in_this_round = 2 ** (TournamentTeam.MAX_WINS - r)

        # Step 4: Identify teams that are active and are eligible to win in this round.
        # To win in round `r`, a team must have exactly `r - 1` wins (meaning they won their previous round's game).
        round_eligible_teams = [team for team in eligible_teams if hypothetical_wins[team.id] == r - 1]

        # Step 5: Prioritize highest-value teams first.
        # We sort eligible teams descending by their point yield per win (based on their seed).
        round_eligible_teams.sort(key=lambda x: x.points_per_win, reverse=True)

        # Step 6: Greedily assign wins up to the remaining slot capacity in this round.
        wins_awarded = 0
        for team in round_eligible_teams:
            if wins_awarded < wins_remaining_in_this_round:
                # Award the win: add points to the running potential gain,
                # and increment their hypothetical wins so they become eligible for the next round.
                total_potential_gain += team.points_per_win
                hypothetical_wins[team.id] = r
                wins_awarded += 1
            else:
                # No more available win slots in this round, move to the next round.
                break

    return total_potential_gain


def update_tournament_scores(tournament: Tournament | int, set_standings_last_updated: bool = False):
    """
    Recalculates and bulk-saves current scores, potential scores, ranks,
    and eligibility standing (still_alive) for all entries in a specific tournament.
    """

    if isinstance(tournament, int):
        tournament = Tournament.objects.get(pk=tournament)

    # Step 1: Dynamically map each team's seed to its point value using SEED_POINT_BANDS.
    # We construct SQL 'When' cases to calculate points: (wins * points_per_win)
    scoring_cases = [
        When(picks__seed__range=seed_range, then=F("picks__wins") * points) for seed_range, points in SEED_POINT_BANDS
    ]

    # Step 2: Query and annotate each entry with its current total score.
    # We prefetch 'picks' to optimize database hits when calling the greedy simulation in Python.
    base_queryset = (
        Entry.objects.filter(tournament=tournament)
        .prefetch_related("picks")
        .annotate(
            # Calculate total score: sum up points earned across all picked teams.
            # Coalesce defaults to 0 if an entry has no picks (which would otherwise return NULL from Sum).
            calculated_points=Coalesce(
                Sum(
                    Case(
                        *scoring_cases,
                        default=0,
                        output_field=IntegerField(),
                    )
                ),
                0,
            )
        )
    )

    # Step 3: Calculate current actual rankings across the database using a Window function.
    # We cannot perform standard filter/update operations directly on querysets containing Window functions,
    # so we evaluate the queryset to a list to read the calculated rank values in Python.
    entries_ranked = base_queryset.annotate(
        temp_current_rank=Window(expression=Rank(), order_by=F("calculated_points").desc())
    )

    entries_ranked_list = list(entries_ranked)

    # Step 4: Extract global standings facts to determine 'still_alive' and 'max_potential_rank'.
    # Find the maximum actual score currently held by any player in the pool.
    max_current_score = base_queryset.aggregate(Max("calculated_points"))["calculated_points__max"] or 0

    # Get a sorted list of all players' actual scores descending to calculate 'max_potential_rank'.
    all_current_scores = sorted([e.calculated_points for e in entries_ranked_list], reverse=True)

    # Get the global tournament state once to avoid repeated queries inside the entry loop.
    current_round = tournament.current_round
    total_tournament_wins = tournament.total_wins

    # Step 5: Process each entry individually to calculate and cache their updated standing.
    updated_entries = []
    for entry in entries_ranked_list:
        entry.score = entry.calculated_points or 0

        # Run the greedy win simulation over this entry's picks to find their potential points remaining.
        # Using .all() uses the prefetched cache to prevent N+1 queries.
        calculated_potential_gain = calculate_optimistic_gain(entry.picks.all(), current_round, total_tournament_wins)
        entry.potential_score = entry.score + (calculated_potential_gain or 0)

        # Cache the current rank computed by Django's Window Rank() function.
        entry.current_rank = entry.temp_current_rank

        # A player is "still alive" if their maximum theoretical potential score is at least
        # equal to the current highest actual score in the pool. Otherwise, they are mathematically eliminated.
        entry.still_alive = entry.potential_score >= max_current_score

        # Calculate Max Potential Rank:
        # Determine the absolute best rank this entry could get if everything goes perfectly.
        # This is equal to: (Count of other players who CURRENTLY have an actual score strictly greater than this entry's potential score) + 1.
        better_than_me = sum(1 for s in all_current_scores if s > entry.potential_score)
        entry.max_potential_rank = better_than_me + 1

        updated_entries.append(entry)

    # Step 6: Bulk update all modified fields on all entries in a single optimized database query.
    Entry.objects.bulk_update(
        updated_entries, ["score", "potential_score", "current_rank", "max_potential_rank", "still_alive"]
    )

    # Step 7: Record when the standings were last updated if requested (usually triggered by admin win updates).
    if set_standings_last_updated:
        tournament.standings_last_updated_at = timezone.now()
        tournament.save()
