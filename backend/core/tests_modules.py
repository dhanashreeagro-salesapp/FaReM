from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from .models import User, Role, Farmer, Territory, FieldVisit, CallLog, Recommendation

class FRMModulesTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.territory = Territory.objects.create(name="Solapur Central")
        self.user = User.objects.create_user(
            username="teststaff@plantnutrition.in",
            email="teststaff@plantnutrition.in",
            mobile_number="+919876543210",
            role=Role.FIELD_STAFF,
            territory=self.territory
        )
        self.client.force_authenticate(user=self.user)
        self.farmer = Farmer.objects.create(
            full_name="Ramesh Patil",
            primary_mobile="+919988776655",
            village="Mohol",
            taluka="Mohol",
            district="Solapur",
            pin_code="413213",
            territory=self.territory,
            assigned_staff=self.user
        )

    def test_log_field_visit(self):
        response = self.client.post('/api/field-visits/', {
            'farmer': str(self.farmer.id),
            'purpose': 'Routine Visit',
            'notes': 'Checking crop health in the field.',
            'latitude': 17.6599,
            'longitude': 75.9064,
            'gps_accuracy': 4.5
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(FieldVisit.objects.count(), 1)

    def test_log_call(self):
        response = self.client.post('/api/call-logs/', {
            'farmer': str(self.farmer.id),
            'direction': 'Outgoing',
            'outcome': 'Interested',
            'duration': 120,
            'notes': 'Farmer requested details on Bio-Stimulant.'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CallLog.objects.count(), 1)

    def test_ai_recommendation_suggestions(self):
        response = self.client.get(f'/api/recommendations/suggestions/?farmer_id={self.farmer.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response.data) > 0)
        self.assertIn('confidence_score', response.data[0])

    def test_create_recommendation(self):
        response = self.client.post('/api/recommendations/', {
            'farmer': str(self.farmer.id),
            'product_name': 'Dhanashree Growth Booster',
            'dose': '2.5',
            'dose_unit': 'ml/L',
            'timing': 'Early Morning',
            'application_method': 'Foliar Spray',
            'notes': 'Spray evenly on leaves.'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Recommendation.objects.count(), 1)
