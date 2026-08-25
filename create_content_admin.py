import os
import django
import sys

# Setup django
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from core.models import User, Role, Status

def create_content_admin(email, password, mobile_number, name):
    user, created = User.objects.get_or_create(
        email=email,
        defaults={
            'username': email,
            'mobile_number': mobile_number,
            'first_name': name.split()[0],
            'last_name': name.split()[-1] if len(name.split()) > 1 else '',
            'role': Role.CONTENT_ADMIN,
            'status': Status.ACTIVE
        }
    )
    if created:
        user.set_password(password)
        user.save()
        print(f"User {email} created successfully as Content Admin!")
    else:
        user.role = Role.CONTENT_ADMIN
        user.set_password(password)
        user.save()
        print(f"User {email} already exists. Role updated to Content Admin and password reset.")

if __name__ == '__main__':
    create_content_admin('contentadmin@example.com', 'password123', '9998887701', 'Content Admin')
