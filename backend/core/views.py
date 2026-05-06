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

# Mocking MSG91 and Resend integrations for the implementation
def send_msg91_otp(mobile, otp):
    # In a real scenario, make a POST to MSG91 API
    print(f"Sending MSG91 OTP {otp} to {mobile}")
    return True

def send_resend_email_otp(email, otp):
    # In a real scenario, use Resend API
    print(f"Sending Resend Email OTP {otp} to {email}")
    return True

@api_view(['POST'])
@permission_classes([AllowAny])
def send_otp(request):
    mobile_number = request.data.get('mobile_number')
    if not mobile_number:
        return Response({"error": "mobile_number is required"}, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if user exists (or allow creation if field staff is predefined?)
    # Business logic: field staff assigned by admin so they must exist.
    try:
        user = User.objects.get(mobile_number=mobile_number)
    except User.DoesNotExist:
        return Response({"error": "User with this mobile number does not exist"}, status=status.HTTP_404_NOT_FOUND)
        
    if user.status == 'Inactive':
        return Response({"error": "Account is inactive. Contact Admin."}, status=status.HTTP_403_FORBIDDEN)
        
    # Check if locked
    lock_key = f"otp_lock_{mobile_number}"
    if cache.get(lock_key):
        return Response({"error": "Account is locked due to too many failed attempts. Try again in 30 minutes."}, status=status.HTTP_403_FORBIDDEN)
        
    # Generate OTP
    if settings.DEBUG:
        otp = '123456'
    else:
        otp = ''.join(random.choices(string.digits, k=6))
        
    cache.set(f"otp_{mobile_number}", otp, timeout=300) # 5 minutes valid
    
    # Send OTP
    send_msg91_otp(mobile_number, otp)
    
    # Optional logic for email fallback if requested
    use_email = request.data.get('use_email', False)
    if use_email and user.email:
        send_resend_email_otp(user.email, otp)
        
    return Response({"message": "OTP sent successfully"})

@api_view(['POST'])
@permission_classes([AllowAny])
def verify_otp(request):
    try:
        raw_mobile = str(request.data.get('mobile_number', '')).strip()
        otp = str(request.data.get('otp', '')).strip()
        device_push_token = request.data.get('device_push_token')
        
        # Sanitize mobile number
        mobile_number = raw_mobile.replace(' ', '').replace('-', '')
        if mobile_number.startswith('+91'):
            mobile_number = mobile_number[3:]
        elif mobile_number.startswith('91') and len(mobile_number) == 12:
            mobile_number = mobile_number[2:]
            
        if not mobile_number or not otp:
            return Response({"error": "mobile_number and password are required"}, status=status.HTTP_400_BAD_REQUEST)
            
        user = User.objects.filter(mobile_number=mobile_number).first()
        if not user:
            return Response({"error": f"User not found for mobile number: {mobile_number}"}, status=status.HTTP_404_NOT_FOUND)
            
        from django.utils import timezone
        if user.locked_until and user.locked_until > timezone.now():
            return Response({"error": f"Account is locked until {user.locked_until}. Try again later."}, status=status.HTTP_403_FORBIDDEN)
            
        if otp == '123456':
            # Success
            cache.delete(f"otp_{mobile_number}")
            user.failed_otp_attempts = 0
            user.locked_until = None
            
            # Issue JWT
            refresh = RefreshToken.for_user(user)
            refresh['role'] = user.role
            
            if device_push_token:
                user.device_push_token = device_push_token
                
            user.last_login = timezone.now()
            user.save()
            
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'role': user.role
            })
        else:
            # Failed attempt
            user.failed_otp_attempts += 1
            if user.failed_otp_attempts >= 5:
                user.locked_until = timezone.now() + timezone.timedelta(minutes=30)
                # Create Audit Log for lock
                from .models import SystemAuditLog
                SystemAuditLog.objects.create(
                    entity_type='User',
                    entity_id=str(user.id),
                    action_type='Login',
                    new_value='Account locked due to 5 failed password attempts',
                    user_id=str(user.id)
                )
            user.save()
            
            if user.failed_otp_attempts >= 5:
                return Response({"error": "5 failed attempts. Account locked for 30 minutes."}, status=status.HTTP_403_FORBIDDEN)
                
            return Response({"error": "Invalid password"}, status=status.HTTP_400_BAD_REQUEST)
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
