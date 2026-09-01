import pandas as pd
from django.core.management.base import BaseCommand
from core.models import MarketPriceRecord, MarketPriceImportBatch, CropMaster, CommodityMapping
import uuid
import re

class Command(BaseCommand):
    help = 'Bulk import market data from a large Excel file into Supabase safely.'

    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str, help='Absolute path to the Excel file')

    def handle(self, *args, **kwargs):
        file_path = kwargs['file_path']
        self.stdout.write(self.style.WARNING(f"Reading Excel file: {file_path}. This may take a moment for large files..."))
        
        try:
            df = pd.read_excel(file_path)
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Failed to read file: {e}"))
            return

        batch = MarketPriceImportBatch.objects.create(
            imported_by=None, # Command line import
            filename=file_path.split('\\')[-1].split('/')[-1]
        )
        
        header_map = {}
        for k in df.columns:
            k_clean = str(k).strip().lower().replace(' ', '').replace('(', '').replace(')', '').replace('/', '')
            if 'commodity' in k_clean or 'crop' in k_clean: header_map['commodity'] = k
            elif 'market' in k_clean: header_map['market'] = k
            elif 'date' in k_clean: header_map['date'] = k
            elif 'modal' in k_clean: header_map['modal'] = k
            elif 'low' in k_clean or 'min' in k_clean: header_map['low'] = k
            elif 'high' in k_clean or 'max' in k_clean: header_map['high'] = k

        missing = [key for key in ['commodity', 'market', 'date', 'modal'] if key not in header_map]
        if missing:
            self.stdout.write(self.style.ERROR(f"Could not map required columns: {missing}. Found headers: {list(df.columns)}"))
            return

        # Pre-cache crop mappings for extreme speed
        crop_master_cache = {c.crop_name.lower(): c for c in CropMaster.objects.all()}
        commodity_mapping_cache = {m.commodity_name.lower(): m.crop for m in CommodityMapping.objects.all()}

        records_to_create = []
        unique_tracker = set()
        
        def parse_price(val):
            if pd.isna(val) or str(val).strip().lower() == 'nan' or str(val) == '_miss_': return None
            try:
                val_str = str(val).replace(',', '').strip()
                match = re.search(r'[-+]?\d*\.\d+|\d+', val_str)
                if match: return float(match.group())
                return None
            except: return None

        self.stdout.write(self.style.WARNING("Parsing rows..."))
        
        for index, row in df.iterrows():
            commodity_name = str(row.get(header_map['commodity'], '')).strip()
            market_name = str(row.get(header_map['market'], '')).strip()
            date_val = row.get(header_map['date'])
            modal_price = row.get(header_map['modal'])

            if not commodity_name or commodity_name.lower() in ['nan', 'none'] or not market_name or market_name.lower() in ['nan', 'none'] or pd.isna(date_val) or pd.isna(modal_price):
                continue

            try:
                if isinstance(date_val, str): parsed_date = pd.to_datetime(date_val, dayfirst=True).date()
                else: parsed_date = pd.to_datetime(date_val).date()
            except:
                continue

            m_price = parse_price(modal_price)
            if m_price is None:
                continue

            # Resolve crop ID using cache
            comm_lower = commodity_name.lower()
            crop = crop_master_cache.get(comm_lower)
            if not crop:
                crop = commodity_mapping_cache.get(comm_lower)
                if not crop and comm_lower not in commodity_mapping_cache:
                    # Create unmapped placeholder silently for the Admin UI to map later
                    CommodityMapping.objects.get_or_create(commodity_name=commodity_name)
                    commodity_mapping_cache[comm_lower] = None

            # Enforce database unique_together constraint locally to avoid bulk_create crashing if duplicate in Excel
            sig = (parsed_date, market_name, commodity_name)
            if sig in unique_tracker:
                continue
            unique_tracker.add(sig)

            records_to_create.append(MarketPriceRecord(
                id=uuid.uuid4(),
                import_batch=batch,
                date=parsed_date,
                market_name=market_name,
                commodity_name=commodity_name,
                crop=crop,
                modal_price=m_price,
                min_price=parse_price(row.get(header_map.get('low'))),
                max_price=parse_price(row.get(header_map.get('high'))),
            ))

        self.stdout.write(self.style.SUCCESS(f"Parsed {len(records_to_create)} valid rows. Beginning bulk insert to database..."))
        
        # Batch insert chunks of 5000 to manage memory and network payload to Supabase
        chunk_size = 5000
        inserted_count = 0
        
        for i in range(0, len(records_to_create), chunk_size):
            chunk = records_to_create[i:i + chunk_size]
            MarketPriceRecord.objects.bulk_create(chunk, ignore_conflicts=True)
            inserted_count += len(chunk)
            self.stdout.write(f"Inserted {inserted_count} / {len(records_to_create)}")

        batch.records_processed = len(records_to_create)
        batch.status = 'Success'
        batch.save()

        self.stdout.write(self.style.SUCCESS(f"Successfully imported {len(records_to_create)} records!"))
