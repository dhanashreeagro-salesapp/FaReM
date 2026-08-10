from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework.routers import DefaultRouter
from . import views
from . import views_users
from . import views_territory
from . import views_crop
from . import views_farmer
from . import views_plot
from . import views_activity
from . import views_audit
from . import views_promotion
from . import views_recommendation
from . import views_planner
from . import views_bulk_send
from . import views_config
from . import views_product
from . import views_import
from . import views_visit
from . import views_call
from . import views_timeline
from . import views_sync

router = DefaultRouter()
router.register(r'users', views_users.UserViewSet, basename='users')
router.register(r'territories', views_territory.TerritoryViewSet, basename='territories')
router.register(r'crops', views_crop.CropMasterViewSet, basename='crops')
router.register(r'crop-varieties', views_crop.CropVarietyViewSet, basename='crop-varieties')
router.register(r'crop-stages', views_crop.CropStageViewSet, basename='crop-stages')
router.register(r'farmers', views_farmer.FarmerViewSet, basename='farmers')
router.register(r'plots', views_plot.PlotViewSet, basename='plots')
router.register(r'crop-seasons', views_plot.CropSeasonViewSet, basename='crop-seasons')
router.register(r'activities', views_activity.ActivityLogViewSet, basename='activities')
router.register(r'audit-logs', views_audit.SystemAuditLogViewSet, basename='audit-logs')
router.register(r'promotions', views_promotion.PromotionLibraryViewSet, basename='promotions')
router.register(r'products', views_product.ProductMasterViewSet, basename='products')
router.register(r'import-jobs', views_import.ImportJobViewSet, basename='import-jobs')
router.register(r'recommendations', views_recommendation.RecommendationViewSet, basename='recommendations')
router.register(r'planner', views_planner.PlannerViewSet, basename='planner')
router.register(r'bulk-sends', views_bulk_send.BulkSendBatchViewSet, basename='bulk-sends')
router.register(r'field-visits', views_visit.FieldVisitViewSet, basename='field-visits')
router.register(r'call-logs', views_call.CallLogViewSet, basename='call-logs')

from . import views_dashboard

urlpatterns = [
    path('auth/login/', views.login_view, name='login'),
    path('auth/me/', views.me_view, name='auth_me'),
    path('auth/me', views.me_view),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/invalidate-session/', views.invalidate_session, name='invalidate_session'),
    path('dashboard/active_crops/', views_dashboard.ActiveCropsAPIView.as_view(), name='dashboard_active_crops'),
    path('dashboard/active_crops', views_dashboard.ActiveCropsAPIView.as_view()),
    path('active-crops/', views_dashboard.ActiveCropsAPIView.as_view(), name='active_crops_alias'),
    path('dashboard/farmer_plots/', views_dashboard.FarmerPlotsAPIView.as_view(), name='dashboard_farmer_plots'),
    path('dashboard/farmer_plots', views_dashboard.FarmerPlotsAPIView.as_view()),
    path('farmer-plots/', views_dashboard.FarmerPlotsAPIView.as_view(), name='farmer_plots_alias'),
    path('dashboard/hierarchy/', views_dashboard.HierarchyAPIView.as_view(), name='dashboard_hierarchy'),
    path('dashboard/hierarchy', views_dashboard.HierarchyAPIView.as_view()),
    path('hierarchy/', views_dashboard.HierarchyAPIView.as_view(), name='hierarchy_alias'),
    path('hierarchy', views_dashboard.HierarchyAPIView.as_view()),
    path('dashboard/', views_dashboard.DashboardAPIView.as_view(), name='dashboard'),
    path('export-report/', views_dashboard.ExportReportAPIView.as_view(), name='export_report'),
    path('config/', views_config.AppConfigurationView.as_view(), name='app_config'),
    path('farmers/<uuid:farmer_id>/timeline/', views_timeline.farmer_timeline_view, name='farmer_timeline'),
    path('sync/offline_batch/', views_sync.offline_batch_sync_view, name='offline_batch_sync'),
    path('field_visits/', views_visit.FieldVisitViewSet.as_view({'get': 'list', 'post': 'create'})),
    path('field_visits', views_visit.FieldVisitViewSet.as_view({'get': 'list', 'post': 'create'})),
    path('fieldvisits/', views_visit.FieldVisitViewSet.as_view({'get': 'list', 'post': 'create'})),
    path('fieldvisits', views_visit.FieldVisitViewSet.as_view({'get': 'list', 'post': 'create'})),
    path('field-visits', views_visit.FieldVisitViewSet.as_view({'get': 'list', 'post': 'create'})),
    path('', include(router.urls)),
]


