from rest_framework import permissions


class IsOwnerAdminOrTournamentLocked(permissions.BasePermission):
    """
    Permission to allow:
    - Owners to view/edit their own entry.
    - Admins to view/edit everything.
    - Other users to VIEW only if the tournament is locked.
    """

    message = "Permission Denied"

    def has_object_permission(self, request, view, obj):
        # 1. Admins/Superusers get full access
        if request.user.is_staff or request.user.is_superuser:
            return True

        # 2. Owners get full access
        if obj.user == request.user:
            return True

        # 3. For everyone else, only allow READ (GET, HEAD, OPTIONS)
        # and only if the tournament is locked.
        if request.method in permissions.SAFE_METHODS:
            # grants permission if tournament is locked, i.e. after tournament starts
            if not obj.tournament.is_locked:
                self.message = "You cannot view another user's entry until the tournament is locked!"
            else:
                return True

        return False
