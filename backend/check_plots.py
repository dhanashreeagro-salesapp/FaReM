import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from core.models import Plot
for p in Plot.objects.filter(farmer__full_name__icontains='Ajay'):
    print(f"Plot: {p.plot_name}, Area: {p.area_acres}, Location: {p.location}")
