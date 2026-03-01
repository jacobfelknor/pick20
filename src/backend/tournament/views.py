# Create your views here.

from rest_framework import filters, generics, permissions

from . import models, serializers
from .permissions import IsOwnerAdminOrTournamentLocked


class TournamentDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.TournamentSerializer
    permission_classes = [permissions.IsAuthenticated]

    queryset = models.Tournament.objects.all()


class TournamentListView(generics.ListAPIView):
    serializer_class = serializers.TournamentSerializer
    permission_classes = [permissions.IsAuthenticated]

    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["year"]
    queryset = models.Tournament.objects.all()
    ordering = ["-year"]


class EntryListView(generics.ListAPIView):
    serializer_class = serializers.EntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tournament_id = self.kwargs.get("tournament_id")
        # TODO: add GET param to only return entries for a particular user
        #       I should also add a mixin to protect this against
        #       viewing other user's entries until a tournament is locked
        qs = models.Entry.objects.all()
        tournament = models.Tournament.objects.get(pk=tournament_id)
        if not tournament.is_locked and not self.request.user.is_superuser:
            # before tournament is locked, non-superusers can only view their own entries
            qs = qs.filter(user=self.request.user)

        # Optimization:
        # select_related('user') joins the user table in the initial SQL query
        # prefetch_related('picks') handles the M2M teams in one follow-up query
        return qs.filter(tournament=tournament_id).select_related("user").prefetch_related("picks")


class EntryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.EntrySerializer
    permission_classes = [IsOwnerAdminOrTournamentLocked]
    lookup_field = None  # We are handling lookup manually via kwargs

    def get_queryset(self):
        # Always use optimization here to cover all bases
        return models.Entry.objects.select_related("user", "tournament").prefetch_related("picks")

    def get_object(self):
        queryset = self.get_queryset()

        entry_id = self.kwargs.get("entry_id")

        # tournament_id = self.kwargs.get("tournament_id")
        # user_id = self.kwargs.get("user_id")

        # Look up object by the URL kwargs
        # obj = generics.get_object_or_404(queryset, tournament_id=tournament_id, user_id=user_id)
        obj = generics.get_object_or_404(queryset, pk=entry_id)

        # triggers check with IsOwnerAdminOrTournamentLocked
        self.check_object_permissions(self.request, obj)
        return obj

    def perform_update(self, serializer):
        # still bound by the 'is_locked' logic in the serializer.
        serializer.save()
