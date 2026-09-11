import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from core.models import MarketPriceRecord
from django.db.models import Max

max_date = MarketPriceRecord.objects.filter(date__year=2026).aggregate(Max('date'))
print(f"Max date in 2026: {max_date['date__max']}")

batch_counts = MarketPriceRecord.objects.filter(date__year=2026).values('import_batch__filename', 'import_batch__status', 'import_batch__imported_at').annotate(Max('date'), count=django.db.models.Count('id'))
for b in batch_counts:
    print(b)
