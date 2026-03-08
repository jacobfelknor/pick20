from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "password", "full_name"]
        extra_kwargs = {
            "password": {"write_only": True, "required": False},
            "username": {"read_only": True},  # Usually, you don't want users changing usernames
            "email": {"required": True},
        }

    def create(self, validated_data):
        # This handles hashing during registration
        return User.objects.create_user(**validated_data)

    def update(self, instance, validated_data):
        # 1. Extract the password from the data
        password = validated_data.pop("password", None)

        # 2. Update all other fields (email, names, etc.)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # 3. If a new password was provided, hash it properly
        if password:
            instance.set_password(password)

        instance.save()
        return instance

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"
