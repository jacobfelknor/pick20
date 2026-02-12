# Create your views here.

from rest_framework import generics, permissions, exceptions
from .models import Entry
from .serializers import EntrySerializer


class EntryListView(generics.ListAPIView):
    serializer_class = EntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tournament_id = self.kwargs.get("tournament_id")
        # TODO: add GET param to only return entries for a particular user
        #       I should also add a mixin to protect this against
        #       viewing other user's entries until a tournament is locked
        return Entry.objects.filter(tournament=tournament_id).prefetch_related("picks")


class EntryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = EntrySerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = None  # We are handling lookup manually via kwargs

    def get_object(self):
        tournament_id = self.kwargs.get("tournament_id")
        user_id = self.kwargs.get("user_id")
        current_user = self.request.user

        # 1. Permission Check:
        # Define who can view entries that aren't their own
        # TODO: This should be a mixin that gets reused and also accounts for if the tournament is locked
        #       Once tournament unlocks, all users should be able to see all entries for this user
        if current_user.id != user_id and not current_user.is_superuser:
            raise exceptions.PermissionDenied("You cannot view another user's entry.")

        # 2. Fetch the specific entry
        try:
            return Entry.objects.get(tournament_id=tournament_id, user_id=user_id)
        except Entry.DoesNotExist:
            raise exceptions.NotFound("No entry found for this user in this tournament.")

    def perform_update(self, serializer):
        # still bound by the 'is_locked' logic in the serializer.
        serializer.save()
