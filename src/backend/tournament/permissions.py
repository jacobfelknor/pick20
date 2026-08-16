from rest_framework import permissions


class IsAdminUser(permissions.BasePermission):
    """
    Permission to only allow admin users.
    """
    message = "Only administrators are allowed to perform this action."

    def has_permission(self, request, view):
        return bool(request.user and (request.user.is_staff or request.user.is_superuser))


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Permission to allow:
    - Anyone (who is authenticated) to read.
    - Admins to write.
    """
    message = "Only administrators can perform write operations."

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(request.user and (request.user.is_staff or request.user.is_superuser))


class IsOwnerOrTournamentLocked(permissions.BasePermission):
    """
    Permission to allow:
    - Owners to view/edit their own entry.
    - Other users to VIEW only if the tournament is locked.
    """

    message = "Permission Denied"

    def has_object_permission(self, request, view, obj):

        # Admins get full access
        if request.user and (request.user.is_staff or request.user.is_superuser):
            return True

        # Owners get full access
        if obj.user == request.user:
            return True

        # For everyone else, only allow READ (GET, HEAD, OPTIONS)
        # and only if the tournament is locked.
        if request.method in permissions.SAFE_METHODS:
            # grants permission if tournament is locked, i.e. after tournament starts
            if not obj.tournament.is_locked:
                self.message = "You cannot view another user's entry until the tournament is locked!"
                return False
            else:
                return True

        return False
