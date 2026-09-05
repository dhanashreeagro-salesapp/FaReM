from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, BasePermission, SAFE_METHODS
from django.http import HttpResponse
import base64
import re
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
        
    from rest_framework.permissions import AllowAny
    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def image(self, request, pk=None):
        crop = self.get_object()
        if not crop.reference_image or not crop.reference_image.startswith('data:image'):
            return HttpResponse(status=404)
        
        # reference_image format: data:image/jpeg;base64,....
        match = re.match(r'^data:(image/[^;]+);base64,(.+)$', crop.reference_image)
        if not match:
            return HttpResponse(status=404)
            
        mime_type = match.group(1)
        base64_data = match.group(2)
        
        try:
            image_data = base64.b64decode(base64_data)
        except Exception:
            return HttpResponse(status=500)
            
        response = HttpResponse(image_data, content_type=mime_type)
        response['Cache-Control'] = 'public, max-age=31536000, immutable'
        return response


class CropVarietyViewSet(viewsets.ModelViewSet):
    queryset = CropVariety.objects.all()
    serializer_class = CropVarietySerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]

class CropStageViewSet(viewsets.ModelViewSet):
    queryset = CropStage.objects.all()
    serializer_class = CropStageSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]
