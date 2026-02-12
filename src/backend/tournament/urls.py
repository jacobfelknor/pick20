from django.urls import path
from .views import EntryListView, EntryDetailView

urlpatterns = [
    # GET to list
    path("<int:tournament_id>/entries/", EntryListView.as_view(), name="entry-list"),
    # GET to retrieve, PUT/PATCH to update, DELETE to remove
    path("<int:tournament_id>/entry/<int:user_id>/", EntryDetailView.as_view(), name="entry-detail"),
]
