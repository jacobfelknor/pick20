# Create your views here.

from django.db import transaction
from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import filters, generics, permissions

from . import models, serializers
from .permissions import IsAdminOrReadOnly, IsAdminUser, IsOwnerOrTournamentLocked
from .tasks import update_tournament_scores


class TournamentDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.TournamentSerializer
    permission_classes = (IsAdminOrReadOnly,)

    queryset = models.Tournament.objects.all()


class TournamentListView(generics.ListCreateAPIView):
    serializer_class = serializers.TournamentSerializer
    permission_classes = (IsAdminOrReadOnly,)

    filter_backends = (filters.OrderingFilter,)
    ordering_fields = ("year",)
    queryset = models.Tournament.objects.all()
    ordering = ("-year",)


class TournamentTeamListView(generics.ListCreateAPIView):
    serializer_class = serializers.TournamentTeamSerializer
    permission_classes = (IsAdminOrReadOnly,)

    filter_backends = (filters.OrderingFilter,)
    ordering_fields = ("seed",)
    ordering = ("seed",)

    def get_queryset(self):
        tournament_id = self.kwargs.get("tournament_id")
        qs = (
            models.TournamentTeam.objects.filter(tournament=tournament_id)
            # pre-select the school info, so we don't need to re-query in our serializer
            .select_related("school")
            # efficiently obtain the number of entries who picked this tournament team
            # without doing N+1 queries in the serializers
            .annotate(entries_count=Count("entry"))
            .all()
        )
        return qs

    def perform_create(self, serializer):
        tournament_id = self.kwargs.get("tournament_id")
        tournament = get_object_or_404(models.Tournament, pk=tournament_id)
        serializer.save(tournament=tournament)


class TournamentTeamUpdateView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.TournamentTeamSerializer
    permission_classes = (IsAdminUser,)
    queryset = models.TournamentTeam.objects.all()

    def perform_destroy(self, instance):
        from rest_framework.exceptions import ValidationError

        if instance.tournament.is_locked:
            raise ValidationError("Cannot remove a team from a locked tournament.")
        instance.delete()


class EntryListView(generics.ListAPIView):
    serializer_class = serializers.EntrySerializer
    permission_classes = (permissions.IsAuthenticated,)

    filter_backends = (filters.OrderingFilter,)
    ordering_fields = ("score", "potential_score")
    ordering = ("-score", "-potential_score")

    def get_queryset(self):
        tournament_id = self.kwargs.get("tournament_id")
        tournament = get_object_or_404(models.Tournament, pk=tournament_id)
        only_my_entries = self.request.query_params.get("onlyMyEntries", "false")

        qs = models.Entry.objects.all()
        if not tournament.is_locked or only_my_entries.lower() == "true":
            qs = qs.filter(user=self.request.user)

        # Optimization:
        # select_related('user') joins the user table in the initial SQL query
        return qs.filter(tournament=tournament_id).select_related("user")


class EntryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.EntrySerializer
    permission_classes = (IsOwnerOrTournamentLocked,)
    lookup_field = None  # We are handling lookup manually via kwargs

    def get_queryset(self):
        # Always use optimization here to cover all bases
        return models.Entry.objects.select_related("user", "tournament").prefetch_related("picks")

    def get_object(self):
        queryset = self.get_queryset()

        entry_id = self.kwargs.get("entry_id")

        obj = generics.get_object_or_404(queryset, pk=entry_id)

        # triggers check with IsOwnerAdminOrTournamentLocked
        self.check_object_permissions(self.request, obj)
        return obj

    def get_serializer_context(self):
        context = super().get_serializer_context()
        # include picks detail, since we'll use that for the picks table
        context["picks_detail"] = True
        return context

    def perform_update(self, serializer):
        # still bound by the 'is_locked' logic in the serializer.
        with transaction.atomic():
            serializer.save()
            update_tournament_scores(serializer.instance.tournament_id)


class EntryCreateView(generics.CreateAPIView):
    """
    Allows users to create a new tournament entry.
    """

    queryset = models.Entry.objects.all()
    serializer_class = serializers.EntrySerializer
    permission_classes = (IsOwnerOrTournamentLocked,)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        # include picks detail, since we'll use that to create picks
        context["picks_detail"] = True
        return context

    def perform_create(self, serializer):
        # Automatically assign the logged-in user to the entry
        # This prevents users from creating entries for other people
        with transaction.atomic():
            serializer.save(user=self.request.user)
            # run update task so this gets initial values
            update_tournament_scores(serializer.instance.tournament_id)


class SchoolListView(generics.ListCreateAPIView):
    serializer_class = serializers.SchoolSerializer
    permission_classes = (IsAdminOrReadOnly,)
    queryset = models.School.objects.all().order_by("name")
