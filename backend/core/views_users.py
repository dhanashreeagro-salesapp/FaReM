from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import User, SystemAuditLog
from .serializers import UserSerializer
from .permissions import IsAdminUser

class UserViewSet(viewsets.ModelViewSet):
    """
    User Management Endpoint.
    List/Retrieve accessible to all authenticated users for staff dropdowns and views.
    Mutations (Create/Update/Delete) restricted to Admin users.
    """
    serializer_class = UserSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['mobile_number', 'employee_id', 'first_name', 'last_name', 'email', 'territory__name']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminUser()]

    def get_queryset(self):
        return User.objects.all().select_related('territory', 'reporting_manager')


    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Users aren't created by themselves, admin assigns role at creation
        user = serializer.save()
        
        SystemAuditLog.objects.create(
            entity_type='User',
            entity_id=str(user.id),
            action_type='Create',
            new_value=f"Created user {user.mobile_number} as {user.role}",
            user_id=str(request.user.id)
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsAdminUser])
    def download_template(self, request):
        import pandas as pd
        from django.http import HttpResponse
        from io import BytesIO

        df = pd.DataFrame(columns=['Employee ID', 'Name', 'Mobile Number', 'Designation', 'Territory'])
        buffer = BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        
        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="users_import_template.xlsx"'
        return response

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsAdminUser])
    def upload_for_validation(self, request):
        if 'file' not in request.FILES:
            return Response({"error": "excel file is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        file_obj = request.FILES['file']
        
        import os
        from django.conf import settings
        import_dir = os.path.join(settings.BASE_DIR, 'media', 'imports')
        os.makedirs(import_dir, exist_ok=True)
        file_path = os.path.join(import_dir, f"users_{request.user.id}_{file_obj.name}")
        
        with open(file_path, 'wb+') as destination:
            for chunk in file_obj.chunks():
                destination.write(chunk)
        
        from .models import ImportJob
        import_job = ImportJob.objects.create(
            created_by=request.user,
            filename=file_path,
            status='Processing'
        )
        
        from .tasks import validate_user_import
        validate_user_import.delay(str(import_job.id))
        
        return Response({"message": "Validation started", "import_job_id": str(import_job.id)}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsAdminUser])
    def commit_import(self, request):
        import_job_id = request.data.get('import_job_id')
        is_acknowledged = request.data.get('is_acknowledged', False)
        
        from .models import ImportJob
        try:
            job = ImportJob.objects.get(id=import_job_id, created_by=request.user)
        except ImportJob.DoesNotExist:
            return Response({"error": "Import job not found"}, status=status.HTTP_404_NOT_FOUND)
            
        if job.status != 'Pending':
             return Response({"error": "Job is not in a committable state"}, status=status.HTTP_400_BAD_REQUEST)
             
        job.status = 'Processing'
        job.is_acknowledged = is_acknowledged
        job.save()
        
        from .tasks import commit_user_import
        commit_user_import.delay(str(job.id))
        
        return Response({"message": "Import commit started", "import_job_id": str(job.id)})

    def destroy(self, request, *args, **kwargs):
        # Soft delete instead of hard delete
        instance = self.get_object()
        instance.status = 'Inactive'
        instance.save(update_fields=['status'])
        
        SystemAuditLog.objects.create(
            entity_type='User',
            entity_id=str(instance.id),
            field_changed='status',
            old_value='Active',
            new_value='Inactive',
            action_type='Update',
            user_id=str(request.user.id)
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsAdminUser])
    def enable(self, request, pk=None):
        instance = self.get_object()
        instance.status = 'Active'
        instance.save(update_fields=['status'])
        
        SystemAuditLog.objects.create(
            entity_type='User',
            entity_id=str(instance.id),
            field_changed='status',
            old_value='Inactive',
            new_value='Active',
            action_type='Update',
            user_id=str(request.user.id)
        )
        return Response({"status": "User enabled"}, status=status.HTTP_200_OK)
