from accounts.serializers import UserSerializer
from rest_framework import serializers

from .models import Entry, Tournament, TournamentTeam


class TournamentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tournament
        fields = [
            "id",
            "year",
            "start_date",
            "concluded",
            "is_locked",
            "total_entries",
            "total_participants",
            "entries_alive",
            "participants_alive",
            "teams_remaining",
        ]
        read_only_fields = ["year", "start_date", "concluded", "is_locked"]


class TournamentTeamSerializer(serializers.ModelSerializer):
    school_name = serializers.SerializerMethodField()

    class Meta:
        model = TournamentTeam
        fields = [
            "id",
            "school",
            "school_name",
            "name_display",
            "seed",
            "region",
            "wins",
            "is_eliminated",
            "points_per_win",
            "total_points_earned",
            "optimistic_max_points",
            "optimistic_potential_points_remaining",
        ]

    def get_school_name(self, obj):
        return obj.school.name


class EntrySerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source="user", read_only=True)
    tournament_detail = TournamentSerializer(source="tournament", read_only=True)
    picks_detail = serializers.SerializerMethodField()
    complete = serializers.SerializerMethodField()

    class Meta:
        model = Entry
        fields = [
            "id",
            "name",
            "user",
            "user_detail",
            "tournament",
            "tournament_detail",
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
        ]
        read_only_fields = ["user", "score", "potential_score", "still_alive"]

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
        if tournament and tournament.is_locked:
            # TODO: decide if we want to let admin update even after tournament is locked
            #       for now, force these kinds of updates through the admin panel, not frontend
            raise serializers.ValidationError("TThis tournament is locked. No further entries or changes allowed.")

        # 3. Check for duplicate name
        name = data.get("name")
        request = self.context.get("request")
        user = request.user

        queryset = Entry.objects.filter(user=user, name=name)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError({"name": "You already have an entry with this name."})

        return data

    def validate_picks(self, value):
        # 2. Enforce the 20-team limit mentioned in your model docstring
        if len(value) > 20:
            raise serializers.ValidationError("You can only select up to 20 teams.")
        return value
