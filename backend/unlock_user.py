import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from core.models import User

try:
    user = User.objects.get(email='sgiri@plantnutrition.in')
    user.set_password('Welcome@123')
    user.failed_login_attempts = 0
    user.locked_until = None
    user.save()
    print("User unlocked successfully and password reset to Welcome@123!")
except User.DoesNotExist:
    print("User not found.")
except Exception as e:
    print("Error:", e)
