import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from core.models import User, PromotionLibrary, Farmer, Plot, CropSeason

with open('diagnostics.txt', 'w', encoding='utf-8') as f:
    f.write('=== Diagnostic Report ===\n')
    f.write('\n--- Promotions ---\n')
    promotions = PromotionLibrary.objects.all()
    f.write(f'Total promotions in DB: {promotions.count()}\n')
    for p in promotions[:5]:
        f.write(f'ID: {p.id}, Title: {getattr(p, "title", p.id)}, Status: {getattr(p, "status", "N/A")}\n')

    f.write('\n--- Vishnu Bhagre Dashboard Data ---\n')
    vishnu = User.objects.filter(first_name__icontains='Vishnu').first()
    if vishnu:
        f.write(f'Found user: {vishnu.get_full_name()} (Role: {vishnu.role})\n')
        farmers = Farmer.objects.filter(assigned_staff=vishnu)
        f.write(f'Farmers managed: {farmers.count()}\n')
        plots = Plot.objects.filter(farmer__in=farmers)
        f.write(f'Total plots: {plots.count()}\n')
        
        # Original logic might be counting raw seasons instead of distinct crops
        total_seasons = CropSeason.objects.filter(plot__in=plots, status='Active')
        f.write(f'Total Active Seasons: {total_seasons.count()}\n')
        
        unique_crops = CropSeason.objects.filter(plot__in=plots, status='Active').values('crop__crop_name').distinct()
        f.write(f'Unique Active Crops count: {unique_crops.count()}\n')
        f.write(f'Unique Crops list: {[c["crop__crop_name"] for c in unique_crops]}\n')
        
        raw_crops = CropSeason.objects.filter(plot__in=plots, status='Active').values_list('crop__crop_name', flat=True)
        f.write(f'Raw Active Crops (incl duplicates): {list(raw_crops)}\n')
    else:
        f.write('Vishnu Bhagre not found\n')

    f.write('\n--- Village Variations ---\n')
    v_ah = Farmer.objects.filter(village__icontains='Aherg').values_list('village', flat=True).distinct()
    f.write(f'Ahergaon variants: {list(v_ah)}\n')
    v_nip = Farmer.objects.filter(village__icontains='niphad').values_list('village', flat=True).distinct()
    f.write(f'Niphad variants: {list(v_nip)}\n')
