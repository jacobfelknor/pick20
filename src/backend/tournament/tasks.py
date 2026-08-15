from django.db.models import Case, F, IntegerField, Max, Sum, When, Window
from django.db.models.functions import Coalesce, Rank
from django.utils import timezone

from .models import SEED_POINT_BANDS, Entry, Tournament, TournamentTeam


def calculate_optimistic_gain(picks, current_round, total_tournament_wins):
    """
    Calculates max potential gain by assigning available wins per round
    to the highest-value teams first, taking into account how many rounds are remaining.

    For a team to get a win in round r (where r >= current_round), they must:
    1. Not be eliminated currently.
    2. Be hypothetically alive for round r (i.e. they already have r - 1 wins,
       either in reality, or awarded in prior rounds of this simulation).

    This prevents teams from skipping a round or winning multiple games in the same round,
    while correctly prioritizing our highest-value active teams.
    """
    # 1. Filter for teams not yet eliminated
    eligible_teams = list(filter(lambda x: not x.is_eliminated, picks))

    # 2. Track hypothetical wins for each team
    # Initially, each team starts with their actual wins
    hypothetical_wins = {team.id: team.wins for team in eligible_teams}

    total_potential_gain = 0

    # 3. Process each round from current_round onwards
    for r in range(current_round, TournamentTeam.MAX_WINS + 1):
        # Calculate global slots remaining for this round
        if r == current_round:
            total_wins_prior_to_this_round = sum(2 ** (TournamentTeam.MAX_WINS - i) for i in range(1, r))
            wins_already_finished_in_round = max(total_tournament_wins - total_wins_prior_to_this_round, 0)
            wins_to_complete_this_round = 2 ** (TournamentTeam.MAX_WINS - r)
            wins_remaining_in_this_round = max(wins_to_complete_this_round - wins_already_finished_in_round, 0)
        else:
            wins_remaining_in_this_round = 2 ** (TournamentTeam.MAX_WINS - r)

        # Filter teams that are active and have exactly r - 1 wins (hypothetically)
        # So they can be awarded a win in round r.
        round_eligible_teams = [team for team in eligible_teams if hypothetical_wins[team.id] == r - 1]

        # Prioritize highest value teams first (highest points_per_win)
        round_eligible_teams.sort(key=lambda x: x.points_per_win, reverse=True)

        wins_awarded = 0
        for team in round_eligible_teams:
            if wins_awarded < wins_remaining_in_this_round:
                total_potential_gain += team.points_per_win
                hypothetical_wins[team.id] = r
                wins_awarded += 1
            else:
                break

    return total_potential_gain


def update_tournament_scores(tournament: Tournament | int, set_standings_last_updated: bool = False):
    """
    Recalculates and saves the current_score for all entries
    within a specific tournament.
    """

    if isinstance(tournament, int):
        tournament = Tournament.objects.get(pk=tournament)

    # 1. Annotate scores and potential scores dynamically using the generalized SEED_POINT_BANDS
    scoring_cases = [
        When(picks__seed__range=seed_range, then=F("picks__wins") * points) for seed_range, points in SEED_POINT_BANDS
    ]

    base_queryset = (
        Entry.objects.filter(tournament=tournament)
        .prefetch_related("picks")
        .annotate(
            # Current Score Logic
            # Coalesce handles the case where an entry has no picks and Sum returns NULL
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

    # 2. Add Window Functions for Ranking
    # Note: Window functions can't be used in filter/update directly,
    # so we evaluate them in this queryset.
    entries_ranked = base_queryset.annotate(
        temp_current_rank=Window(expression=Rank(), order_by=F("calculated_points").desc())
    )

    # Evaluate queryset to list once to cache results and prevent multiple evaluations
    entries_ranked_list = list(entries_ranked)

    # Calculate the max current score to determine 'still_alive'
    max_current_score = base_queryset.aggregate(Max("calculated_points"))["calculated_points__max"] or 0

    # Get a list of all current scores to calculate Max Potential Rank
    # Max Potential Rank = How many people CURRENTLY have a score higher than your POTENTIAL score?
    all_current_scores = sorted([e.calculated_points for e in entries_ranked_list], reverse=True)

    # calculate this once outside the loop to avoid N queries
    current_round = tournament.current_round
    total_tournament_wins = tournament.total_wins

    # 3. Prepare for Bulk Update
    updated_entries = []
    for entry in entries_ranked_list:
        entry.score = entry.calculated_points or 0

        # Calculate the capped potential gain
        # Use .all() to hit the prefetched cache
        calculated_potential_gain = calculate_optimistic_gain(entry.picks.all(), current_round, total_tournament_wins)
        entry.potential_score = entry.score + (calculated_potential_gain or 0)
        entry.current_rank = entry.temp_current_rank
        entry.still_alive = entry.potential_score >= max_current_score

        # Calculate Max Potential Rank:
        # Find how many entries have a current score strictly greater than this entry's potential
        # Rank = (Count of people better than you) + 1
        better_than_me = sum(1 for s in all_current_scores if s > entry.potential_score)
        entry.max_potential_rank = better_than_me + 1

        updated_entries.append(entry)

    # 4. Execute Bulk Update
    Entry.objects.bulk_update(
        updated_entries, ["score", "potential_score", "current_rank", "max_potential_rank", "still_alive"]
    )

    # 5. Update tournament standing last updated at, if requested
    #    Intended to only be used when an admin has updated win counts for
    #    TournamentTeams
    if set_standings_last_updated:
        tournament.standings_last_updated_at = timezone.now()
        tournament.save()
