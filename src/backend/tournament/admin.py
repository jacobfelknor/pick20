from django.contrib import admin

# Register your models here.
from .models import Entry, School, Tournament, TournamentTeam
from .tasks import update_tournament_scores


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ("name", "abbrev")
    search_fields = ("name", "abbrev")
    ordering = ("name",)


@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
    list_display = ("year", "start_date", "is_locked_display")
    ordering = ("-year",)

    actions = ["recalculate_all_scores"]

    @admin.display(boolean=True, description="Locked?")
    def is_locked_display(self, obj):
        return obj.is_locked

    @admin.action(description="Recalculate scores for all entries in this tournament")
    def recalculate_all_scores(self, request, queryset):
        for tournament in queryset:
            update_tournament_scores(tournament)

        self.message_user(request, f"Scores updated for {len(queryset)} tournament(s)")


@admin.register(TournamentTeam)
class TournamentTeamAdmin(admin.ModelAdmin):
    # This is your command center during the tournament
    list_display = (
        "get_school_display",
        "seed",
        "region",
        "wins",
        "is_eliminated",
        "points_value_display",
        "tournament",
    )

    # EDIT THESE DIRECTLY IN THE LIST LIST
    list_editable = ("wins", "is_eliminated")

    list_filter = ("tournament", "region", "is_eliminated", "seed")
    search_fields = ("school__name", "school__abbrev")
    ordering = ("region", "seed")

    # Automate the title in the dropdowns
    autocomplete_fields = ["school", "school_secondary"]

    @admin.display(description="Pts/Win")
    def points_value_display(self, obj):
        return obj.points_per_win

    @admin.display(description="School")
    def get_school_display(self, obj):
        # This makes the list view show the "Winner of First Four" logic
        if obj.school_secondary:
            return f"{obj.school.name} / {obj.school_secondary.name}"
        return obj.school.name


@admin.register(Entry)
class EntryAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "name",
        "get_user_full_name",
        "user__email",
        "tournament",
        "score",
        "potential_score",
        "still_alive",
        "picks_count",
    )
    list_filter = ("tournament", "still_alive")
    search_fields = ("name", "user__username", "user__email")
    ordering = ("-score", "-potential_score")

    # Essential for ManyToMany fields with 64+ options
    filter_horizontal = ("picks",)

    @admin.display(description="User's Name")
    def get_user_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}"

    @admin.display(description="Picks Made")
    def picks_count(self, obj):
        return obj.picks.count()

    def get_queryset(self, request):
        # Optimization to prevent N+1 queries in the admin list
        queryset = super().get_queryset(request)
        return queryset.prefetch_related("picks")

    def get_form(self, request, obj=None, **kwargs):
        """
        Store the current object (Entry) in the request so we can
        access the tournament ID in the field filtering methods.
        """
        request._obj_ = obj
        return super().get_form(request, obj, **kwargs)

    def formfield_for_manytomany(self, db_field, request, **kwargs):
        """
        Filters the 'picks' field to only show teams from the correct year.
        """
        if db_field.name == "picks" and hasattr(request, "_obj_") and request._obj_:
            kwargs["queryset"] = TournamentTeam.objects.filter(tournament=request._obj_.tournament)
        return super().formfield_for_manytomany(db_field, request, **kwargs)
