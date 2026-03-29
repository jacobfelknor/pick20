from django.db.models import Case, F, IntegerField, Max, Sum, When, Window
from django.db.models.functions import Rank
from django.utils import timezone

from .models import Entry, Tournament, TournamentTeam


def calculate_optimistic_gain(picks, current_round, total_tournament_wins):
    """
    Calculates max potential gain by assigning available wins per round
    to the highest-value teams first, taking into account how many rounds are remaining

    Still does not consider head-to-head match-ups, as this is impossible because we don't
    actually track a bracket
    """
    # 1. Filter for teams not yet eliminated
    eligible_teams = list(filter(lambda x: not x.is_eliminated, picks))

    # 2. Sort by points-per-win descending (highest value teams first)
    eligible_teams.sort(key=lambda x: x.points_per_win, reverse=True)

    total_potential_gain = 0

    for r in range(current_round, TournamentTeam.MAX_WINS + 1):
        # Calculate global slots remaining for this round
        # How many games have ALREADY finished in this round across the whole tourney?
        if r == current_round:
            # If R1, total_tournament_wins might be 10. Max is 32. Global left = 22.
            # If R2, we need to subtract the 32 wins from R1 first.
            total_wins_prior_to_this_round = sum(2 ** (TournamentTeam.MAX_WINS - i) for i in range(1, r))
            wins_already_finished_in_round = max(total_tournament_wins - total_wins_prior_to_this_round, 0)
            wins_to_complete_this_round = 2 ** (TournamentTeam.MAX_WINS - r)
            wins_remaining_in_this_round = wins_to_complete_this_round - wins_already_finished_in_round
        else:
            # Future rounds haven't started, so all slots are open
            wins_remaining_in_this_round = 2 ** (TournamentTeam.MAX_WINS - r)

        wins_awarded = 0
        for team in eligible_teams:
            if wins_awarded < wins_remaining_in_this_round:
                # Only award points if the team hasn't reached this round yet
                if team.wins < r:
                    total_potential_gain += team.points_per_win
                    wins_awarded += 1
                # Note: We don't increment wins_awarded if team.wins >= r
                # because those wins are already accounted for in total_tournament_wins
                # and thus already subtracted from global_slots_remaining

    return total_potential_gain


def update_tournament_scores(tournament: Tournament | int, set_standings_last_updated: bool = False):
    """
    Recalculates and saves the current_score for all entries
    within a specific tournament.

    TODO: generalize "rules" so we don't repeat them here and in models.py
    """

    if isinstance(tournament, int):
        tournament = Tournament.objects.get(pk=tournament)

    # 1. Annotate scores and potential scores first
    # We use a subquery/cte approach conceptually by chaining annotations
    base_queryset = (
        Entry.objects.filter(tournament=tournament)
        .prefetch_related("picks")
        .annotate(
            # Current Score Logic
            calculated_points=Sum(
                Case(
                    When(picks__seed__range=(13, 16), then=F("picks__wins") * 4),
                    When(picks__seed__range=(9, 12), then=F("picks__wins") * 3),
                    When(picks__seed__range=(5, 8), then=F("picks__wins") * 2),
                    When(picks__seed__range=(1, 4), then=F("picks__wins") * 1),
                    default=0,
                    output_field=IntegerField(),
                )
            )
        )
    )

    # 2. Add Window Functions for Ranking
    # Note: Window functions can't be used in filter/update directly,
    # so we evaluate them in this queryset.
    entries_ranked = base_queryset.annotate(
        temp_current_rank=Window(expression=Rank(), order_by=F("calculated_points").desc())
    )

    # Calculate the max current score to determine 'still_alive'
    max_current_score = base_queryset.aggregate(Max("calculated_points"))["calculated_points__max"] or 0

    # Get a list of all current scores to calculate Max Potential Rank
    # Max Potential Rank = How many people CURRENTLY have a score higher than your POTENTIAL score?
    all_current_scores = sorted([e.calculated_points for e in entries_ranked], reverse=True)

    # calculate this once outside the loop to avoid N queries
    current_round = tournament.current_round
    total_tournament_wins = tournament.total_wins

    # 3. Prepare for Bulk Update
    updated_entries = []
    for entry in entries_ranked:
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
