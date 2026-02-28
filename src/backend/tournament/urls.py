from django.urls import path

from . import views

urlpatterns = [
    # GET to list
    path("tournament/", views.TournamentListView.as_view(), name="tournament-list"),
    path("tournament/<pk>/", views.TournamentDetailView.as_view(), name="tournament-detail"),
    path("tournament/<int:tournament_id>/entries/", views.EntryListView.as_view(), name="entry-list"),
    # GET to retrieve, PUT/PATCH to update, DELETE to remove
    path("entry/<int:entry_id>/", views.EntryDetailView.as_view(), name="entry-detail"),
]
