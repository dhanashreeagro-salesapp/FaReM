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

from . import views_dashboard

urlpatterns = [
    path('auth/login/', views.login_view, name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/invalidate-session/', views.invalidate_session, name='invalidate_session'),
    path('dashboard/', views_dashboard.DashboardAPIView.as_view(), name='dashboard'),
    path('export-report/', views_dashboard.ExportReportAPIView.as_view(), name='export_report'),
    path('config/', views_config.AppConfigurationView.as_view(), name='app_config'),
    path('', include(router.urls)),
]
