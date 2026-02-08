from django.db import models

# Create your models here.

from django.conf import settings
from django.utils import timezone


class School(models.Model):
    """
    Represents the institution.
    These records persist forever and don't change year-to-year.
    """

    name = models.CharField(max_length=64)  # e.g., "Duke"
    abbrev = models.CharField(max_length=10)  # e.g., "DUKE"
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

    def __str__(self):
        return f"{self.year} Tournament"

    @property
    def is_locked(self):
        return timezone.now() >= self.start_date


class TournamentTeam(models.Model):
    """
    Represents a School's specific appearance in a Tournament.
    This is the 'Pickable' item.
    """

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
    seed = models.IntegerField()  # 1 through 16
    region = models.CharField(
        max_length=32,
        choices=Region.choices,
    )

    # THE CORE TRACKING FIELD
    # Instead of Game models, we just increment this integer.
    wins = models.PositiveIntegerField(default=0)
    is_eliminated = models.BooleanField(default=False)

    class Meta:
        unique_together = ("tournament", "school", "school_secondary")
        ordering = ["region", "seed"]

    def __str__(self):
        name_display = self.school.name
        if self.school_secondary:
            name_display += f" / {self.school_secondary.name}"
        return f"{name_display} ({self.seed}) - {self.tournament.year}"

    @property
    def points_per_win(self):
        """
        Calculates value based on the rules provided.
        """
        if 1 <= self.seed <= 4:
            return 1
        elif 5 <= self.seed <= 8:
            return 2
        elif 9 <= self.seed <= 12:
            return 3
        elif 13 <= self.seed <= 16:
            return 4
        return 0

    @property
    def total_points_earned(self):
        """
        The total points this team has contributed to any pool that picked it.
        """
        return self.points_per_win * self.wins


class Entry(models.Model):
    """
    The User's specific entry for a specific year.
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE)

    # The 20 selected teams
    picks = models.ManyToManyField(TournamentTeam, blank=True)
    score = models.IntegerField("Score", default=0)

    class Meta:
        unique_together = ("user", "tournament")  # One entry per user per year
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
