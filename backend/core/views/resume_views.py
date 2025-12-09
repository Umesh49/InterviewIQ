"""
Resume ViewSet - Handles resume upload, parsing, and ATS scoring.
"""
import logging
import os
import re

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from ..models import Resume
from ..serializers import ResumeSerializer
from ..services import ResumeParserService
from .student_views import get_or_create_default_student

logger = logging.getLogger(__name__)


class ResumeViewSet(viewsets.ModelViewSet):
    """
    Resume upload and parsing.
    No authentication required - all resumes attached to default student.
    """
    queryset = Resume.objects.all()
    serializer_class = ResumeSerializer
    parser_classes = (MultiPartParser, FormParser)

    def get_queryset(self):
        """Return all resumes (no auth filtering)"""
        return Resume.objects.all().order_by('-created_at')

    def create(self, request, *args, **kwargs):
        """
        Upload and parse resume without authentication.
        Automatically attaches to default anonymous student.
        """
        try:
            logger.info('Resume upload - FILES: %s, DATA: %s', 
                       list(request.FILES.keys()), list(request.data.keys()))
        except Exception:
            logger.debug('Could not list request keys')

        # Validate file presence
        if 'file' not in request.FILES:
            return Response({
                'detail': 'No file uploaded. Please attach a PDF resume.',
                'field': 'file'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Get default student
        default_student = get_or_create_default_student()

        # Prepare data with default student
        data = request.data.copy()
        data['student'] = str(default_student.id)

        serializer = self.get_serializer(data=data)
        if not serializer.is_valid():
            logger.warning('Resume validation failed: %s', serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Save resume
            resume = serializer.save(student=default_student)
            
            # Parse resume
            logger.info(f"Parsing resume: {resume.file.path}")
            parsed_data = ResumeParserService.parse_resume(resume.file.path)
            resume.parsed_content = parsed_data
            resume.save()
            
            logger.info(f"Resume parsed successfully - Skills: {len(parsed_data.get('skills', []))}")
            
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
            
        except Exception as e:
            logger.exception('Error saving or parsing resume: %s', e)
            return Response({
                'detail': f'Failed to save or parse resume: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def destroy(self, request, *args, **kwargs):
        """
        Delete a resume and its associated file.
        
        Permanently removes:
        - Resume database record
        - Uploaded PDF file from storage
        - Parsed content data
        
        This is irreversible. Sessions using this resume will still work
        but won't have resume context for new question generation.
        """
        try:
            resume = self.get_object()
            resume_id = resume.id
            
            # Delete the physical file if it exists
            if resume.file:
                try:
                    if os.path.exists(resume.file.path):
                        os.remove(resume.file.path)
                        logger.info(f"Deleted resume file: {resume.file.path}")
                except Exception as file_error:
                    logger.warning(f"Could not delete resume file: {file_error}")
            
            # Delete the database record
            resume.delete()
            
            logger.info(f"Deleted resume {resume_id}")
            return Response({
                'status': 'Resume deleted successfully',
                'id': str(resume_id)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.exception('Error deleting resume: %s', e)
            return Response({
                'error': str(e),
                'detail': 'Failed to delete resume'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], parser_classes=[JSONParser])
    def ats_score(self, request, pk=None):
        """
        ATS Scanner: Analyze resume against job description using AI.
        
        Uses AI to extract relevant keywords from the job description,
        then compares against resume content for compatibility scoring.
        
        Payload:
        - job_description: str (the JD text to match against)
        
        Returns:
        - score: int (0-100)
        - matching_keywords: list
        - missing_keywords: list
        - suggestions: list
        """
        from ..services import call_ai, HAS_GEMINI, HAS_OPENROUTER
        
        try:
            resume = self.get_object()
            job_description = request.data.get('job_description', '').strip()
            
            if not job_description:
                return Response({
                    'error': 'job_description is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get resume content
            parsed = resume.parsed_content or {}
            resume_text = ' '.join([
                parsed.get('summary', ''),
                ' '.join(str(s) for s in parsed.get('skills', [])),
                ' '.join([exp.get('description', '') for exp in parsed.get('experience', []) if isinstance(exp, dict)]),
                ' '.join([proj.get('description', '') for proj in parsed.get('projects', []) if isinstance(proj, dict)])
            ]).lower()
            
            # Use AI to extract keywords from JD
            jd_keywords = []
            if HAS_GEMINI or HAS_OPENROUTER:
                try:
                    prompt = f"""Extract the most important keywords and skills from this job description.
Return ONLY a JSON array of lowercase keywords (max 20).
Focus on: technical skills, tools, frameworks, soft skills, and qualifications.

Job Description:
{job_description[:3000]}

Return format: ["keyword1", "keyword2", "keyword3"]"""
                    
                    response = call_ai(prompt, temperature=0.3)
                    if response:
                        import json
                        json_str = response.replace('```json', '').replace('```', '').strip()
                        jd_keywords = json.loads(json_str)
                        jd_keywords = [kw.lower().strip() for kw in jd_keywords if isinstance(kw, str)]
                        logger.info(f"AI extracted {len(jd_keywords)} keywords from JD")
                except Exception as e:
                    logger.warning(f"AI keyword extraction failed: {e}, using fallback")
            
            # Fallback: extract words from JD if AI fails
            if not jd_keywords:
                words = re.findall(r'\b[a-zA-Z]{3,}\b', job_description.lower())
                common_words = {'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 
                               'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'will', 'with',
                               'this', 'that', 'from', 'they', 'would', 'there', 'their', 'what', 'about',
                               'which', 'when', 'make', 'like', 'time', 'just', 'know', 'take', 'into'}
                jd_keywords = list(set(w for w in words if w not in common_words))[:20]
            
            # Find matches and misses
            matching = [kw for kw in jd_keywords if kw in resume_text]
            missing = [kw for kw in jd_keywords if kw not in resume_text]
            
            # Calculate score
            if len(jd_keywords) > 0:
                score = int((len(matching) / len(jd_keywords)) * 100)
            else:
                score = 50
            
            # Generate AI suggestions if available
            suggestions = []
            if missing and (HAS_GEMINI or HAS_OPENROUTER):
                try:
                    suggestion_prompt = f"""Based on these missing keywords from a job description: {missing[:10]}
Give 2-3 brief, actionable suggestions for improving the resume. Keep each under 15 words.
Return as JSON array: ["suggestion1", "suggestion2"]"""
                    
                    suggestion_response = call_ai(suggestion_prompt, temperature=0.7)
                    if suggestion_response:
                        import json
                        json_str = suggestion_response.replace('```json', '').replace('```', '').strip()
                        suggestions = json.loads(json_str)
                except Exception:
                    pass
            
            # Fallback suggestions
            if not suggestions:
                if missing:
                    suggestions.append(f"Add these keywords: {', '.join(missing[:5])}")
                if score < 60:
                    suggestions.append("Tailor your resume more specifically to this job")
                if score >= 80:
                    suggestions.append("Good match! Your resume aligns well with this job.")
            
            logger.info(f"ATS score for resume {resume.id}: {score}%")
            
            return Response({
                'score': score,
                'matching_keywords': matching,
                'missing_keywords': missing,
                'suggestions': suggestions[:5],
                'total_jd_keywords': len(jd_keywords),
                'matched_count': len(matching)
            })
            
        except Exception as e:
            logger.exception('Error calculating ATS score: %s', e)
            return Response({
                'error': str(e),
                'detail': 'Failed to analyze resume'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
