import os
import django
import pandas as pd

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from core.models import MarketPriceRecord

print("Fetching 2026 data...")
records = MarketPriceRecord.objects.filter(date__year=2026).select_related('crop')

data = []
for record in records:
    data.append({
        'Date': record.date.strftime('%Y-%m-%d') if record.date else None,
        'Market Name': record.market_name,
        'Commodity Name': record.commodity_name,
        'Crop Name': record.crop.crop_name if record.crop else None,
        'Min Price': record.min_price,
        'Max Price': record.max_price,
        'Modal Price': record.modal_price,
    })

print(f"Extracted {len(data)} records.")
if data:
    df = pd.DataFrame(data)
    output_path = r'c:\Users\mdamo\OneDrive\Desktop\FaReM\market_prices_2026.xlsx'
    df.to_excel(output_path, index=False)
    print(f"Excel file created at: {output_path}")
else:
    print("No data found for 2026.")
