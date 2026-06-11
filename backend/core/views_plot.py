from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta
from .models import Plot, CropSeason, StageChangeLog, CropStage, Role
from .serializers_plot import PlotSerializer, CropSeasonSerializer, StageChangeLogSerializer
from .permissions import IsStaffOrManagerOrAdmin

class PlotViewSet(viewsets.ModelViewSet):
    serializer_class = PlotSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Plot.objects.none()
        if user.role in [Role.ADMIN, Role.ZONAL_MANAGER, Role.CONTENT_TEAM]:
            queryset = Plot.objects.all()
        elif user.role == Role.TERRITORY_MANAGER:
            territories = []
            if user.territory:
                territories.extend(user.territory.get_all_sub_territories())
            for managed_territory in user.managed_territories.all():
                territories.extend(managed_territory.get_all_sub_territories())
            territories = list(set(territories))
            queryset = Plot.objects.filter(farmer__territory__in=territories)
        elif user.role == Role.FIELD_STAFF:
            queryset = Plot.objects.filter(farmer__assigned_staff=user)
            
        farmer_id = self.request.query_params.get('farmer')
        if farmer_id:
            queryset = queryset.filter(farmer_id=farmer_id)
        return queryset

    def perform_create(self, serializer):
        wkt = serializer.validated_data.pop('location_wkt', None)
        # Capture any manually provided area_acres before save
        manual_area = serializer.validated_data.get('area_acres')
        plot = serializer.save()
        
        update_fields = []
        if wkt:
            from django.contrib.gis.geos import GEOSGeometry
            try:
                geom = GEOSGeometry(wkt)
                if geom.geom_type == 'Polygon':
                    plot.location = geom
                    update_fields.append('location')
                    geom_proj = geom.clone()
                    geom_proj.transform(3857)
                    sq_meters = geom_proj.area
                    plot.calculated_area_acres = round(sq_meters * 0.000247105, 4)
                    update_fields.append('calculated_area_acres')
                    if update_fields:
                        plot.save(update_fields=update_fields)
            except Exception:
                pass

    def perform_update(self, serializer):
        wkt = serializer.validated_data.pop('location_wkt', None)
        manual_area = serializer.validated_data.get('area_acres')
        plot = serializer.save()
        
        update_fields = []
        if wkt:
            from django.contrib.gis.geos import GEOSGeometry
            try:
                geom = GEOSGeometry(wkt)
                if geom.geom_type == 'Polygon':
                    plot.location = geom
                    update_fields.append('location')
                    geom_proj = geom.clone()
                    geom_proj.transform(3857)
                    sq_meters = geom_proj.area
                    plot.calculated_area_acres = round(sq_meters * 0.000247105, 4)
                    update_fields.append('calculated_area_acres')
                    if update_fields:
                        plot.save(update_fields=update_fields)
            except Exception:
                pass

class CropSeasonViewSet(viewsets.ModelViewSet):
    serializer_class = CropSeasonSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = CropSeason.objects.none()
        if user.role in [Role.ADMIN, Role.ZONAL_MANAGER, Role.CONTENT_TEAM]:
            queryset = CropSeason.objects.all()
        elif user.role == Role.TERRITORY_MANAGER:
            territories = []
            if user.territory:
                territories.extend(user.territory.get_all_sub_territories())
            for managed_territory in user.managed_territories.all():
                territories.extend(managed_territory.get_all_sub_territories())
            territories = list(set(territories))
            queryset = CropSeason.objects.filter(plot__farmer__territory__in=territories)
        elif user.role == Role.FIELD_STAFF:
            queryset = CropSeason.objects.filter(plot__farmer__assigned_staff=user)
            
        plot_id = self.request.query_params.get('plot')
        if plot_id:
            queryset = queryset.filter(plot_id=plot_id)
        return queryset

    def perform_create(self, serializer):
        season = serializer.save()
        if not season.current_stage and season.sowing_date:
            from django.utils import timezone
            today = timezone.now().date()
            days_since_sowing = (today - season.sowing_date).days

            stages = CropStage.objects.filter(crop=season.crop).order_by('sequence_number')
            cumulative_days = 0
            selected_stage = None

            for stage in stages:
                cumulative_days += stage.days_from_previous_stage
                if days_since_sowing <= cumulative_days:
                    selected_stage = stage
                    break
            
            if not selected_stage and stages.exists():
                selected_stage = stages.last()

            if selected_stage:
                season.current_stage = selected_stage
                season.save(update_fields=['current_stage'])

        self._calculate_next_stage_date(season)

    def _calculate_next_stage_date(self, season):
        if not season.current_stage:
            return

        next_stages = CropStage.objects.filter(
            crop=season.crop, 
            sequence_number__gt=season.current_stage.sequence_number
        ).order_by('sequence_number')
        
        next_stage = next_stages.first()

        if next_stage:
            # Formula: SowingDate + Σ(DaysFromPreviousStage) for stages 1 through N+1
            # First, get all stages up to and including the next stage
            all_stages_up_to_next = CropStage.objects.filter(
                crop=season.crop,
                sequence_number__lte=next_stage.sequence_number
            ).order_by('sequence_number')
            
            total_days = sum(s.days_from_previous_stage for s in all_stages_up_to_next)
            season.expected_next_stage_date = season.sowing_date + timedelta(days=total_days)
            season.save(update_fields=['expected_next_stage_date'])

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsStaffOrManagerOrAdmin])
    def advance_stage(self, request, pk=None):
        season = self.get_object()
        
        # User confirmation is required before this API is called (handled in frontend logic)
        
        old_stage = season.current_stage
        if not old_stage:
            return Response({"error": "Current stage is not set"}, status=status.HTTP_400_BAD_REQUEST)
            
        next_stage = CropStage.objects.filter(
            crop=season.crop, 
            sequence_number__gt=old_stage.sequence_number
        ).order_by('sequence_number').first()
        
        if not next_stage:
            return Response({"error": "Already at final stage"}, status=status.HTTP_400_BAD_REQUEST)

        # Update stage
        season.current_stage = next_stage
        season.save(update_fields=['current_stage'])
        self._calculate_next_stage_date(season)

        # Record Audit
        StageChangeLog.objects.create(
            season=season,
            from_stage=old_stage,
            to_stage=next_stage,
            changed_by_user=request.user
        )

        return Response({"message": "Stage advanced successfully", "new_stage": next_stage.id}, status=status.HTTP_200_OK)
