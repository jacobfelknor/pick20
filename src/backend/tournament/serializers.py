from accounts.serializers import UserSerializer
from rest_framework import serializers

from .models import Entry, Tournament, TournamentTeam


class TournamentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tournament
        fields = ["id", "year", "start_date", "is_locked"]
        read_only_fields = ["year", "start_date", "is_locked"]


class TournamentTeamSerializer(serializers.ModelSerializer):
    school_name = serializers.SerializerMethodField()

    class Meta:
        model = TournamentTeam
        fields = [
            "school",
            "school_name",
            "seed",
            "region",
            "wins",
            "is_eliminated",
            "total_points_earned",
            "optimistic_max_points",
            "optimistic_potential_points_remaining",
        ]

    def get_school_name(self, obj):
        return obj.school.name


class EntrySerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source="user", read_only=True)
    tournament_detail = TournamentSerializer(source="tournament", read_only=True)
    teams_remaining_count = serializers.SerializerMethodField()
    picks_detail = TournamentTeamSerializer(source="picks", read_only=True, many=True)

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
            "still_alive",
            "teams_remaining_count",
        ]
        read_only_fields = ["score", "potential_score", "still_alive"]

    def validate(self, data):
        # 1. Check if the tournament is locked
        tournament = data.get("tournament") or self.instance.tournament
        # TODO: let admin update even after tournament is locked
        if tournament.is_locked:
            raise serializers.ValidationError("This tournament is locked. No further entries or changes allowed.")

        return data

    def validate_picks(self, value):
        # 2. Enforce the 20-team limit mentioned in your model docstring
        if len(value) > 20:
            raise serializers.ValidationError("You can only select up to 20 teams.")
        return value

    def get_teams_remaining_count(self, obj):
        # This filters the ManyToMany relationship for this specific entry
        return obj.picks.filter(is_eliminated=False).count()
