import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from core.models import User
import random
import string

users = User.objects.all()
updated_count = 0

for user in users:
    if not user.email or user.email.strip() == '':
        first = (user.first_name or "user").strip().lower()
        last = (user.last_name or str(random.randint(100, 999))).strip().lower()
        
        base_email = f"{first[0] if first else 'u'}.{last}@plantnutrition.in"
        email = base_email
        counter = 1
        while User.objects.exclude(id=user.id).filter(email=email).exists():
            email = f"{first[0] if first else 'u'}.{last}{counter}@plantnutrition.in"
            counter += 1
            
        user.email = email
    
    user.set_password("Welcome@123")
    user.save()
    updated_count += 1
    print(f"Updated user {user.username}: email={user.email}")

print(f"Successfully updated {updated_count} users.")
