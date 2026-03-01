from django.db.models import Case, F, IntegerField, Max, Sum, Value, When

from .models import Entry, TournamentTeam

# MAX_WINS = 6  # 64 team field tournament depth


def update_tournament_scores(tournament):
    """
    Recalculates and saves the current_score for all entries
    within a specific tournament.

    TODO: generalize "rules" so we don't repeat them here and in models.py
    """

    # 1. Calculate the score using SQL aggregation logic
    # This matches your specific Seed -> Points rules
    entries_with_calculated_scores = Entry.objects.filter(tournament=tournament).annotate(
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
        ),
        # Optimistic Max Potential Gain Logic
        # Does not account for head-to-head matchups between your picks
        calculated_potential=Sum(
            Case(
                # If team is eliminated, they contribute 0 to future potential
                When(picks__is_eliminated=True, then=Value(0)),
                # If active, they could win (MAX_WINS - current_wins) more games
                When(picks__seed__range=(13, 16), then=(Value(TournamentTeam.MAX_WINS) - F("picks__wins")) * 4),
                When(picks__seed__range=(9, 12), then=(Value(TournamentTeam.MAX_WINS) - F("picks__wins")) * 3),
                When(picks__seed__range=(5, 8), then=(Value(TournamentTeam.MAX_WINS) - F("picks__wins")) * 2),
                When(picks__seed__range=(1, 4), then=(Value(TournamentTeam.MAX_WINS) - F("picks__wins")) * 1),
                default=0,
                output_field=IntegerField(),
            )
        ),
    )

    max_current_score = Entry.objects.filter(tournament=tournament).aggregate(Max("score"))["score__max"] or 0

    # 2. Update the database
    # We loop through the annotated queryset to update the actual field
    for entry in entries_with_calculated_scores:
        # If a user has 0 points, the Sum aggregation might return None
        new_score = entry.calculated_points or 0
        potential_gain = entry.calculated_potential or 0
        entry.potential_score = new_score + potential_gain

        entry.score = new_score
        entry.potential_score = new_score + potential_gain
        entry.still_alive = entry.potential_score >= max_current_score
        entry.save(update_fields=["score", "potential_score", "still_alive"])
