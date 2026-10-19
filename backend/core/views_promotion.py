from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, BasePermission, SAFE_METHODS
from .models import PromotionLibrary, ImportJob
from .serializers_promotion import PromotionLibrarySerializer
from .permissions import IsAdminOrContentTeam

class IsAdminOrContentOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return IsAdminOrContentTeam().has_permission(request, view)

class PromotionLibraryViewSet(viewsets.ModelViewSet):
    """
    CRUD endpoint for Content team and Admin. Readonly for others.
    Supports multi-crop, multi-stage, generic stages, and multi-product promotions.
    """
    serializer_class = PromotionLibrarySerializer
    permission_classes = [IsAuthenticated, IsAdminOrContentOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = [
        'title',
        'content_type',
        'category',
        'crops__crop_name',
        'stages__stage_name',
        'related_products__name',
        'crop__crop_name',
        'stage__stage_name',
    ]

    def get_queryset(self):
        import uuid
        from django.db.models import Q

        def is_valid_uuid(val):
            try:
                uuid.UUID(str(val))
                return True
            except (ValueError, AttributeError):
                return False

        qs = (
            PromotionLibrary.objects
            .prefetch_related('crops', 'stages', 'related_products')
            .select_related('crop', 'stage')
            .order_by('-created_at')
        )

        crop_param = self.request.query_params.get('crop')
        if crop_param:
            crop_param = crop_param.strip()
            include_general = self.request.query_params.get('include_general', 'true').lower() in ['true', '1']
            if is_valid_uuid(crop_param):
                crop_q = Q(crops__id=crop_param) | Q(crop__id=crop_param)
            else:
                crop_q = Q(crops__crop_name__icontains=crop_param) | Q(crop__crop_name__icontains=crop_param)
            if include_general:
                crop_q |= Q(crops__isnull=True, crop__isnull=True)
            qs = qs.filter(crop_q)

        stage_param = self.request.query_params.get('stage')
        if stage_param:
            stage_param = stage_param.strip()
            if is_valid_uuid(stage_param):
                stage_q = Q(stages__id=stage_param) | Q(stage__id=stage_param)
            else:
                stage_q = (
                    Q(stages__stage_name__icontains=stage_param) |
                    Q(stage__stage_name__icontains=stage_param) |
                    Q(target_stages__icontains=stage_param)
                )
            qs = qs.filter(stage_q)

        product_param = self.request.query_params.get('product')
        if product_param:
            product_param = product_param.strip()
            if is_valid_uuid(product_param):
                prod_q = Q(related_products__id=product_param)
            else:
                prod_q = Q(related_products__name__icontains=product_param)
            qs = qs.filter(prod_q)

        content_type = self.request.query_params.get('content_type')
        if content_type:
            qs = qs.filter(content_type__iexact=content_type.strip())

        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category__iexact=category.strip())

        return qs.distinct()

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsAdminOrContentTeam])
    def download_template(self, request):
        import pandas as pd
        from django.http import HttpResponse
        from io import BytesIO

        sample_data = [
            {
                'Title': 'Vegetative Stage Nutrition Guide',
                'ContentType': 'PDF',
                'FileURL': 'https://example.com/guides/vegetative_nutrition.pdf',
                'Category': 'Product',
                'Crop': 'Tomato, Chilli, Brinjal',
                'Stage': 'Vegetative Stage',
                'Product': 'NPK 19-19-19, Micronutrient Mix',
                'WhatsAppTemplate': 'vegetative_nutrition_wa',
                'SMSTemplate': 'vegetative_nutrition_sms',
            },
            {
                'Title': 'Universal Flowering Booster Video',
                'ContentType': 'Video',
                'FileURL': 'https://youtube.com/watch?v=sample123',
                'Category': 'Product',
                'Crop': '',  # Blank = All Crops / General
                'Stage': 'Flowering Stage, Fruit Setting',
                'Product': 'Flower Plus',
                'WhatsAppTemplate': '',
                'SMSTemplate': '',
            },
            {
                'Title': 'Pest Management for Fruit Development',
                'ContentType': 'Image',
                'FileURL': 'https://example.com/images/pest_alert.png',
                'Category': 'Product',
                'Crop': 'Tomato, Pomegranate',
                'Stage': 'Fruit Development, Fruit Setting',
                'Product': 'Bio-Shield',
                'WhatsAppTemplate': '',
                'SMSTemplate': '',
            }
        ]
        df = pd.DataFrame(sample_data)
        buffer = BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)

        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="promotion_content_template.xlsx"'
        return response

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsAdminOrContentTeam])
    def upload_for_validation(self, request):
        if 'file' not in request.FILES:
            return Response({"error": "excel file is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        file_obj = request.FILES['file']
        
        import os
        from django.conf import settings
        import_dir = os.path.join(settings.BASE_DIR, 'media', 'imports')
        os.makedirs(import_dir, exist_ok=True)
        file_path = os.path.join(import_dir, f"promos_{request.user.id}_{file_obj.name}")
        
        with open(file_path, 'wb+') as destination:
            for chunk in file_obj.chunks():
                destination.write(chunk)
        
        import_job = ImportJob.objects.create(
            created_by=request.user,
            filename=file_path,
            status='Processing'
        )
        
        from .tasks import validate_promotion_import
        validate_promotion_import.delay(str(import_job.id))
        
        return Response({"message": "Validation started", "import_job_id": str(import_job.id)}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsAdminOrContentTeam])
    def commit_import(self, request):
        import_job_id = request.data.get('import_job_id')
        
        try:
            job = ImportJob.objects.get(id=import_job_id, created_by=request.user)
        except ImportJob.DoesNotExist:
            return Response({"error": "Import job not found"}, status=status.HTTP_404_NOT_FOUND)
            
        if job.status != 'Pending':
             return Response({"error": "Job is not in a committable state"}, status=status.HTTP_400_BAD_REQUEST)
             
        job.status = 'Processing'
        job.save()
        
        from .tasks import commit_promotion_import
        commit_promotion_import.delay(str(job.id))
        
        return Response({"message": "Import commit started", "import_job_id": str(job.id)})
