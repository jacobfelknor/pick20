from django.db.models import Case, F, IntegerField, Max, Sum, Value, When, Window
from django.db.models.functions import Rank

from .models import Entry, TournamentTeam


def update_tournament_scores(tournament):
    """
    Recalculates and saves the current_score for all entries
    within a specific tournament.

    TODO: generalize "rules" so we don't repeat them here and in models.py
    """
    # 1. Annotate scores and potential scores first
    # We use a subquery/cte approach conceptually by chaining annotations
    base_queryset = (
        Entry.objects.filter(tournament=tournament)
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
        .annotate(
            # Optimistic Max Potential Gain Logic
            # Does not account for head-to-head matchups between your picks
            calculated_potential_gain=Sum(
                Case(
                    When(picks__is_eliminated=True, then=Value(0)),
                    When(picks__seed__range=(13, 16), then=(Value(TournamentTeam.MAX_WINS) - F("picks__wins")) * 4),
                    When(picks__seed__range=(9, 12), then=(Value(TournamentTeam.MAX_WINS) - F("picks__wins")) * 3),
                    When(picks__seed__range=(5, 8), then=(Value(TournamentTeam.MAX_WINS) - F("picks__wins")) * 2),
                    When(picks__seed__range=(1, 4), then=(Value(TournamentTeam.MAX_WINS) - F("picks__wins")) * 1),
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
        entry.potential_score = entry.score + (entry.calculated_potential_gain or 0)
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
