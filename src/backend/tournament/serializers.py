from rest_framework import serializers
from .models import Entry


class EntrySerializer(serializers.ModelSerializer):
    # We make user read-only because we'll pull it from the request context
    username = serializers.ReadOnlyField(source="user.username")

    class Meta:
        model = Entry
        fields = ["id", "user", "username", "tournament", "picks", "score", "potential_score", "still_alive"]
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
