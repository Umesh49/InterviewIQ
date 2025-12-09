"""
Student ViewSet - Handles student management.
"""
import logging
import os

from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import Student, Resume, InterviewSession, InterviewResponse
from ..serializers import StudentSerializer

logger = logging.getLogger(__name__)


def get_or_create_default_student():
    """
    Get or create a default anonymous student for all users.
    No login required - everyone uses the same student account.
    """
    default_student, created = Student.objects.get_or_create(
        username='anonymous_user',
        defaults={
            'email': 'anonymous@mockinterview.com',
            'first_name': 'Anonymous',
            'last_name': 'User'
        }
    )
    if created:
        logger.info("Created default anonymous student")
    return default_student


class StudentViewSet(viewsets.ModelViewSet):
    """
    Student management - simplified for no-login flow.
    All users share the anonymous_user account.
    """
    queryset = Student.objects.all()
    serializer_class = StudentSerializer

    @action(detail=False, methods=['delete'])
    def delete_all_data(self, request):
        """
        HARD DELETE all user data for privacy compliance.
        This permanently removes:
        - All resumes and their files
        - All interview sessions
        - All interview responses
        """
        try:
            with transaction.atomic():
                # Delete resume files from disk
                resumes = Resume.objects.all()
                for resume in resumes:
                    if resume.file and os.path.exists(resume.file.path):
                        try:
                            os.remove(resume.file.path)
                            logger.info(f"Deleted resume file: {resume.file.path}")
                        except Exception as e:
                            logger.warning(f"Could not delete file {resume.file.path}: {e}")
                
                # Hard delete all interview responses
                response_count = InterviewResponse.objects.all().delete()[0]
                
                # Hard delete all interview sessions
                session_count = InterviewSession.objects.all().delete()[0]
                
                # Hard delete all resumes
                resume_count = resumes.delete()[0]
                
                logger.info(f"Hard deleted: {resume_count} resumes, {session_count} sessions, {response_count} responses")
                
                return Response({
                    'success': True,
                    'message': 'All data permanently deleted',
                    'deleted': {
                        'resumes': resume_count,
                        'sessions': session_count,
                        'responses': response_count
                    }
                }, status=status.HTTP_200_OK)
                
        except Exception as e:
            logger.exception('Error deleting all data: %s', e)
            return Response({
                'error': str(e),
                'detail': 'Failed to delete data'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
