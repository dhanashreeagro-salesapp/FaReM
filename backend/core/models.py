from django.contrib.auth.models import AbstractUser
from django.contrib.gis.db import models as gis_models
from django.db import models
from django.core.validators import RegexValidator
import uuid

class Role(models.TextChoices):
    FIELD_STAFF = 'FieldStaff', 'Field Staff'
    TERRITORY_MANAGER = 'TerritoryManager', 'Territory Manager'
    ZONAL_MANAGER = 'ZonalManager', 'Zonal Manager'
    ADMIN = 'Admin', 'Admin'
    CONTENT_TEAM = 'ContentTeam', 'Content Team'

class Status(models.TextChoices):
    ACTIVE = 'Active', 'Active'
    INACTIVE = 'Inactive', 'Inactive'
    TRANSFERRED = 'Transferred', 'Transferred'
    COMPLETED = 'Completed', 'Completed'
    PENDING = 'Pending', 'Pending'
    APPROVED = 'Approved', 'Approved'
    REJECTED = 'Rejected', 'Rejected'

class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    mobile_number = models.CharField(max_length=15, unique=True, validators=[RegexValidator(r'^\+?1?\d{9,15}$')])
    employee_id = models.CharField(max_length=50, blank=True, null=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.FIELD_STAFF)
    territory = models.ForeignKey('Territory', on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    reporting_manager = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='subordinates')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    device_push_token = models.CharField(max_length=255, blank=True, null=True)
    failed_otp_attempts = models.IntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'mobile_number']

class Territory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    parent_territory = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='sub_territories')
    manager = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_territories')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    location = gis_models.PointField(null=True, blank=True)
    
    def __str__(self):
        return self.name

    def get_all_sub_territories(self):
        """Recursively get all sub-territories for this territory."""
        territories = [self]
        sub_territories = list(self.sub_territories.all())
        while sub_territories:
            territories.extend(sub_territories)
            sub_territories = list(Territory.objects.filter(parent_territory__in=sub_territories))
        return territories

class Farmer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=255)
    primary_mobile = models.CharField(max_length=15, unique=True, validators=[RegexValidator(r'^\+?1?\d{9,15}$')])
    alternate_mobile = models.CharField(max_length=15, blank=True, null=True, validators=[RegexValidator(r'^\+?1?\d{9,15}$')])
    email = models.EmailField(blank=True, null=True)
    village = models.CharField(max_length=255)
    taluka = models.CharField(max_length=255)
    district = models.CharField(max_length=255)
    pin_code = models.CharField(max_length=10)
    state = models.CharField(max_length=255)
    preferred_language = models.CharField(max_length=50, choices=[('English', 'English'), ('Marathi', 'Marathi')], default='English')
    land_holding_acres = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    farmer_photo = models.URLField(max_length=500, null=True, blank=True)
    assigned_staff = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_farmers')
    territory = models.ForeignKey(Territory, on_delete=models.SET_NULL, null=True, blank=True, related_name='farmers')
    source = models.CharField(max_length=50, choices=[('BulkImport', 'Bulk Import'), ('InApp', 'In App')], default='InApp')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    date_added = models.DateTimeField(auto_now_add=True)
    opt_out_whatsapp = models.BooleanField(default=False)
    opt_out_sms = models.BooleanField(default=False)

    def __str__(self):
        return self.full_name

class Plot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farmer = models.ForeignKey(Farmer, on_delete=models.CASCADE, related_name='plots')
    plot_name = models.CharField(max_length=255)
    area_acres = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    calculated_area_acres = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    soil_type = models.CharField(max_length=100, blank=True, null=True)
    irrigation_source = models.CharField(max_length=100, blank=True, null=True)
    location = gis_models.PolygonField(null=True, blank=True) # Used for GPS plot corners
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.plot_name

class CropMaster(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    crop_name = models.CharField(max_length=255)
    marathi_name = models.CharField(max_length=255, blank=True, null=True)
    crop_category = models.CharField(max_length=255)
    scientific_name = models.CharField(max_length=255, blank=True, null=True)
    crop_schedule_pdf = models.URLField(max_length=500, blank=True, null=True)
    reference_image = models.ImageField(upload_to='crop_images/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    def __str__(self):
        return self.crop_name

class MarketRate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    crop = models.ForeignKey(CropMaster, on_delete=models.CASCADE, related_name='market_rates')
    date = models.DateField()
    inward_quantity = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    min_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    max_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    avg_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    class Meta:
        unique_together = ('crop', 'date')
        ordering = ['-date']

    def __str__(self):
        return f"{self.crop.crop_name} - {self.date} - {self.avg_price}"

class CropVariety(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    crop = models.ForeignKey(CropMaster, on_delete=models.CASCADE, related_name='varieties')
    variety_name = models.CharField(max_length=255)
    typical_duration_days = models.IntegerField(null=True, blank=True)

class CropStage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    crop = models.ForeignKey(CropMaster, on_delete=models.CASCADE, related_name='stages')
    stage_name = models.CharField(max_length=255)
    sequence_number = models.IntegerField()
    days_from_previous_stage = models.IntegerField(default=0)
    stage_description = models.TextField(blank=True, null=True)

class CropSeason(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plot = models.ForeignKey(Plot, on_delete=models.CASCADE, related_name='seasons')
    crop = models.ForeignKey(CropMaster, on_delete=models.PROTECT, related_name='seasons')
    variety_name = models.CharField(max_length=255, blank=True, null=True)
    area_acres = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    sowing_date = models.DateField()
    current_stage = models.ForeignKey(CropStage, on_delete=models.SET_NULL, null=True, blank=True)
    expected_next_stage_date = models.DateField(null=True, blank=True)
    previous_crop = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=20, choices=[('Active', 'Active'), ('Completed', 'Completed')], default='Active')
    total_yield_kg = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    total_income_rs = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    total_expenses_rs = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

class StageChangeLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    season = models.ForeignKey(CropSeason, on_delete=models.CASCADE, related_name='stage_changes')
    from_stage = models.ForeignKey(CropStage, on_delete=models.SET_NULL, null=True, blank=True, related_name='changes_from')
    to_stage = models.ForeignKey(CropStage, on_delete=models.SET_NULL, null=True, blank=True, related_name='changes_to')
    changed_by_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    change_timestamp = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.pk:
            return
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        return

class ActivityLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farmer = models.ForeignKey(Farmer, on_delete=models.CASCADE, related_name='activities')
    logged_by_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='logged_activities')
    activity_type = models.CharField(max_length=50, choices=[('Visit', 'Visit'), ('Call', 'Call')])
    date = models.DateField()
    time = models.TimeField()
    location = gis_models.PointField(null=True, blank=True)
    visit_purpose = models.CharField(max_length=255, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    photos = models.JSONField(default=list, blank=True)
    sync_status = models.CharField(max_length=20, choices=[('Pending', 'Pending'), ('Synced', 'Synced')], default='Synced')
    client_uuid = models.UUIDField(null=True, blank=True, unique=True) # Used for idempotent deduplication

    class Meta:
        unique_together = ('farmer', 'logged_by_user', 'date', 'time', 'activity_type')

    def save(self, *args, **kwargs):
        if self.pk:
            # Prevent updates to existing records
            return
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Prevent deletion
        return

class Recommendation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farmer = models.ForeignKey(Farmer, on_delete=models.CASCADE, related_name='recommendations')
    created_by_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    product_name = models.CharField(max_length=255)
    dose = models.CharField(max_length=255)
    timing = models.CharField(max_length=255)
    application_method = models.CharField(max_length=255)
    notes = models.TextField(blank=True, null=True)
    crop = models.ForeignKey(CropMaster, on_delete=models.SET_NULL, null=True, blank=True)
    stage = models.ForeignKey(CropStage, on_delete=models.SET_NULL, null=True, blank=True)
    channel = models.CharField(max_length=20, choices=[('WhatsApp', 'WhatsApp'), ('SMS', 'SMS')])
    send_status = models.CharField(max_length=50, choices=[('Sent', 'Sent'), ('Delivered', 'Delivered'), ('Failed', 'Failed')], default='Sent')
    timestamp = models.DateTimeField(auto_now_add=True)

class ProductMaster(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class PromotionLibrary(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    content_type = models.CharField(max_length=50, choices=[('Video', 'Video'), ('Image', 'Image'), ('PDF', 'PDF'), ('Link', 'Link')])
    file_url = models.URLField(max_length=500)
    crop = models.ForeignKey(CropMaster, on_delete=models.SET_NULL, null=True, blank=True)
    stage = models.ForeignKey(CropStage, on_delete=models.SET_NULL, null=True, blank=True)
    related_products = models.ManyToManyField(ProductMaster, blank=True)
    category = models.CharField(max_length=50, choices=[('Product', 'Product'), ('Tagline', 'Tagline'), ('WhatsApp', 'WhatsApp'), ('Facebook', 'Facebook'), ('Instagram', 'Instagram'), ('LinkedIn', 'LinkedIn'), ('Schedule', 'Schedule'), ('Testimonial', 'Testimonial'), ('YouTube Playlist', 'YouTube Playlist')], default='Product')
    language_tags = models.JSONField(default=list, blank=True) # list of languages e.g., ["English", "Marathi"]
    expiry_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    whatsapp_template = models.CharField(max_length=255, blank=True, null=True)
    sms_template = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

class BulkSendBatch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_by_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_batches')
    content = models.ForeignKey(PromotionLibrary, on_delete=models.CASCADE)
    filter_criteria = models.JSONField(default=dict)
    farmer_ids = models.JSONField(default=list)
    recipient_count = models.IntegerField(default=0)
    channel = models.CharField(max_length=20, choices=[('WhatsApp', 'WhatsApp'), ('SMS', 'SMS')])
    approval_status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    approved_by_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_batches')
    approval_timestamp = models.DateTimeField(null=True, blank=True)
    send_status = models.CharField(max_length=20, choices=[('Pending', 'Pending'), ('InProgress', 'In Progress'), ('Completed', 'Completed')], default='Pending')
    sent_count = models.IntegerField(default=0)
    failed_count = models.IntegerField(default=0)
    
    scheduled_start_date = models.DateField(null=True, blank=True)
    scheduled_end_date = models.DateField(null=True, blank=True)
    frequency = models.CharField(max_length=20, choices=[('Once', 'Once'), ('Daily', 'Daily'), ('Weekly', 'Weekly')], default='Once')
    next_execution_date = models.DateField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

class ImportJob(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    filename = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=[('Pending', 'Pending'), ('Processing', 'Processing'), ('Completed', 'Completed'), ('Failed', 'Failed')], default='Pending')
    total_rows = models.IntegerField(default=0)
    valid_rows = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    duplicate_count = models.IntegerField(default=0)
    error_report = models.JSONField(default=list) # List of row-level errors
    is_acknowledged = models.BooleanField(default=False) # For > 1000 records
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.filename} - {self.status}"

class SystemAuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entity_type = models.CharField(max_length=100)
    entity_id = models.CharField(max_length=255)
    field_changed = models.CharField(max_length=255, blank=True, null=True)
    old_value = models.TextField(blank=True, null=True)
    new_value = models.TextField(blank=True, null=True)
    user_id = models.CharField(max_length=255, blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    action_type = models.CharField(max_length=50, choices=[('Create', 'Create'), ('Update', 'Update'), ('Delete', 'Delete'), ('Export', 'Export'), ('Login', 'Login'), ('Logout', 'Logout'), ('BulkImport', 'Bulk Import')])

    class Meta:
        permissions = [("can_view_audit_log", "Can view audit log")]

class AppConfiguration(models.Model):
    """Singleton model for admin-configurable system settings."""
    visit_frequency_norm_days = models.IntegerField(default=14, help_text='Default days before a farmer visit is considered overdue')
    planner_refresh_hour = models.IntegerField(default=6, help_text='Hour (0-23) when daily smart planner refreshes')
    msg91_auth_key = models.CharField(max_length=255, blank=True, null=True)
    interakt_api_key = models.CharField(max_length=255, blank=True, null=True)
    cloudinary_url = models.CharField(max_length=500, blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_config(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    class Meta:
        verbose_name = 'App Configuration'
        verbose_name_plural = 'App Configuration'
