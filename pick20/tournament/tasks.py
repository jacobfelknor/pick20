from django.db.models import Sum, Case, When, F, IntegerField
from .models import Entry


def update_tournament_scores(tournament):
    """
    Recalculates and saves the current_score for all entries
    within a specific tournament.

    TODO: generalize "rules" so we don't repeat them here and in models.py
    """
    # 1. Calculate the score using SQL aggregation logic
    # This matches your specific Seed -> Points rules
    entries_with_calculated_scores = Entry.objects.filter(tournament=tournament).annotate(
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

    # 2. Update the database
    # We loop through the annotated queryset to update the actual field
    for entry in entries_with_calculated_scores:
        # If a user has 0 points, the Sum aggregation might return None
        new_score = entry.calculated_points or 0

        # Only save if the score actually changed to save database cycles
        if entry.score != new_score:
            entry.score = new_score
            entry.save(update_fields=["score"])
