from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated, BasePermission, SAFE_METHODS
from .models import CropMaster, CropVariety, CropStage
from .serializers_crop import CropMasterSerializer, CropVarietySerializer, CropStageSerializer
from .permissions import IsAdminUser

class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return IsAdminUser().has_permission(request, view)

class CropMasterViewSet(viewsets.ModelViewSet):
    serializer_class = CropMasterSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        return CropMaster.objects.all().prefetch_related('varieties', 'stages')


class CropVarietyViewSet(viewsets.ModelViewSet):
    queryset = CropVariety.objects.all()
    serializer_class = CropVarietySerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]

class CropStageViewSet(viewsets.ModelViewSet):
    queryset = CropStage.objects.all()
    serializer_class = CropStageSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]
