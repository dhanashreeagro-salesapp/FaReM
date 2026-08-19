import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from core.models import User

# Grab all users
users = User.objects.all()
reset_count = 0

for user in users:
    user.set_password('Welcome@123')
    user.save()
    reset_count += 1

print(f"Force resetting passwords. Total users updated: {reset_count}")
