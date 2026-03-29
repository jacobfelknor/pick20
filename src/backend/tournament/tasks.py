from django.db.models import Case, F, IntegerField, Max, Sum, When, Window
from django.db.models.functions import Rank
from django.utils import timezone

from .models import Entry, Tournament, TournamentTeam


def calculate_optimistic_gain(picks, current_round):
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

    # 3. Iterate through remaining rounds only
    # If we are in Round 3, we check slots for Rounds 3, 4, 5, and 6
    for r in range(current_round, TournamentTeam.MAX_WINS + 1):
        # Calculate available wins in this round: R1=32, R2=16, R3=8, R4=4, R5=2, R6(Final)=1
        # Formula: 2^(6 - r)
        wins_available = 2 ** (TournamentTeam.MAX_WINS - r)
        wins_awarded = 0

        for team in eligible_teams:
            # Do we have any more wins left to award?
            if wins_awarded < wins_available:
                if team.wins >= r:
                    # this team already has a win for this round, occupying a win for this round
                    # but can't further contribute any gain for this round
                    wins_awarded += 1
                else:
                    # award this team a win in our potential gain
                    total_potential_gain += team.points_per_win
                    wins_awarded += 1

    return total_potential_gain


def update_tournament_scores(tournament: Tournament, set_standings_last_updated: bool = False):
    """
    Recalculates and saves the current_score for all entries
    within a specific tournament.

    TODO: generalize "rules" so we don't repeat them here and in models.py
    """
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

    # 3. Prepare for Bulk Update
    updated_entries = []
    for entry in entries_ranked:
        entry.score = entry.calculated_points or 0

        # Calculate the capped potential gain
        # Use .all() to hit the prefetched cache
        calculated_potential_gain = calculate_optimistic_gain(entry.picks.all(), tournament.current_round)
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
