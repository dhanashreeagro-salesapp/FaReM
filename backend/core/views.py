import random
import string
import requests
from django.conf import settings
from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User

from django.contrib.auth import authenticate
from django.utils import timezone

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    try:
        email = str(request.data.get('email', '')).strip().lower()
        password = str(request.data.get('password', '')).strip()
        device_push_token = request.data.get('device_push_token')
        
        if not email or not password:
            return Response({"error": "email and password are required"}, status=status.HTTP_400_BAD_REQUEST)
            
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({"error": "Invalid email or password"}, status=status.HTTP_404_NOT_FOUND)
            
        if user.status == 'Inactive':
            return Response({"error": "Account is inactive. Contact Admin."}, status=status.HTTP_403_FORBIDDEN)
            
        if user.locked_until and user.locked_until > timezone.now():
            return Response({"error": f"Account is locked until {user.locked_until}. Try again later."}, status=status.HTTP_403_FORBIDDEN)
            
        if user.check_password(password):
            user.failed_otp_attempts = 0
            user.locked_until = None
            
            refresh = RefreshToken.for_user(user)
            refresh['role'] = user.role
            
            if device_push_token:
                user.device_push_token = device_push_token
                
            user.last_login = timezone.now()
            user.save()
            
            first_name = user.first_name or ''
            last_name = user.last_name or ''
            full_name = f"{first_name} {last_name}".strip() if (first_name or last_name) else user.email
            territory_name = user.territory.name if user.territory else None

            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'role': user.role,
                'full_name': full_name,
                'email': user.email,
                'territory_name': territory_name
            })

        else:
            # Disabled account locking for testing phase
            # user.failed_otp_attempts += 1
            # if user.failed_otp_attempts >= 5:
            #     user.locked_until = timezone.now() + timezone.timedelta(minutes=30)
            #     from .models import SystemAuditLog
            #     SystemAuditLog.objects.create(
            #         entity_type='User',
            #         entity_id=str(user.id),
            #         action_type='Login',
            #         new_value='Account locked due to 5 failed password attempts',
            #         user_id=str(user.id)
            #     )
            # user.save()
            # 
            # if user.failed_otp_attempts >= 5:
            #     return Response({"error": "5 failed attempts. Account locked for 30 minutes."}, status=status.HTTP_403_FORBIDDEN)
                
            return Response({"error": "Invalid email or password"}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({"error": f"Internal server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invalidate_session(request):
    # Blacklisting strategy handled by SimpleJWT if user sends refresh-token
    # For a full remote invalidate, we'd add token to blacklisted tokens
    try:
        refresh_token = request.data["refresh"]
        token = RefreshToken(refresh_token)
        token.blacklist()
        return Response({"message": "Session invalidated"}, status=status.HTTP_205_RESET_CONTENT)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    user = request.user
    first_name = user.first_name or ''
    last_name = user.last_name or ''
    full_name = f"{first_name} {last_name}".strip() if (first_name or last_name) else user.email
    territory_name = user.territory.name if user.territory else None

    return Response({
        'id': str(user.id),
        'email': user.email,
        'full_name': full_name,
        'role': user.role,
        'territory_name': territory_name
    })

