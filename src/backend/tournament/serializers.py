from accounts.serializers import UserSerializer
from rest_framework import serializers

from .models import Entry, Tournament


class TournamentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tournament
        fields = "__all__"
        read_only_fields = ["year", "start_date"]


class EntrySerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source="user", read_only=True)
    tournament_detail = TournamentSerializer(source="tournament", read_only=True)

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
            "score",
            "potential_score",
            "still_alive",
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


class TournamentTeamSerializer(serializers.ModelSerializer):
    pass
