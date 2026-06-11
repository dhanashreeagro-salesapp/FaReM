import urllib.request
import json
import difflib
from django.core.management.base import BaseCommand
from core.models import Farmer

class Command(BaseCommand):
    help = 'Cleans village, taluka, district, and state data using api.postalpincode.in'

    def handle(self, *args, **options):
        farmers = Farmer.objects.exclude(pin_code__isnull=True).exclude(pin_code='')
        
        # Group by pin code
        pin_groups = {}
        for f in farmers:
            pin = f.pin_code.strip()
            if pin not in pin_groups:
                pin_groups[pin] = []
            pin_groups[pin].append(f)
            
        self.stdout.write(f"Found {len(pin_groups)} unique pin codes to process.")

        for pin, f_list in pin_groups.items():
            try:
                url = f"https://api.postalpincode.in/pincode/{pin}"
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=10) as response:
                    data = json.loads(response.read().decode())
                    
                if not data or data[0].get('Status') != 'Success':
                    self.stdout.write(self.style.WARNING(f"Invalid or not found pin code: {pin}"))
                    continue
                    
                post_offices = data[0].get('PostOffice', [])
                if not post_offices:
                    continue
                    
                po_names = [po['Name'] for po in post_offices]
                
                for farmer in f_list:
                    current_village = farmer.village.strip() if farmer.village else ""
                    
                    # Find closest village match
                    matches = difflib.get_close_matches(current_village, po_names, n=1, cutoff=0.4)
                    
                    best_po = None
                    if matches:
                        best_po_name = matches[0]
                        best_po = next((po for po in post_offices if po['Name'] == best_po_name), post_offices[0])
                    else:
                        # Fallback to the first post office if no close match is found
                        best_po = post_offices[0]
                    
                    # Update farmer data
                    old_village = farmer.village
                    farmer.village = best_po.get('Name', farmer.village)
                    farmer.taluka = best_po.get('Block', farmer.taluka)
                    if farmer.taluka == "NA" or not farmer.taluka:
                        farmer.taluka = best_po.get('District', farmer.taluka) # Sometimes Block is NA
                    farmer.district = best_po.get('District', farmer.district)
                    farmer.state = best_po.get('State', farmer.state)
                    farmer.save(update_fields=['village', 'taluka', 'district', 'state'])
                    
                    self.stdout.write(self.style.SUCCESS(f"Updated Farmer {farmer.full_name}: {old_village} -> {farmer.village}"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error processing pin code {pin}: {e}"))
                
        self.stdout.write(self.style.SUCCESS("Pincode data cleaning completed."))
