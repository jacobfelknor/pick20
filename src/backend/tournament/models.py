from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

SEED_POINT_BANDS = (
    ((13, 16), 4),
    ((9, 12), 3),
    ((5, 8), 2),
    ((1, 4), 1),
)


class School(models.Model):
    """
    Represents the institution.
    These records persist forever and don't change year-to-year.
    """

    name = models.CharField(max_length=64, unique=True)  # e.g., "Michigan"
    abbrev = models.CharField(max_length=10)  # e.g., "UofM"
    # Optional: logo_url, primary_color, etc.

    def __str__(self):
        return self.name


class Tournament(models.Model):
    """
    Represents a specific year's event.
    This is where we define the global 'Lock' time.
    """

    year = models.IntegerField(unique=True)  # e.g., 2024
    start_date = models.DateTimeField(help_text="The timestamp when the first game starts. Picks lock after this.")
    concluded = models.BooleanField(default=False, help_text="Tournament has concluded")
    standings_last_updated_at = models.DateTimeField(
        help_text="The last time a tournament's standings were updated by an admin",
        null=True,
        blank=True,
    )

    def __str__(self):
        return f"{self.year} Tournament"

    def clean(self):
        super().clean()
        if self.start_date and self.year and self.start_date.year != self.year:
            from django.core.exceptions import ValidationError

            raise ValidationError({"start_date": f"The start date must be in the year {self.year}."})

    @property
    def is_locked(self):
        return timezone.now() >= self.start_date

    @property
    def total_entries(self):
        return self.entries.count()

    @property
    def total_participants(self):
        return self.entries.values_list("user").distinct().count()

    @property
    def entries_alive(self):
        return self.entries.filter(still_alive=True).count()

    @property
    def participants_alive(self):
        return self.entries.filter(still_alive=True).values_list("user").distinct().count()

    @property
    def teams_remaining(self):
        return self.teams.filter(is_eliminated=False).count()

    ROUND_WINS_THRESHOLDS = (
        (32, 1),
        (48, 2),
        (56, 3),
        (60, 4),
        (62, 5),
        (63, 6),
    )

    @property
    def total_wins(self):
        return self.teams.aggregate(total=models.Sum("wins"))["total"] or 0

    @property
    def current_round(self):
        total = self.total_wins
        for limit, round_num in self.ROUND_WINS_THRESHOLDS:
            if total < limit:
                return round_num
        # If total wins are >= 63, the tournament is concluded.
        # We return MAX_WINS + 1 (7) to indicate that there are no remaining rounds to simulate.
        return TournamentTeam.MAX_WINS + 1


class TournamentTeam(models.Model):
    """
    Represents a School's specific appearance in a Tournament.
    This is the 'Pickable' item.
    """

    class Meta:
        unique_together = (
            ("tournament", "school"),
            ("tournament", "seed", "region"),
        )
        ordering = ("region", "seed")

    MAX_WINS = 6  # assumes a 64 team field

    # Inner class for clean organization of choices
    class Region(models.TextChoices):
        EAST = "East", "East"
        WEST = "West", "West"
        SOUTH = "South", "South"
        MIDWEST = "Midwest", "Midwest"

    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="teams")
    school = models.ForeignKey(School, on_delete=models.PROTECT, related_name="tournament_appearances")
    # in order to support the "first four", let this object be associated with multiple schools
    # if a school secondary is defined, display team as "school / school_secondary"
    # pick20 admin should update this object's primary school to the winner after the first four
    # and remove the secondary school
    school_secondary = models.ForeignKey(School, on_delete=models.PROTECT, blank=True, null=True)

    # The data specific to this year
    seed = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(16)])  # 1 through 16
    region = models.CharField(
        max_length=32,
        choices=Region.choices,
    )

    # THE CORE TRACKING FIELD
    # Instead of Game models, we just increment this integer.
    wins = models.PositiveIntegerField(default=0, validators=[MaxValueValidator(MAX_WINS)])
    is_eliminated = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.name_display} ({self.seed}) - {self.tournament.year}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        old_wins = None
        old_is_eliminated = False
        if not is_new:
            try:
                old_instance = TournamentTeam.objects.get(pk=self.pk)
                old_wins = old_instance.wins
                old_is_eliminated = old_instance.is_eliminated
            except TournamentTeam.DoesNotExist:
                pass

        super().save(*args, **kwargs)

        if is_new or old_wins != self.wins or old_is_eliminated != self.is_eliminated:
            from .tasks import update_tournament_scores

            update_tournament_scores(self.tournament_id, set_standings_last_updated=True)

    @property
    def name_display(self):
        name_display = self.school.name
        if self.school_secondary:
            name_display += f" / {self.school_secondary.name}"
        return name_display

    @property
    def points_per_win(self):
        """
        Calculates value based on the rules provided.
        """
        for (low, high), points in SEED_POINT_BANDS:
            if low <= self.seed <= high:
                return points
        return 0

    @property
    def total_points_earned(self):
        """
        The total points this team has contributed to any pool that picked it.
        """
        return self.points_per_win * self.wins

    @property
    def optimistic_max_points(self):
        if self.is_eliminated:
            return self.total_points_earned
        else:
            return self.total_points_earned + (self.MAX_WINS - self.wins) * self.points_per_win

    @property
    def optimistic_potential_points_remaining(self):
        return self.optimistic_max_points - self.total_points_earned


class Entry(models.Model):
    """
    The User's specific entry for a specific year.
    """

    name = models.CharField(max_length=100)  # TODO: make this a default like, "User Name N"
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="entries")

    # The 20 selected teams
    picks = models.ManyToManyField(TournamentTeam, blank=True)
    score = models.PositiveIntegerField("Current Score", default=0, db_index=True)
    # optimistic max: does not account for head-to-head matchups between picks
    potential_score = models.PositiveIntegerField("Optimistic Max Potential Score", default=0, db_index=True)
    still_alive = models.BooleanField("Still Alive", default=True)
    current_rank = models.PositiveIntegerField("Current Rank", default=0)
    max_potential_rank = models.PositiveIntegerField("Max Potential Rank", default=0)

    # payment tracking
    paid = models.BooleanField("Payment Received", default=False)

    class Meta:
        unique_together = ("name", "user", "tournament")  # User's can have multiple entries per year
        verbose_name_plural = "Entries"

    def __str__(self):
        return f"{self.user.username}'s {self.tournament.year} Picks"

    def clean(self):
        # Prevent editing if tournament is locked
        # Note: This checks on Django Admin saves, separate logic needed for API
        if self.tournament.is_locked:
            # Allow saving only if we are just updating scores (system level),
            # but we need to block user changes.
            # usually we handle this in the serializer, not the model clean()
            # to avoid blocking admin updates.
            pass

    @property
    def score_live(self):
        """
        Real-time calculation of the score.
        Appropriate for viewing a single entry's score, but not for tables of many entries where this scales poorly.
        In those cases, use the cached `score` property

        Since we don't have game objects, we just sum the points
        of the teams currently in the 'picks' list.
        """
        total = 0
        # Optimization: prefetch_related in the view will make this efficient
        for team in self.picks.all():
            total += team.total_points_earned

        return total

    @property
    def potential_score_remaining(self):
        return self.potential_score - self.score

    @property
    def teams_remaining(self):
        return self.picks.filter(is_eliminated=False).count()
