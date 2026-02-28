from django.urls import path
from .views import EntryListView, EntryDetailView

urlpatterns = [
    # GET to list
    path("tournament/<int:tournament_id>/entries/", EntryListView.as_view(), name="entry-list"),
    # GET to retrieve, PUT/PATCH to update, DELETE to remove
    path("entry/<int:entry_id>/", EntryDetailView.as_view(), name="entry-detail"),
]
