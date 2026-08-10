from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from .models import Farmer, Role
from .serializers_farmer import FarmerSerializer
from .permissions import IsAdminUser
from django.db.models import Q
from django.core.cache import cache

class FarmerPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200

class FarmerViewSet(viewsets.ModelViewSet):
    serializer_class = FarmerSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = FarmerPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['full_name', 'primary_mobile', 'village', 'taluka', 'district', 'pin_code', 'assigned_staff__mobile_number', 'assigned_staff__email', 'assigned_staff__first_name', 'assigned_staff__last_name']
    ordering_fields = ['full_name', 'village', 'taluka', 'district', 'pin_code', 'primary_mobile', 'assigned_staff__first_name', 'acquisition_date']
    ordering = ['full_name']

    def get_queryset(self):
        user = self.request.user
        if user.role in [Role.ADMIN, Role.CONTENT_TEAM]:
            queryset = Farmer.objects.all()
        else:
            team_users = user.get_team_users()
            territories = []
            if user.territory:
                territories.extend(user.territory.get_all_sub_territories())
            for managed_territory in user.managed_territories.all():
                territories.extend(managed_territory.get_all_sub_territories())
            territories = list(set(territories))
            
            if territories:
                queryset = Farmer.objects.filter(Q(assigned_staff__in=team_users) | Q(territory__in=territories))
            else:
                queryset = Farmer.objects.filter(assigned_staff__in=team_users)

        queryset = queryset.select_related('assigned_staff', 'territory')

        # Filters for location and assignment
        pin_code = self.request.query_params.get('pin_code')
        village = self.request.query_params.get('village')
        taluka = self.request.query_params.get('taluka')
        district = self.request.query_params.get('district')
        territory_id = self.request.query_params.get('territory')
        assigned_staff_param = self.request.query_params.get('assigned_staff')

        if pin_code:
            queryset = queryset.filter(pin_code__icontains=pin_code.strip())
        if village:
            queryset = queryset.filter(village__icontains=village.strip())
        if taluka:
            queryset = queryset.filter(taluka__icontains=taluka.strip())
        if district:
            queryset = queryset.filter(district__icontains=district.strip())
        if territory_id:
            queryset = queryset.filter(territory_id=territory_id)
        if assigned_staff_param:
            if assigned_staff_param == 'unassigned':
                queryset = queryset.filter(assigned_staff__isnull=True)
            else:
                queryset = queryset.filter(assigned_staff_id=assigned_staff_param)

        crop_name = self.request.query_params.get('crop')
        stage_name = self.request.query_params.get('stage')
        enrolled = self.request.query_params.get('enrolled')
        has_active_crops = self.request.query_params.get('has_active_crops')
        has_plots = self.request.query_params.get('has_plots')

        if enrolled:
            from django.utils import timezone
            import datetime
            now = timezone.now()
            if enrolled == 'this_month':
                queryset = queryset.filter(date_added__year=now.year, date_added__month=now.month)
            elif enrolled == 'last_month':
                last_month = now.month - 1 if now.month > 1 else 12
                year = now.year if now.month > 1 else now.year - 1
                queryset = queryset.filter(date_added__year=year, date_added__month=last_month)
            elif enrolled == 'ytd':
                start_year = now.year if now.month >= 4 else now.year - 1
                start_date = datetime.datetime(start_year, 4, 1, tzinfo=timezone.utc)
                queryset = queryset.filter(date_added__gte=start_date)

        if has_active_crops == 'true':
            queryset = queryset.filter(plots__is_active=True, plots__seasons__status='Active').distinct()

        if has_plots == 'true':
            queryset = queryset.filter(plots__isnull=False).distinct()

        if crop_name or stage_name:
            plot_filters = {'plots__is_active': True, 'plots__seasons__status': 'Active'}
            if crop_name:
                plot_filters['plots__seasons__crop__crop_name'] = crop_name
            if stage_name:
                if stage_name.lower() == 'unknown':
                    plot_filters['plots__seasons__current_stage__isnull'] = True
                else:
                    plot_filters['plots__seasons__current_stage__stage_name'] = stage_name
            queryset = queryset.filter(**plot_filters).distinct()

        return queryset.select_related('assigned_staff', 'territory')


    def create(self, request, *args, **kwargs):
        # Validate acquisition_date if provided
        acquisition_date_str = request.data.get('acquisition_date')
        if acquisition_date_str:
            from django.utils import timezone
            import datetime
            try:
                acq_date = datetime.datetime.strptime(str(acquisition_date_str)[:10], '%Y-%m-%d').date()
                if acq_date > timezone.now().date():
                    return Response({"acquisition_date": ["Created On date cannot be in the future"]}, status=status.HTTP_400_BAD_REQUEST)
            except ValueError:
                pass

        primary_mobile = str(request.data.get('primary_mobile', '')).strip()
        
        # If farmer with this mobile number already exists, update details and assign to current user
        existing_farmer = Farmer.objects.filter(primary_mobile=primary_mobile).first() if primary_mobile else None
        if existing_farmer:
            serializer = self.get_serializer(existing_farmer, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            assigned = request.user if request.user.role != Role.ADMIN else (existing_farmer.assigned_staff or request.user)
            serializer.save(assigned_staff=assigned)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # Create new farmer and default assigned_staff to requesting user if not provided
        data = request.data.copy()
        assigned_val = data.get('assigned_staff')
        if not assigned_val or str(assigned_val).strip() in ['', 'null', 'undefined']:
            data['assigned_staff'] = str(request.user.id)

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        saved_assigned = serializer.validated_data.get('assigned_staff') or request.user
        farmer_obj = serializer.save(assigned_staff=saved_assigned)

        # Invalidate cached dashboard stats across nodes
        try:
            cache.clear()
        except Exception:
            pass

        return Response(self.get_serializer(farmer_obj).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        if self.request.user.role == Role.ADMIN:
            instance.status = 'Inactive'
            instance.save()

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsAdminUser])
    def download_template(self, request):
        import pandas as pd
        from django.http import HttpResponse
        from io import BytesIO

        df = pd.DataFrame(columns=['FullName', 'PrimaryMobile', 'Village', 'Taluka', 'District', 'State', 'PinCode', 'StaffMobile', 'AcquisitionDate', 'Source'])
        buffer = BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        
        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="farmers_import_template.xlsx"'
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
        file_path = os.path.join(import_dir, f"{request.user.id}_{file_obj.name}")
        
        with open(file_path, 'wb+') as destination:
            for chunk in file_obj.chunks():
                destination.write(chunk)
        
        from .models import ImportJob
        import_job = ImportJob.objects.create(
            created_by=request.user,
            filename=file_path,
            status='Processing'
        )
        
        from .tasks import validate_farmer_import
        try:
            validate_farmer_import.delay(str(import_job.id))
        except Exception:
            validate_farmer_import(str(import_job.id))
        
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
            
        if job.status != 'Pending': # Assuming Pending means 'Validation finished, waiting for commit'
             return Response({"error": "Job is not in a committable state"}, status=status.HTTP_400_BAD_REQUEST)
             
        if job.total_rows > 1000 and not is_acknowledged:
            return Response({"error": "Acknowledgment required for imports > 1000 records"}, status=status.HTTP_400_BAD_REQUEST)
            
        job.status = 'Processing'
        job.is_acknowledged = is_acknowledged
        job.save()
        
        from .tasks import commit_farmer_import
        try:
            commit_farmer_import.delay(str(job.id))
        except Exception:
            commit_farmer_import(str(job.id))
        
        return Response({"message": "Import commit started", "import_job_id": str(job.id)})


    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def request_disable(self, request, pk=None):
        farmer = self.get_object()
        
        # Optionally create a formal Request object, or just audit log the request
        # and send a notification to Admin. Here we log it as an Audit event
        # that admins monitor.
        from .models import SystemAuditLog
        SystemAuditLog.objects.create(
            entity_type='Farmer Disable Request',
            entity_id=str(farmer.id),
            field_changed='',
            old_value='',
            new_value=f'Field Staff {request.user.mobile_number} requested disable',
            action_type='Update',
            user_id=str(request.user.id)
        )
        return Response({"message": "Disable request submitted to Admin"}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def export(self, request):
        import pandas as pd
        from django.http import HttpResponse
        from io import BytesIO

        farmers = self.get_queryset()
        data = []
        for f in farmers:
            data.append({
                'Name': f.full_name,
                'Primary Mobile': f.primary_mobile,
                'Village': f.village,
                'Taluka': f.taluka,
                'District': f.district,
                'State': f.state,
                'Assigned Staff': f.assigned_staff.mobile_number if f.assigned_staff else '',
                'Acquisition Date': str(f.acquisition_date) if f.acquisition_date else '',
                'Source': f.source,
                'Status': f.status
            })
            
        df = pd.DataFrame(data)
        buffer = BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
            
        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="farmers_export.xlsx"'
        return response

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsAdminUser])
    def disable(self, request, pk=None):
        instance = self.get_object()
        instance.status = 'Inactive'
        instance.save(update_fields=['status'])
        
        from .models import SystemAuditLog
        SystemAuditLog.objects.create(
            entity_type='Farmer',
            entity_id=str(instance.id),
            field_changed='status',
            old_value='Active',
            new_value='Inactive',
            action_type='Update',
            user_id=str(request.user.id)
        )
        return Response({"status": "Farmer disabled"}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def villages(self, request):
        queryset = self.get_queryset()
        villages = queryset.exclude(village='').exclude(village__isnull=True)\
            .values('village', 'taluka', 'district')\
            .distinct().order_by('village')
        return Response(list(villages))

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def all_ids(self, request):
        queryset = self.get_queryset()
        ids = list(queryset.values_list('id', flat=True))
        return Response(ids)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsAdminUser])
    def bulk_assign(self, request):
        farmer_ids = request.data.get('farmer_ids', [])
        assigned_staff_id = request.data.get('assigned_staff_id')

        if not farmer_ids or not isinstance(farmer_ids, list):
            return Response({"error": "farmer_ids must be a non-empty list"}, status=status.HTTP_400_BAD_REQUEST)

        staff = None
        if assigned_staff_id:
            try:
                staff = User.objects.get(id=assigned_staff_id)
            except User.DoesNotExist:
                return Response({"error": "Assigned staff user not found"}, status=status.HTTP_404_NOT_FOUND)

        updated_count = Farmer.objects.filter(id__in=farmer_ids).update(assigned_staff=staff)

        from .models import SystemAuditLog
        SystemAuditLog.objects.create(
            entity_type='Farmer Bulk Reassign',
            entity_id=f'{updated_count}_farmers',
            action_type='Update',
            new_value=f'Reassigned {updated_count} farmers to {staff.email if staff else "Unassigned"}',
            user_id=str(request.user.id)
        )

        return Response({
            "message": f"Successfully reassigned {updated_count} farmers",
            "updated_count": updated_count
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def timeline(self, request, pk=None):
        farmer = self.get_object()
        from .models import FieldVisit, CallLog, Recommendation, StageChangeLog
        
        events = []
        for v in FieldVisit.objects.filter(farmer=farmer).select_related('staff', 'plot'):
            events.append({
                'id': str(v.id),
                'type': 'FieldVisit',
                'title': f"Field Visit - {v.purpose}",
                'description': v.notes or 'No visit notes',
                'user': (f"{v.staff.first_name} {v.staff.last_name}".strip() or v.staff.email) if v.staff else 'Unknown',
                'timestamp': (v.check_in_time or v.created_at).isoformat(),
                'status': v.status,
                'photo_count': v.photo_count
            })
            
        for c in CallLog.objects.filter(farmer=farmer).select_related('staff'):
            events.append({
                'id': str(c.id),
                'type': 'CallLog',
                'title': f"{c.direction} Call ({c.outcome})",
                'description': c.notes or 'No call notes',
                'user': (f"{c.staff.first_name} {c.staff.last_name}".strip() or c.staff.email) if c.staff else 'Unknown',
                'timestamp': c.call_time.isoformat() if c.call_time else None,
                'outcome': c.outcome
            })

        for r in Recommendation.objects.filter(farmer=farmer).select_related('created_by_user', 'product'):
            events.append({
                'id': str(r.id),
                'type': 'Recommendation',
                'title': f"Advisory: {r.product_name or (r.product.product_name if r.product else 'Recommendation')}",
                'description': r.notes or 'Advisory recommendation',
                'user': (f"{r.created_by_user.first_name} {r.created_by_user.last_name}".strip() or r.created_by_user.email) if r.created_by_user else 'Unknown',
                'timestamp': r.timestamp.isoformat() if r.timestamp else None,
                'status': r.review_status
            })

        for s in StageChangeLog.objects.filter(crop_season__plot__farmer=farmer).select_related('changed_by', 'new_stage'):
            events.append({
                'id': str(s.id),
                'type': 'StageChange',
                'title': f"Crop Stage Changed to {s.new_stage.stage_name if s.new_stage else 'New Stage'}",
                'description': s.notes or 'Crop stage update',
                'user': (f"{s.changed_by.first_name} {s.changed_by.last_name}".strip() or s.changed_by.email) if s.changed_by else 'System',
                'timestamp': s.date_changed.isoformat() if s.date_changed else None,
            })

        events.sort(key=lambda x: str(x['timestamp'] or ''), reverse=True)
        return Response({'timeline': events})

