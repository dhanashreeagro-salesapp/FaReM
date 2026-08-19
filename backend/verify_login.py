import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from core.models import User

for email in ['dhanashree.agro@gmail.com', 'dhanashree.agro@plantnutrition.in', 'bwaghachaure@plantnutrition.in']:
    user = User.objects.filter(email__iexact=email).first()
    if user:
        pwd_match = user.check_password('Welcome@123')
        print(f"User {email} exists. Active: {user.status}. Password Match: {pwd_match}")
    else:
        print(f"User {email} DOES NOT EXIST.")
