import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()
from core.models import PromotionLibrary

with open('promos_check.txt', 'w', encoding='utf-8') as f:
    for p in PromotionLibrary.objects.all():
        f.write(f'ID: {p.id}, Title: {repr(p.title)}, ContentType: {repr(p.content_type)}\n')
