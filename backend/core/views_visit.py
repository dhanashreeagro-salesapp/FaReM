import math
from datetime import timedelta
from django.utils import timezone
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import FieldVisit, VisitPhoto, Farmer, Plot, User, Role, AppConfiguration, SystemAuditLog
from .serializers_visit import FieldVisitSerializer, VisitPhotoSerializer

def calculate_haversine_distance(lat1, lon1, lat2, lon2):
    """Calculates distance between two lat/lon pairs in meters using Haversine formula."""
    try:
        R = 6371000  # Radius of Earth in meters
        phi1 = math.radians(float(lat1))
        phi2 = math.radians(float(lat2))
        delta_phi = math.radians(float(lat2) - float(lat1))
        delta_lambda = math.radians(float(lon2) - float(lon1))

        a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return round(R * c, 2)
    except Exception:
        return 0.0

class FieldVisitViewSet(viewsets.ModelViewSet):
    serializer_class = FieldVisitSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['farmer__full_name', 'farmer__primary_mobile', 'purpose', 'notes', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        if user.role in [Role.ADMIN, Role.ZONAL_MANAGER, Role.CONTENT_TEAM]:
            qs = FieldVisit.objects.all()
        elif user.role == Role.TERRITORY_MANAGER:
            territories = []
            if user.territory:
                territories.extend(user.territory.get_all_sub_territories())
            for mt in user.managed_territories.all():
                territories.extend(mt.get_all_sub_territories())
            qs = FieldVisit.objects.filter(farmer__territory__in=list(set(territories)))
        else:
            qs = FieldVisit.objects.filter(staff=user)

        farmer_id = self.request.query_params.get('farmer_id')
        if farmer_id:
            qs = qs.filter(farmer_id=farmer_id)
        return qs.select_related('farmer', 'plot', 'staff')

    def create(self, request, *args, **kwargs):
        config = AppConfiguration.get_config()
        radius_limit = config.visit_radius_meters or 150
        mode = config.gps_validation_mode or 'Warning'

        farmer_id = request.data.get('farmer')
        plot_id = request.data.get('plot')
        lat = request.data.get('latitude', 0.0)
        lon = request.data.get('longitude', 0.0)
        purpose = request.data.get('purpose', 'Routine Visit')
        notes = request.data.get('notes', '')
        is_check_in = request.data.get('is_check_in', False)

        try:
            farmer = Farmer.objects.get(id=farmer_id)
        except Farmer.DoesNotExist:
            return Response({"error": "Farmer not found"}, status=status.HTTP_404_NOT_FOUND)

        plot = None
        distance_from_plot = 0.0
        if plot_id:
            try:
                plot = Plot.objects.get(id=plot_id)
                if plot.location:
                    distance_from_plot = calculate_haversine_distance(lat, lon, plot.location.y, plot.location.x)
            except Exception:
                pass

        inside_radius = distance_from_plot <= radius_limit if plot else True
        visit_status = 'Verified' if inside_radius else 'Outside Radius'

        if is_check_in:
            visit_status = 'Pending Check-Out'

        if mode == 'Strict' and not inside_radius and not is_check_in:
            return Response({
                "error": f"Visit location is {distance_from_plot}m away from plot, exceeding the allowed {radius_limit}m limit (Strict Mode enabled)."
            }, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        visit = FieldVisit.objects.create(
            farmer=farmer,
            plot=plot,
            staff=request.user,
            purpose=purpose,
            notes=notes,
            status=visit_status,
            check_in_time=now,
            latitude=lat,
            longitude=lon,
            gps_accuracy=request.data.get('gps_accuracy', 5.0),
            distance_from_plot=distance_from_plot,
            inside_radius=inside_radius,
            created_by=request.user
        )

        SystemAuditLog.objects.create(
            entity_type='FieldVisit',
            entity_id=str(visit.id),
            action_type='Create',
            new_value=f"Logged visit for {farmer.full_name} ({purpose}, {visit_status})",
            user_id=str(request.user.id)
        )

        serializer = self.get_serializer(visit)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def check_out(self, request, pk=None):
        visit = self.get_object()
        now = timezone.now()
        visit.check_out_time = now
        
        if visit.check_in_time:
            diff = now - visit.check_in_time
            visit.duration_minutes = max(1, int(diff.total_seconds() / 60))

        if visit.status == 'Pending Check-Out':
            visit.status = 'Verified' if visit.inside_radius else 'Outside Radius'

        visit.notes = request.data.get('notes', visit.notes)
        visit.save()

        SystemAuditLog.objects.create(
            entity_type='FieldVisit CheckOut',
            entity_id=str(visit.id),
            action_type='Update',
            new_value=f"Checked out visit {visit.id}. Duration: {visit.duration_minutes} mins",
            user_id=str(request.user.id)
        )

        serializer = self.get_serializer(visit)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def upload_photo(self, request, pk=None):
        visit = self.get_object()
        photo_url = request.data.get('photo_url')
        thumbnail_url = request.data.get('thumbnail_url', photo_url)

        if not photo_url:
            return Response({"error": "photo_url is required"}, status=status.HTTP_400_BAD_REQUEST)

        photo = VisitPhoto.objects.create(
            visit=visit,
            photo_url=photo_url,
            thumbnail_url=thumbnail_url
        )
        visit.photo_count = visit.photos.count()
        visit.save(update_fields=['photo_count'])

        return Response(VisitPhotoSerializer(photo).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def weekly_summary(self, request):
        now = timezone.now()
        start_of_week = now - timedelta(days=now.weekday())
        start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)

        user_visits = FieldVisit.objects.filter(staff=request.user, created_at__gte=start_of_week)
        total_visits = user_visits.count()
        unique_farmers = user_visits.values('farmer_id').distinct().count()

        total_minutes = sum([v.duration_minutes or 15 for v in user_visits])
        hours_spent = round(total_minutes / 60.0, 1)
        avg_duration = round(total_minutes / max(1, total_visits), 1)

        purpose_counts = {}
        for v in user_visits:
            purpose_counts[v.purpose] = purpose_counts.get(v.purpose, 0) + 1

        return Response({
            "start_of_week": start_of_week.strftime('%Y-%m-%d'),
            "total_visits": total_visits,
            "unique_farmers": unique_farmers,
            "hours_spent": hours_spent,
            "average_duration_minutes": avg_duration,
            "purpose_breakdown": purpose_counts,
            "estimated_distance_km": round(total_visits * 4.2, 1) # Estimated travel
        })
