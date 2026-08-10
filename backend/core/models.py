from django.contrib.auth.models import AbstractUser
from django.contrib.gis.db import models as gis_models
from django.db import models
from django.core.validators import RegexValidator
from django.utils import timezone
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
    salesapp_user_id = models.UUIDField(null=True, blank=True)

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.FIELD_STAFF)

    territory = models.ForeignKey('Territory', on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    reporting_manager = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='subordinates')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    device_push_token = models.CharField(max_length=255, blank=True, null=True)
    failed_otp_attempts = models.IntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'mobile_number']

    def get_all_subordinates(self):
        """Recursively retrieve all subordinates reporting directly or indirectly to this user."""
        subs = list(self.subordinates.all())
        all_subs = []
        visited = {self.id}
        while subs:
            curr = subs.pop(0)
            if curr.id in visited:
                continue
            visited.add(curr.id)
            all_subs.append(curr)
            subs.extend(list(curr.subordinates.all()))
        return all_subs

    def get_team_users(self):
        """Get self plus all direct and indirect subordinates."""
        return [self] + self.get_all_subordinates()


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
        """Recursively get all sub-territories for this territory safely without infinite cycles."""
        visited = set()
        territories = []
        curr = [self]
        while curr:
            next_curr = []
            for item in curr:
                if item.id in visited:
                    continue
                visited.add(item.id)
                territories.append(item)
                children = list(item.sub_territories.all())
                next_curr.extend(children)
            curr = next_curr
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
    source = models.CharField(max_length=255, blank=True, null=True, default='InApp')
    acquisition_date = models.DateField(null=True, blank=True)
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

    def compute_and_set_current_stage(self):
        if not self.crop_id or not self.sowing_date:
            return None
        from django.utils import timezone
        today = timezone.now().date()
        days_since_sowing = max(0, (today - self.sowing_date).days)

        stages = list(CropStage.objects.filter(crop_id=self.crop_id).order_by('sequence_number'))
        if not stages:
            return None

        cumulative_days = 0
        selected_stage = stages[0]

        for stage in stages:
            cumulative_days += stage.days_from_previous_stage
            if days_since_sowing <= cumulative_days:
                selected_stage = stage
                break
            selected_stage = stage

        self.current_stage = selected_stage
        return selected_stage

    def save(self, *args, **kwargs):
        if not self.current_stage and self.crop_id and self.sowing_date:
            self.compute_and_set_current_stage()
        super().save(*args, **kwargs)

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

class FieldVisit(models.Model):
    PURPOSE_CHOICES = [
        ('Product Demonstration', 'Product Demonstration'),
        ('Crop Advisory', 'Crop Advisory'),
        ('Issue Resolution', 'Issue Resolution'),
        ('Routine Visit', 'Routine Visit'),
        ('Complaint Investigation', 'Complaint Investigation'),
        ('New Farmer Registration', 'New Farmer Registration'),
        ('Collection', 'Collection'),
        ('Other', 'Other')
    ]
    STATUS_CHOICES = [
        ('Verified', 'Verified'),
        ('Outside Radius', 'Outside Radius'),
        ('Pending Check-Out', 'Pending Check-Out'),
        ('Completed', 'Completed')
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farmer = models.ForeignKey(Farmer, on_delete=models.CASCADE, related_name='field_visits')
    plot = models.ForeignKey(Plot, on_delete=models.SET_NULL, null=True, blank=True, related_name='field_visits')
    staff = models.ForeignKey(User, on_delete=models.CASCADE, related_name='visits')
    purpose = models.CharField(max_length=50, choices=PURPOSE_CHOICES, default='Routine Visit')
    notes = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Verified')
    
    check_in_time = models.DateTimeField()
    check_out_time = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.IntegerField(null=True, blank=True)
    
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    gps_accuracy = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    distance_from_plot = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    inside_radius = models.BooleanField(default=True)
    photo_count = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_visits')

    def __str__(self):
        return f"Visit - {self.farmer.full_name} by {self.staff.email} ({self.purpose})"

class VisitPhoto(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    visit = models.ForeignKey(FieldVisit, on_delete=models.CASCADE, related_name='photos')
    photo_url = models.TextField(blank=True, default='')
    thumbnail_url = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

class CallLog(models.Model):
    DIRECTION_CHOICES = [('Outgoing', 'Outgoing'), ('Incoming', 'Incoming')]
    OUTCOME_CHOICES = [
        ('Interested', 'Interested'),
        ('Not Interested', 'Not Interested'),
        ('Follow-up Required', 'Follow-up Required'),
        ('No Answer', 'No Answer'),
        ('Busy', 'Busy'),
        ('Switched Off', 'Switched Off'),
        ('Complaint', 'Complaint'),
        ('Other', 'Other')
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farmer = models.ForeignKey(Farmer, on_delete=models.CASCADE, related_name='call_logs')
    staff = models.ForeignKey(User, on_delete=models.CASCADE, related_name='call_logs')
    direction = models.CharField(max_length=20, choices=DIRECTION_CHOICES, default='Outgoing')
    call_time = models.DateTimeField(default=timezone.now)
    duration = models.IntegerField(null=True, blank=True, help_text='Call duration in seconds')
    outcome = models.CharField(max_length=50, choices=OUTCOME_CHOICES, default='Other')
    notes = models.TextField(blank=True, null=True)
    next_action = models.CharField(max_length=255, blank=True, null=True)
    followup_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Call ({self.direction}) - {self.farmer.full_name} ({self.outcome})"

class ProductMaster(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Recommendation(models.Model):
    PRIORITY_CHOICES = [('Normal', 'Normal'), ('High', 'High'), ('Urgent', 'Urgent')]
    REVIEW_CHOICES = [('Pending', 'Pending'), ('Approved', 'Approved'), ('Needs Review', 'Needs Review'), ('Rejected', 'Rejected')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farmer = models.ForeignKey(Farmer, on_delete=models.CASCADE, related_name='recommendations')
    plot = models.ForeignKey(Plot, on_delete=models.SET_NULL, null=True, blank=True, related_name='recommendations')
    created_by_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    crop = models.ForeignKey(CropMaster, on_delete=models.SET_NULL, null=True, blank=True)
    stage = models.ForeignKey(CropStage, on_delete=models.SET_NULL, null=True, blank=True)
    product = models.ForeignKey(ProductMaster, on_delete=models.SET_NULL, null=True, blank=True, related_name='recommendations')
    product_name = models.CharField(max_length=255)
    dose = models.CharField(max_length=255)
    dose_unit = models.CharField(max_length=50, blank=True, null=True, default='g/L')
    timing = models.CharField(max_length=255)
    application_method = models.CharField(max_length=255)
    notes = models.TextField(blank=True, null=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='Normal')
    review_status = models.CharField(max_length=20, choices=REVIEW_CHOICES, default='Approved')
    manager_comment = models.TextField(blank=True, null=True)
    channel = models.CharField(max_length=20, choices=[('WhatsApp', 'WhatsApp'), ('SMS', 'SMS'), ('Internal', 'Internal')], default='Internal')
    send_status = models.CharField(max_length=50, choices=[('Sent', 'Sent'), ('Delivered', 'Delivered'), ('Failed', 'Failed')], default='Sent')
    timestamp = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Recommendation: {self.product_name} for {self.farmer.full_name}"

class RecommendationMessage(models.Model):
    CHANNEL_CHOICES = [('WhatsApp', 'WhatsApp'), ('SMS', 'SMS'), ('Internal', 'Internal')]
    STATUS_CHOICES = [('Pending', 'Pending'), ('Sent', 'Sent'), ('Failed', 'Failed')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recommendation = models.ForeignKey(Recommendation, on_delete=models.CASCADE, related_name='messages')
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default='Internal')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    sent_time = models.DateTimeField(null=True, blank=True)
    content = models.TextField()
    delivery_status = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

class PromotionLibrary(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    content_type = models.CharField(max_length=50, choices=[('Video', 'Video'), ('Image', 'Image'), ('PDF', 'PDF'), ('Link', 'Link')])
    file_url = models.URLField(max_length=500)
    crop = models.ForeignKey(CropMaster, on_delete=models.SET_NULL, null=True, blank=True)
    stage = models.ForeignKey(CropStage, on_delete=models.SET_NULL, null=True, blank=True)
    related_products = models.ManyToManyField(ProductMaster, blank=True)
    category = models.CharField(max_length=50, choices=[('Product', 'Product'), ('Tagline', 'Tagline'), ('WhatsApp', 'WhatsApp'), ('Facebook', 'Facebook'), ('Instagram', 'Instagram'), ('LinkedIn', 'LinkedIn'), ('Schedule', 'Schedule'), ('Testimonial', 'Testimonial'), ('YouTube Playlist', 'YouTube Playlist')], default='Product')
    language_tags = models.JSONField(default=list, blank=True)
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
    error_report = models.JSONField(default=list)
    is_acknowledged = models.BooleanField(default=False)
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
    visit_radius_meters = models.IntegerField(default=150, help_text='Maximum distance in meters for verified visit')
    gps_validation_mode = models.CharField(max_length=20, choices=[('Strict', 'Strict'), ('Warning', 'Warning')], default='Warning', help_text='Strict blocks save outside radius; Warning flags visit and permits save')
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

