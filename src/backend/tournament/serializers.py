from accounts.serializers import UserSerializer
from rest_framework import serializers

from .models import Entry, Tournament, TournamentTeam, School


class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ("id", "name", "abbrev")


class TournamentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tournament
        fields = (
            "id",
            "year",
            "start_date",
            "standings_last_updated_at",
            "concluded",
            "is_locked",
            "total_entries",
            "total_participants",
            "entries_alive",
            "participants_alive",
            "teams_remaining",
        )
        read_only_fields = ("standings_last_updated_at",)


class TournamentTeamSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source="school.name", read_only=True)
    school_secondary = serializers.PrimaryKeyRelatedField(
        queryset=School.objects.all(),
        required=False,
        allow_null=True,
    )
    school_secondary_name = serializers.SerializerMethodField()
    num_entries_picked = serializers.SerializerMethodField()

    class Meta:
        model = TournamentTeam
        fields = (
            "id",
            "school",
            "school_name",
            "school_secondary",
            "school_secondary_name",
            "name_display",
            "seed",
            "region",
            "wins",
            "is_eliminated",
            "points_per_win",
            "total_points_earned",
            "optimistic_max_points",
            "optimistic_potential_points_remaining",
            "num_entries_picked",
        )

    def get_school_secondary_name(self, obj):
        if obj.school_secondary:
            return obj.school_secondary.name
        return None

    def get_num_entries_picked(self, obj):
        if hasattr(obj, "entries_count"):
            return obj.entries_count
        return obj.entry_set.count()


class EntrySerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source="user", read_only=True)
    picks_detail = serializers.SerializerMethodField()
    complete = serializers.SerializerMethodField()

    class Meta:
        model = Entry
        fields = (
            "id",
            "name",
            "user",
            "user_detail",
            "tournament",
            "picks",
            "picks_detail",
            "score",
            "potential_score",
            "potential_score_remaining",
            "current_rank",
            "max_potential_rank",
            "still_alive",
            "complete",
            "teams_remaining",
            "paid",
        )
        read_only_fields = ("user", "score", "potential_score", "still_alive", "paid")

    def __init__(self, *args, **kwargs):
        # Instantiate the superclass normally
        super().__init__(*args, **kwargs)

        picks_detail = self.context.get("picks_detail", False)

        if not picks_detail and not hasattr(self, "initial_data"):
            # Drop the field if the flag is not set and we are not validating/saving
            self.fields.pop("picks_detail", None)
            self.fields.pop("picks", None)

        request = self.context.get("request")
        if request and request.user and (request.user.is_staff or request.user.is_superuser) and "paid" in self.fields:
            self.fields["paid"].read_only = False

    def get_picks_detail(self, obj):
        # Retrieve the queryset and order it
        picks = obj.picks.all()
        # default ordering of points earned descending
        picks = sorted(picks, key=lambda x: x.total_points_earned)
        return TournamentTeamSerializer(picks, many=True).data

    def get_complete(self, obj):
        return obj.picks.count() == 20

    def validate(self, data):
        # 1. Grab tournament from data (Create) or instance (Update)
        tournament = data.get("tournament")
        if not tournament and self.instance:
            tournament = self.instance.tournament

        # 2. Check lock status
        request = self.context.get("request")
        is_admin = request and request.user and (request.user.is_staff or request.user.is_superuser)
        if tournament and tournament.is_locked and not is_admin:
            raise serializers.ValidationError("This tournament is locked. No further entries or changes allowed.")

        # Check picks tournament validity
        picks = data.get("picks")
        if picks and tournament:
            for team in picks:
                if team.tournament_id != tournament.id:
                    raise serializers.ValidationError({"picks": "All selected teams must belong to the tournament."})

        # 3. Check for duplicate name
        name = data.get("name")
        user = self.instance.user if self.instance else (request.user if request else None)

        if user and name:
            queryset = Entry.objects.filter(user=user, name=name, tournament=tournament)
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)

            if queryset.exists():
                raise serializers.ValidationError(
                    {"name": "You already have an entry with this name for this tournament."}
                )

        return data

    def validate_picks(self, value):
        # 2. Enforce the 20-team limit mentioned in your model docstring
        if len(value) > 20:
            raise serializers.ValidationError("You can only select up to 20 teams.")
        return value
