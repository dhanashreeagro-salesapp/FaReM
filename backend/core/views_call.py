from django.utils import timezone
from django.db.models import Q
from rest_framework import viewsets, status, filters
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import CallLog, Farmer, User, Role, SystemAuditLog
from .serializers_call import CallLogSerializer

class CallLogViewSet(viewsets.ModelViewSet):
    serializer_class = CallLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['farmer__full_name', 'farmer__primary_mobile', 'outcome', 'notes', 'direction']
    ordering = ['-call_time']

    def get_queryset(self):
        user = self.request.user
        if user.role in [Role.ADMIN, Role.CONTENT_TEAM]:
            qs = CallLog.objects.all()
        else:
            team_users = user.get_team_users()
            territories = []
            if user.territory:
                territories.extend(user.territory.get_all_sub_territories())
            for mt in user.managed_territories.all():
                territories.extend(mt.get_all_sub_territories())
            territories = list(set(territories))
            if territories:
                qs = CallLog.objects.filter(Q(staff__in=team_users) | Q(farmer__assigned_staff__in=team_users) | Q(farmer__territory__in=territories))
            else:
                qs = CallLog.objects.filter(Q(staff__in=team_users) | Q(farmer__assigned_staff__in=team_users))


        farmer_id = self.request.query_params.get('farmer_id')
        if farmer_id:
            qs = qs.filter(farmer_id=farmer_id)
        return qs.select_related('farmer', 'staff')

    def create(self, request, *args, **kwargs):
        farmer_id = request.data.get('farmer')
        direction = request.data.get('direction', 'Outgoing')
        duration = request.data.get('duration', 60)
        outcome = request.data.get('outcome', 'Other')
        notes = request.data.get('notes', '')
        next_action = request.data.get('next_action', '')
        followup_date = request.data.get('followup_date')

        try:
            farmer = Farmer.objects.get(id=farmer_id)
        except Farmer.DoesNotExist:
            return Response({"error": "Farmer not found"}, status=status.HTTP_404_NOT_FOUND)

        call_log = CallLog.objects.create(
            farmer=farmer,
            staff=request.user,
            direction=direction,
            call_time=timezone.now(),
            duration=duration,
            outcome=outcome,
            notes=notes,
            next_action=next_action,
            followup_date=followup_date if followup_date else None
        )

        SystemAuditLog.objects.create(
            entity_type='CallLog',
            entity_id=str(call_log.id),
            action_type='Create',
            new_value=f"Logged {direction} call with {farmer.full_name} ({outcome})",
            user_id=str(request.user.id)
        )

        serializer = self.get_serializer(call_log)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
