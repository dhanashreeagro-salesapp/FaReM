from rest_framework import permissions
from .models import Role

class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return bool(
            request.user.role in [Role.ADMIN, 'Admin', 'ADMIN', 'admin'] or
            getattr(request.user, 'is_superuser', False) or
            getattr(request.user, 'is_staff', False)
        )


class IsFieldStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == Role.FIELD_STAFF)

class IsTerritoryManager(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == Role.TERRITORY_MANAGER)

class IsZonalManager(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == Role.ZONAL_MANAGER)

class IsContentTeam(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == Role.CONTENT_TEAM)

class IsAdminOrZonalManager(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in [Role.ADMIN, Role.ZONAL_MANAGER])

class IsAdminOrContentTeam(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in [Role.ADMIN, Role.CONTENT_TEAM])

class IsManagerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in [Role.ADMIN, Role.TERRITORY_MANAGER, Role.ZONAL_MANAGER])

class IsStaffOrManagerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in [Role.ADMIN, Role.FIELD_STAFF, Role.TERRITORY_MANAGER, Role.ZONAL_MANAGER, Role.CONTENT_TEAM])

