import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from core.models import Plot

def populate_areas():
    plots = Plot.objects.all()
    updated_count = 0
    for plot in plots:
        update_fields = []
        
        # Populate area_acres if missing or 0
        if plot.area_acres is None or plot.area_acres == 0:
            plot.area_acres = 3.452
            update_fields.append('area_acres')
            
        # Populate calculated_area_acres if location is present and it is missing
        if plot.location and plot.calculated_area_acres is None:
            geom_proj = plot.location.clone()
            geom_proj.transform(3857)
            sq_meters = geom_proj.area
            plot.calculated_area_acres = round(sq_meters * 0.000247105, 4)
            update_fields.append('calculated_area_acres')
            
        if update_fields:
            plot.save(update_fields=update_fields)
            updated_count += 1
            print(f"Updated plot {plot.id} ({plot.plot_name}): {update_fields}")

    print(f"Total plots updated: {updated_count}")

if __name__ == '__main__':
    populate_areas()
