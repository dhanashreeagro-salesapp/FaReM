from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import Farmer, FieldVisit, CallLog, Recommendation, RecommendationMessage, SystemAuditLog
from .serializers_visit import FieldVisitSerializer
from .serializers_call import CallLogSerializer
from .serializers_recommendation import RecommendationSerializer

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def farmer_timeline_view(request, farmer_id):
    """
    Unified Activity Timeline Endpoint for a Farmer.
    Merges Field Visits, Calls, Recommendations, Messages, and Audit Logs chronologically.
    """
    try:
        farmer = Farmer.objects.get(id=farmer_id)
    except Farmer.DoesNotExist:
        return Response({"error": "Farmer not found"}, status=status.HTTP_404_NOT_FOUND)

    timeline_items = []

    # 1. Field Visits
    visits = FieldVisit.objects.filter(farmer=farmer).select_related('staff', 'plot').prefetch_related('photos')
    for v in visits:
        photos = [p.photo_url for p in v.photos.all()]
        timeline_items.append({
            "id": f"visit_{v.id}",
            "type": "Visit",
            "icon": "MapPin",
            "timestamp": v.created_at.isoformat(),
            "staff_name": f"{v.staff.first_name} {v.staff.last_name}".strip() if v.staff else "System",
            "title": f"Field Visit ({v.purpose})",
            "details": {
                "purpose": v.purpose,
                "notes": v.notes,
                "status": v.status,
                "duration_minutes": v.duration_minutes,
                "inside_radius": v.inside_radius,
                "distance_from_plot": str(v.distance_from_plot) if v.distance_from_plot else None,
                "photos": photos,
                "plot_name": v.plot.plot_name if v.plot else None
            }
        })

    # 2. Call Logs
    calls = CallLog.objects.filter(farmer=farmer).select_related('staff')
    for c in calls:
        timeline_items.append({
            "id": f"call_{c.id}",
            "type": "Call",
            "icon": "PhoneCall",
            "timestamp": c.call_time.isoformat(),
            "staff_name": f"{c.staff.first_name} {c.staff.last_name}".strip() if c.staff else "System",
            "title": f"{c.direction} Call ({c.outcome})",
            "details": {
                "direction": c.direction,
                "outcome": c.outcome,
                "duration_seconds": c.duration,
                "notes": c.notes,
                "next_action": c.next_action,
                "followup_date": str(c.followup_date) if c.followup_date else None
            }
        })

    # 3. Recommendations & Messages
    recs = Recommendation.objects.filter(farmer=farmer).select_related('created_by_user', 'crop', 'stage', 'product').prefetch_related('messages')
    for r in recs:
        timeline_items.append({
            "id": f"rec_{r.id}",
            "type": "Recommendation",
            "icon": "Award",
            "timestamp": r.timestamp.isoformat(),
            "staff_name": f"{r.created_by_user.first_name} {r.created_by_user.last_name}".strip() if r.created_by_user else "System",
            "title": f"Recommendation ({r.product_name})",
            "details": {
                "product_name": r.product_name,
                "dose": f"{r.dose} {r.dose_unit or ''}".strip(),
                "timing": r.timing,
                "application_method": r.application_method,
                "notes": r.notes,
                "priority": r.priority,
                "review_status": r.review_status,
                "channel": r.channel,
                "messages_count": r.messages.count()
            }
        })
        for msg in r.messages.all():
            timeline_items.append({
                "id": f"msg_{msg.id}",
                "type": f"{msg.channel} Message",
                "icon": "MessageSquare" if msg.channel == 'WhatsApp' else "Send",
                "timestamp": (msg.sent_time or msg.created_at).isoformat(),
                "staff_name": f"{r.created_by_user.first_name} {r.created_by_user.last_name}".strip() if r.created_by_user else "System",
                "title": f"{msg.channel} Sent ({msg.status})",
                "details": {
                    "channel": msg.channel,
                    "status": msg.status,
                    "content": msg.content,
                    "delivery_status": msg.delivery_status
                }
            })

    # Sort all timeline items chronologically (newest first)
    timeline_items.sort(key=lambda x: x["timestamp"], reverse=True)

    page = int(request.query_params.get('page', 1))
    page_size = int(request.query_params.get('page_size', 20))
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size

    paginated_items = timeline_items[start_idx:end_idx]

    return Response({
        "farmer_id": str(farmer.id),
        "farmer_name": farmer.full_name,
        "total_activities": len(timeline_items),
        "page": page,
        "page_size": page_size,
        "has_next": end_idx < len(timeline_items),
        "timeline": paginated_items
    }, status=status.HTTP_200_OK)
