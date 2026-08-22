from rest_framework import viewsets, views, permissions
from rest_framework.response import Response
from django.db.models import Sum, Q
from django.contrib.gis.geos import Point, LineString
import requests

from core.models import RouteCorridor, Farmer, Plot
from core.serializers_route import RouteCorridorSerializer, BigFarmerSerializer

class RouteCorridorViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Route Corridors.
    In a real implementation, this would integrate with Google Maps Directions API.
    """
    serializer_class = RouteCorridorSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return RouteCorridor.objects.filter(staff=self.request.user)

    def perform_create(self, serializer):
        # Google Maps integration would happen here to build the polyline.
        # For MVP, we save the user-defined start and end points.
        serializer.save(staff=self.request.user)

    def list(self, request, *args, **kwargs):
        # Override to potentially include plots within distance of polyline
        return super().list(request, *args, **kwargs)

class BigFarmerDirectoryView(views.APIView):
    """
    Returns Top/Big Farmers in a specified village, ranked by acreage.
    Excludes plots with missing acreage as per requirements.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        village = request.query_params.get('village')
        if not village:
            return Response({'error': 'Village parameter is required'}, status=400)

        # Get farmers assigned to this user (or territory)
        user_portfolio = request.user.get_team_users()
        
        # Calculate total acreage from plots that HAVE acreage
        farmers_with_acreage = Farmer.objects.filter(
            village__iexact=village,
            assigned_staff__in=user_portfolio,
            status='Active'
        ).annotate(
            total_acreage=Sum('plots__area_acres', filter=Q(plots__area_acres__isnull=False, plots__is_active=True))
        ).filter(
            total_acreage__gt=0  # Omits missing or zero acreage
        ).order_by('-total_acreage')
        
        serializer = BigFarmerSerializer(farmers_with_acreage, many=True)
        return Response(serializer.data)
