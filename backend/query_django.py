import os
import django
from django.db.models import Count

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from core.models import MarketPriceRecord

count = MarketPriceRecord.objects.filter(date__year=2026).count()
print(f"Number of 2026 records in market prices table: {count}")

if count > 0:
    samples = MarketPriceRecord.objects.filter(date__year=2026).values_list('date', flat=True)[:5]
    print(f"Sample dates: {list(samples)}")
