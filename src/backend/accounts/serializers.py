from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        # fields = ["id", "username", "email", "first_name", "last_name", "password"]
        # TODO: probably should limit this, but during dev I want all the info
        fields = "__all__"
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"
