from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import StudentViewSet, ResumeViewSet, InterviewSessionViewSet
from django.conf import settings
from django.conf.urls.static import static

router = DefaultRouter()
router.register(r'students', StudentViewSet)
router.register(r'resumes', ResumeViewSet)
router.register(r'interviews', InterviewSessionViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
