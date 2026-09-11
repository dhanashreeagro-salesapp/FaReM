import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from core.models import MarketPriceImportBatch, MarketPriceRecord
from django.db.models import Max, Min, Count

batches = MarketPriceImportBatch.objects.all().order_by('-imported_at')[:5]
for b in batches:
    print(f"Batch ID: {b.id}, Filename: {b.filename}, Processed: {b.records_processed}, Status: {b.status}, Date: {b.imported_at}")
    aggs = MarketPriceRecord.objects.filter(import_batch=b).aggregate(Max('date'), Min('date'), Count('id'))
    print(f"  Records created in this batch: {aggs['id__count']}")
    print(f"  Min Date: {aggs['date__min']}, Max Date: {aggs['date__max']}")
