"""
Views package for the core app.
Re-exports all ViewSets for backward compatibility with URL routing.
"""
from .student_views import StudentViewSet, get_or_create_default_student
from .resume_views import ResumeViewSet
from .interview_views import InterviewSessionViewSet

__all__ = [
    'StudentViewSet',
    'ResumeViewSet', 
    'InterviewSessionViewSet',
    'get_or_create_default_student',
]
