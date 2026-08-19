import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from core.models import User

users = User.objects.all()

with open('users_list.md', 'w') as f:
    f.write('# Users List\n\n')
    f.write('| Full Name | Email (Username) | Role | Password |\n')
    f.write('|---|---|---|---|\n')
    for u in users:
        fname = u.first_name or ''
        lname = u.last_name or ''
        name = f'{fname} {lname}'.strip()
        f.write(f'| {name} | {u.email} | {u.role} | Welcome@123 |\n')

print('wrote users_list.md')
