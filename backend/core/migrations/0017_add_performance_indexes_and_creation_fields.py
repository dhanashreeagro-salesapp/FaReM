from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0016_appconfiguration_gps_validation_mode_and_more'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='farmer',
            index=models.Index(fields=['assigned_staff', 'status'], name='farmer_staff_status_idx'),
        ),
        migrations.AddIndex(
            model_name='farmer',
            index=models.Index(fields=['village', 'district'], name='farmer_location_idx'),
        ),
        migrations.AddIndex(
            model_name='farmer',
            index=models.Index(fields=['date_added'], name='farmer_date_added_idx'),
        ),
        migrations.AddIndex(
            model_name='plot',
            index=models.Index(fields=['farmer', 'is_active'], name='plot_farmer_active_idx'),
        ),
        migrations.AddIndex(
            model_name='cropseason',
            index=models.Index(fields=['plot', 'status'], name='season_plot_status_idx'),
        ),
        migrations.AddIndex(
            model_name='cropseason',
            index=models.Index(fields=['crop', 'status'], name='season_crop_status_idx'),
        ),
        migrations.AddIndex(
            model_name='recommendation',
            index=models.Index(fields=['farmer', 'timestamp'], name='rec_farmer_time_idx'),
        ),
        migrations.AddIndex(
            model_name='recommendation',
            index=models.Index(fields=['created_by_user', 'timestamp'], name='rec_user_time_idx'),
        ),
        migrations.AddIndex(
            model_name='activitylog',
            index=models.Index(fields=['farmer', 'date'], name='act_farmer_date_idx'),
        ),
        migrations.AddIndex(
            model_name='activitylog',
            index=models.Index(fields=['logged_by_user', 'date'], name='act_user_date_idx'),
        ),
    ]
