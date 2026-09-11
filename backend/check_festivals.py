import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from core.models import Festival
from django.utils import timezone

current = timezone.now().date()
print(f"Current Date: {current}")

festivals = Festival.objects.all().order_by('date')
for f in festivals:
    print(f"{f.name} - {f.date} (gte current? {f.date >= current})")
