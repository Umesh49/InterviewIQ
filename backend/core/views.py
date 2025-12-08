import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from django.conf import settings
from .models import Student, Resume, InterviewSession, Question, InterviewResponse
from .serializers import (
    StudentSerializer, ResumeSerializer, InterviewSessionSerializer, 
    QuestionSerializer, InterviewResponseSerializer
)
from .services import (
    ResumeParserService, InterviewEngine,
    get_pre_interview_tips, detect_performance_trend, 
    generate_beginner_encouragement
)
from .voice_service import VoiceService
from django.http import HttpResponse

logger = logging.getLogger(__name__)

# Import Gemini for clarify_question action
try:
    import google.generativeai as genai
    if settings.GEMINI_API_KEY:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        HAS_GEMINI = True
    else:
        HAS_GEMINI = False
except ImportError:
    HAS_GEMINI = False
    genai = None
except Exception:
    HAS_GEMINI = False
    genai = None

voice_service = None
try:
    voice_service = VoiceService()
except Exception as e:
    logger.error(f"Failed to initialize VoiceService: {e}")



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
            from django.db import transaction
            import os
            
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
                    import os
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
        ATS Scanner: Analyze resume against job description.
        
        Compares resume content with job description to calculate:
        - Overall ATS compatibility score (0-100)
        - Matching keywords found
        - Missing keywords to add
        - Specific suggestions for improvement
        
        Payload:
        - job_description: str (the JD text to match against)
        
        Returns:
        - score: int (0-100)
        - matching_keywords: list
        - missing_keywords: list
        - suggestions: list
        """
        try:
            resume = self.get_object()
            job_description = request.data.get('job_description', '').strip()
            
            if not job_description:
                return Response({
                    'error': 'job_description is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get resume content
            parsed = resume.parsed_content or {}
            resume_skills = set(s.lower() for s in parsed.get('skills', []))
            resume_text = ' '.join([
                parsed.get('summary', ''),
                ' '.join(parsed.get('skills', [])),
                ' '.join([exp.get('description', '') for exp in parsed.get('experience', [])]),
                ' '.join([proj.get('description', '') for proj in parsed.get('projects', [])])
            ]).lower()
            
            # Extract keywords from JD (simple extraction)
            import re
            jd_lower = job_description.lower()
            
            # Common tech keywords to look for
            tech_keywords = [
                'python', 'java', 'javascript', 'react', 'node', 'sql', 'aws', 'docker',
                'kubernetes', 'git', 'agile', 'scrum', 'api', 'rest', 'graphql', 'mongodb',
                'postgresql', 'redis', 'machine learning', 'ai', 'data science', 'tensorflow',
                'django', 'flask', 'spring', 'angular', 'vue', 'typescript', 'c++', 'go',
                'rust', 'linux', 'devops', 'ci/cd', 'testing', 'tdd', 'microservices'
            ]
            
            # Soft skills
            soft_keywords = [
                'communication', 'leadership', 'teamwork', 'problem solving', 'analytical',
                'collaboration', 'project management', 'time management', 'critical thinking'
            ]
            
            all_keywords = tech_keywords + soft_keywords
            
            # Find keywords in JD
            jd_keywords = [kw for kw in all_keywords if kw in jd_lower]
            
            # Find matches and misses
            matching = [kw for kw in jd_keywords if kw in resume_text]
            missing = [kw for kw in jd_keywords if kw not in resume_text]
            
            # Calculate score
            if len(jd_keywords) > 0:
                score = int((len(matching) / len(jd_keywords)) * 100)
            else:
                score = 50  # Default if no keywords found
            
            # Generate suggestions
            suggestions = []
            if missing:
                suggestions.append(f"Add these keywords to your resume: {', '.join(missing[:5])}")
            if score < 60:
                suggestions.append("Consider tailoring your resume more specifically to this job description")
            if score >= 80:
                suggestions.append("Great match! Your resume aligns well with this job.")
            if not parsed.get('skills'):
                suggestions.append("Add a dedicated Skills section to improve ATS scanning")
            
            logger.info(f"ATS score for resume {resume.id}: {score}%")
            
            return Response({
                'score': score,
                'matching_keywords': matching,
                'missing_keywords': missing,
                'suggestions': suggestions,
                'total_jd_keywords': len(jd_keywords),
                'matched_count': len(matching)
            })
            
        except Exception as e:
            logger.exception('Error calculating ATS score: %s', e)
            return Response({
                'error': str(e),
                'detail': 'Failed to analyze resume'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class InterviewSessionViewSet(viewsets.ModelViewSet):
    """
    Main interview session management.
    Handles the complete interview lifecycle:
    1. Create session
    2. Get pre-interview tips
    3. Start interview (generate questions)
    4. Submit responses
    5. Get encouragement
    6. Clarify questions
    7. Get final report
    """
    queryset = InterviewSession.objects.all()
    serializer_class = InterviewSessionSerializer

    def get_queryset(self):
        """Return all sessions ordered by newest first"""
        return InterviewSession.objects.all().order_by('-created_at')

    def create(self, request, *args, **kwargs):
        """
        Create a new interview session.
        No authentication required - uses default student.
        
        Required fields:
        - position: str (e.g., "Software Engineer")
        - difficulty: str (Easy/Medium/Hard)
        - experience_level: str (e.g., "0-2 years")
        - resume: UUID (optional)
        """
        try:
            logger.info('Interview create - DATA keys: %s', list(request.data.keys()))
        except Exception:
            logger.debug('Could not list request keys')

        data = request.data.copy()

        # Attach default student
        default_student = get_or_create_default_student()
        data['student'] = str(default_student.id)

        # Validate required fields
        required_fields = ['position', 'difficulty', 'experience_level']
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            return Response({
                'detail': f'Missing required fields: {", ".join(missing_fields)}',
                'missing_fields': missing_fields
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=data)
        if not serializer.is_valid():
            logger.warning('Interview validation failed: %s', serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = serializer.save(student=default_student)
            logger.info(f"Created interview session {session.id} for {session.position}")
            
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
            
        except Exception as e:
            logger.exception('Error creating interview: %s', e)
            return Response({
                'detail': f'Failed to create interview session: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def speak(self, request):
        """
        Generate speech from text using Deepgram Aura TTS via Backend SDK.
        Expects { "text": "..." }
        Returns audio/mpeg stream.
        """
        text = request.data.get('text')
        if not text:
            return Response({"error": "Text is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if not voice_service:
                return Response({"error": "Voice service not initialized"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
                
            audio_data = voice_service.generate_speech(text)
            
            if not audio_data:
                 return Response({"error": "Failed to generate audio"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            response = HttpResponse(audio_data, content_type='audio/mpeg')
            response['Content-Disposition'] = 'inline; filename="tts_output.mp3"'
            return response

        except Exception as e:
            logger.exception("TTS generation failed: %s", e)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def pre_interview_tips(self, request, pk=None):
        """
        STEP 1: Get preparation tips before starting interview.
        
        Returns:
        - preparation: List of pre-interview prep tips
        - star_method: Explanation with example
        - example_answer: Sample STAR answer
        - common_mistakes: Things to avoid
        - mindset: Motivational messages
        
        Call this BEFORE start_interview to show tips modal.
        """
        try:
            session = self.get_object()
            tips = get_pre_interview_tips(
                position=session.position,
                experience_level=session.experience_level
            )
            logger.info(f"Provided pre-interview tips for session {session.id}")
            return Response(tips)
            
        except Exception as e:
            logger.exception('Error getting pre-interview tips: %s', e)
            # Fallback tips
            return Response({
                "preparation": [
                    "📋 Have your resume ready to reference",
                    "💧 Keep water nearby - dry mouth is normal when nervous",
                    "😊 Smile before you start - it helps you sound confident",
                    "⏸️ It's okay to pause and think before answering"
                ],
                "star_method": {
                    "explanation": "Structure answers with STAR: Situation, Task, Action, Result",
                    "S": "Situation - Set the scene (1 sentence)",
                    "T": "Task - What needed to be done (1 sentence)",
                    "A": "Action - What YOU did (2-3 sentences)",
                    "R": "Result - Outcome with numbers if possible (1 sentence)"
                },
                "common_mistakes": [
                    "❌ Don't say 'I don't know' - try 'I haven't worked with that, but here's how I'd approach it'",
                    "❌ Don't memorize answers - practice key points and speak naturally",
                    "❌ Don't rush - interviewers prefer thoughtful slower answers"
                ],
                "mindset": [
                    "🎯 This is PRACTICE - mistakes help you improve",
                    "💪 Even senior engineers get nervous in interviews",
                    "📈 Your first answer will be rough - that's normal!"
                ]
            })

    @action(detail=True, methods=['post'])
    def start_interview(self, request, pk=None):
        """
        STEP 2: Generate questions and start the interview.
        
        Generates 12-15 questions based on:
        - Resume content (skills, projects, experience)
        - Position (technical vs non-technical)
        - Difficulty level
        - Experience level
        
        Questions are progressively ordered:
        1-2: Easy warmup questions
        3-8: Core behavioral/technical questions
        9-11: Challenging questions
        12: Easy closing question
        
        Returns:
        - status: "Interview Started"
        - questions: List of Question objects with category, order, coaching_tip
        """
        try:
            session = self.get_object()
            
            if session.status == 'Started':
                # Check if questions exist
                questions = Question.objects.filter(session=session).order_by('order')
                if questions.exists():
                    logger.warning(f"Session {session.id} already started with {questions.count()} questions")
                    return Response({
                        'status': 'Interview Already Started',
                        'questions': QuestionSerializer(questions, many=True).data
                    })
                else:
                    # Session marked started but no questions (AI failed) - reset and retry
                    logger.warning(f"Session {session.id} marked started but has 0 questions - regenerating")
                    session.status = 'Created'
                    session.save()
            
            logger.info(f"Starting interview for session {session.id}")
            
            # Generate Questions with progressive ordering
            resume_data = session.resume.parsed_content if session.resume else {}
            logger.info(f"Resume data available: {bool(resume_data)}, Skills: {len(resume_data.get('skills', []))}")
            
            # Fetch recently asked questions for this student to prevent repetition
            # Get last 50 questions from previous sessions
            previous_questions = Question.objects.filter(
                session__student=session.student
            ).exclude(
                session=session # Don't exclude questions if we are regenerating for THIS session (though status check prevents that)
            ).order_by('-created_at')[:50].values_list('text', flat=True)
            
            excluded_questions = list(previous_questions)
            logger.info(f"Found {len(excluded_questions)} previously asked questions to exclude")

            questions_data = InterviewEngine.generate_questions(
                resume_data=resume_data,
                position=session.position,
                difficulty=session.difficulty,
                dialect=session.dialect,
                experience_level=session.experience_level,
                excluded_questions=excluded_questions
            )
            
            logger.info(f"Generated {len(questions_data)} questions")
            
            # Deduplicate questions (Fuzzy Matching)
            import difflib
            unique_questions = []
            
            for q in questions_data:
                is_duplicate = False
                new_text = q['text'].lower().strip()
                
                for existing in unique_questions:
                    existing_text = existing['text'].lower().strip()
                    
                    # Check similarity
                    similarity = difflib.SequenceMatcher(None, new_text, existing_text).ratio()
                    if similarity > 0.8:  # 80% similar
                        is_duplicate = True
                        logger.info(f"Duplicate/Similar question skipped: '{q['text']}' vs '{existing['text']}' ({similarity:.2f})")
                        break
                
                if not is_duplicate:
                    unique_questions.append(q)
            
            logger.info(f"After deduplication: {len(unique_questions)} unique questions")
            
            # Limit to 12-15 questions
            unique_questions = unique_questions[:15]
            
            # Save Questions (already ordered progressively from services.py)
            created_questions = []
            for idx, q_data in enumerate(unique_questions):
                question = Question.objects.create(
                    session=session,
                    text=q_data['text'],
                    category=q_data.get('category', 'General'),
                    order=idx + 1
                )
                created_questions.append(question)
                
            session.status = 'Started'
            session.save()
            
            logger.info(f"Interview started successfully with {len(created_questions)} questions")
            
            # Serialize Questions
            questions_serializer = QuestionSerializer(created_questions, many=True)
            
            return Response({
                'status': 'Interview Started', 
                'questions': questions_serializer.data,
                'total_questions': len(created_questions)
            })
            
        except Exception as e:
            logger.exception('Error starting interview: %s', e)
            import traceback
            error_details = traceback.format_exc()
            
            return Response({
                'error': str(e),
                'detail': 'Failed to start interview. Please try again.',
                'debug': error_details if settings.DEBUG else None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def submit_response(self, request, pk=None):
        """
        STEP 3: Submit answer for a question.
        
        Required fields:
        - question_id: UUID
        - transcript: str (the answer text)
        - fluency_metrics: dict (voice metrics from frontend)
        
        Optional fields:
        - audio_file: File
        - video: File
        - metrics_timeline: list (for graphs)
        
        Returns complete feedback including:
        - Detailed positives (what they did well)
        - Detailed improvements (specific fixes)
        - Beginner tips (actionable advice)
        - Encouragement message (motivational)
        - Performance trend (improving/consistent/struggling)
        - Grammar errors
        - STAR method usage
        - Sentiment score
        """
        try:
            session = self.get_object()
            question_id = request.data.get('question_id')
            transcript = request.data.get('transcript', '').strip()
            
            if not question_id:
                return Response({
                    'error': 'question_id is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if not transcript:
                # Allow skipping - use default message
                transcript = "[Question skipped - no answer provided]"
            
            # Check if question was skipped
            is_skipped = transcript == "[Question skipped - no answer provided]"
            
            # Get files
            audio_file = request.FILES.get('audio_file')
            
            # Parse JSON metrics
            import json
            fluency_metrics_raw = request.data.get('fluency_metrics', '{}')
            if isinstance(fluency_metrics_raw, str):
                try:
                    fluency_metrics = json.loads(fluency_metrics_raw)
                except json.JSONDecodeError:
                    logger.warning("Invalid fluency_metrics JSON, using empty dict")
                    fluency_metrics = {}
            else:
                fluency_metrics = fluency_metrics_raw

            # Parse metrics timeline
            metrics_timeline_raw = request.data.get('metrics_timeline', '[]')
            if isinstance(metrics_timeline_raw, str):
                try:
                    metrics_timeline = json.loads(metrics_timeline_raw)
                except json.JSONDecodeError:
                    metrics_timeline = []
            else:
                metrics_timeline = metrics_timeline_raw

            # Get question
            question = get_object_or_404(Question, id=question_id, session=session)
            
            # Extract voice metrics (needed for both skipped and answered questions)
            voice_metrics = fluency_metrics.get('voiceMetrics', {})
            
            # Handle skipped questions with special feedback
            if is_skipped:
                logger.info(f"Question {question.id} was skipped")
                analysis = {
                    'is_answer_correct': False,
                    'correctness_feedback': 'Question was not answered. The AI cannot evaluate correctness without a response.',
                    'sentiment_score': 0,
                    'grammar_errors': [],
                    'feedback_text': 'Question was skipped. Try to answer all questions for better practice.',
                    'strengths': ['Knowing when to move on can be strategic in real interviews'],
                    'weaknesses': ['Try to attempt every question, even with a partial answer', 'Practice builds confidence - skip less over time'],
                    'improvement_tips': ['Even a brief answer shows effort', 'Say "I would approach this by..." if unsure'],
                    'recommended_resources': [
                        {"title": "How to Answer Interview Questions You Don't Know", "url": "https://www.youtube.com/watch?v=qIi4Xt769wQ", "topic": "Handling unknown questions"},
                        {"title": "Interview Tips for Beginners", "url": "https://www.youtube.com/watch?v=HG68Ymazo18", "topic": "Basic interview skills"}
                    ],
                    'star_method_used': False,
                    'content_quality_score': 0
                }
            else:
                logger.info(f"Analyzing response for question {question.id}: '{transcript[:50]}...'")
                
                # AI Analysis with beginner-friendly enhancements
                analysis = InterviewEngine.analyze_response(
                    question_text=question.text,
                    user_transcript=transcript,
                    fluency_metrics=fluency_metrics
            )
            
            logger.info(f"Analysis complete - Sentiment: {analysis.get('sentiment_score', 0):.2f}, STAR: {analysis.get('star_method_used', False)}")
            
            # Save response with all feedback
            response = InterviewResponse.objects.create(
                question=question,
                transcript=transcript,
                audio_file=audio_file,
                metrics_timeline=metrics_timeline,
                fluency_score=fluency_metrics.get('fluency_score', 0),
                eye_contact_score=fluency_metrics.get('eyeContact', 0),
                posture_score=1.0 if fluency_metrics.get('posture') == 'Good' else 0.5,
                body_language_metadata={
                    "fidget_score": fluency_metrics.get('fidgetScore', 0),
                    "gaze_distribution": fluency_metrics.get('gazeDistribution', {}),
                    "voice_metrics": voice_metrics,
                    "star_method_used": analysis.get('star_method_used', False),
                    "content_quality_score": analysis.get('content_quality_score', 0)
                },
                sentiment_score=analysis.get('sentiment_score', 0),
                grammar_errors=analysis.get('grammar_errors', []),
                feedback_text=analysis.get('feedback_text', ''),
                detailed_positives=analysis.get('detailed_positives', []),
                detailed_improvements=analysis.get('detailed_improvements', []),
                improvement_tips=analysis.get('improvement_tips', [])
            )
            
            # Serialize response
            resp_data = InterviewResponseSerializer(response).data
            
            # Add beginner tips if available
            if 'beginner_tips' in analysis:
                resp_data['beginner_tips'] = analysis['beginner_tips']
            
            # Add encouragement based on progress
            response_count = InterviewResponse.objects.filter(
                question__session=session
            ).count()
            
            recent_responses = list(
                InterviewResponse.objects.filter(question__session=session)
                .order_by('-created_at')[:3]
            )
            
            trend = detect_performance_trend(recent_responses)
            encouragement = generate_beginner_encouragement(response_count, trend)
            
            resp_data['encouragement'] = encouragement
            resp_data['performance_trend'] = trend
            resp_data['response_number'] = response_count
            resp_data['total_questions'] = session.questions.count()
            
            logger.info(f"Response saved - #{response_count}/{session.questions.count()}, Trend: {trend}")
            
            return Response(resp_data)
            
        except Question.DoesNotExist:
            return Response({
                'error': 'Question not found or does not belong to this session'
            }, status=status.HTTP_404_NOT_FOUND)
            
        except Exception as e:
            logger.exception('Error submitting response: %s', e)
            import traceback
            error_details = traceback.format_exc()
            
            return Response({
                'error': str(e),
                'detail': 'Failed to submit response. Please try again.',
                'debug': error_details if settings.DEBUG else None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def get_encouragement(self, request, pk=None):
        """
        STEP 3.5 (Optional): Get adaptive encouragement.
        
        Can be called after submit_response if you want to fetch
        encouragement separately (though submit_response already includes it).
        
        Payload:
        - response_count: int (current question number)
        
        Returns:
        - message: Encouraging text
        - trend: improving/consistent/struggling
        - response_count: Current progress
        """
        try:
            session = self.get_object()
            response_count = request.data.get('response_count', 0)
            
            # Get recent responses to detect trend
            recent_responses = list(
                InterviewResponse.objects.filter(question__session=session)
                .order_by('-created_at')[:3]
            )
            
            trend = detect_performance_trend(recent_responses)
            encouragement = generate_beginner_encouragement(response_count, trend)
            
            return Response({
                'message': encouragement,
                'trend': trend,
                'response_count': response_count,
                'total_questions': session.questions.count()
            })
            
        except Exception as e:
            logger.exception('Error getting encouragement: %s', e)
            # Fallback encouragement
            return Response({
                'message': 'Keep going! You\'re doing great! 💪',
                'trend': 'consistent'
            })

    @action(detail=True, methods=['post'])
    def clarify_question(self, request, pk=None):
        """
        STEP 3.5 (Optional): Get hint for current question.
        
        Fairness Feature: Helps candidates understand what's being asked.
        
        Payload:
        - question_id: UUID
        
        Returns:
        - hint: Helpful explanation (does NOT give the answer)
        
        Uses AI (Gemini) if available, otherwise smart rule-based hints.
        """
        question_id = request.data.get('question_id')
        
        if not question_id:
            return Response({
                'error': 'question_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            question = Question.objects.get(id=question_id)
            
            logger.info(f"Clarifying question {question.id}: {question.text[:50]}...")
            
            # Try Gemini (Real AI)
            if HAS_GEMINI:
                try:
                    model = genai.GenerativeModel('gemini-pro')
                    prompt = f"""Provide a helpful hint for a BEGINNER student answering this interview question: 
'{question.text}'

Do not give the answer, just:
1. Explain what the question is asking in simpler terms
2. Suggest a structure (like STAR for behavioral questions)
3. Give one example of what kind of information to include

Keep it encouraging and brief (2-3 sentences)."""
                    
                    response = model.generate_content(prompt)
                    logger.info("Generated AI hint for question")
                    return Response({'hint': response.text})
                    
                except Exception as e:
                    logger.warning(f"Gemini hint error: {e}, falling back to rules")
            
            # Smart Fallback (Rule-Based) - Enhanced for beginners
            category = question.category.lower() if question.category else 'general'
            
            if 'behavioral' in category:
                hint = "This is a behavioral question. Use the STAR method: Situation (what happened), Task (what needed to be done), Action (what YOU did), Result (what was the outcome). Think of a specific example from your experience."
            elif 'technical' in category:
                hint = f"This is a technical question. Start by defining the key concept, then explain how it works with a simple example. If you've used this in a project, mention that!"
            elif 'project' in category:
                hint = "Talk about a specific project you worked on. Explain: What was the project? What was your role? What challenges did you face? What did you learn?"
            else:
                hint = "Break your answer into clear parts: Start with the main point, then give a specific example with details, and end with what you learned or the outcome."
            
            logger.info(f"Using fallback hint for category: {category}")
            return Response({'hint': hint})
            
        except Question.DoesNotExist:
            return Response({
                'error': 'Question not found'
            }, status=status.HTTP_404_NOT_FOUND)
            
        except Exception as e:
            logger.exception('Error clarifying question: %s', e)
            return Response({
                'hint': 'Take a moment to think about the question. What specific example from your experience relates to this? Try structuring your answer with: Situation → What you did → Result.'
            })

    @action(detail=True, methods=['get'])
    def get_result(self, request, pk=None):
        """
        STEP 4: Get comprehensive final report.
        
        Call this after all questions are answered.
        
        Generates (or returns cached) detailed performance report:
        - Overall score (0-100)
        - Category scores (Communication, Content, Technical, Behavioral)
        - Strengths (what they did well)
        - Areas for improvement (specific issues)
        - Recommendations (actionable next steps)
        - Key insights (AI-generated or calculated)
        - Progress note (motivational)
        - Detailed breakdown (metrics, grammar, STAR usage)
        - All responses with individual feedback
        
        Uses AI (Gemini/OpenAI/Perplexity) for personalized insights,
        falls back to metric-based analysis if AI unavailable.
        """
        try:
            session = self.get_object()
            
            logger.info(f"Generating final report for session {session.id}")
            
            # Generate or fetch cached report
            report = InterviewEngine.generate_final_report(session.id)
            
            if 'error' in report:
                logger.error(f"Report generation error: {report['error']}")
                return Response(report, status=status.HTTP_400_BAD_REQUEST)
            
            # Add all responses with individual feedback
            responses = InterviewResponse.objects.filter(
                question__session=session
            ).select_related('question').order_by('question__order', 'created_at')
            
            report['responses'] = InterviewResponseSerializer(responses, many=True).data
            report['total_responses'] = responses.count()
            
            # Mark session as completed
            if session.status != 'Completed':
                session.status = 'Completed'
                session.overall_score = report.get('overall_score', 0)
                session.save()
                logger.info(f"Session {session.id} marked as completed with score {session.overall_score}")
            
            return Response(report)
            
        except Exception as e:
            logger.exception('Error getting result: %s', e)
            import traceback
            error_details = traceback.format_exc()
            
            return Response({
                'error': str(e),
                'detail': 'Failed to generate report. Please try again.',
                'debug': error_details if settings.DEBUG else None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def student_progress(self, request):
        """
        Get historical progress data across all completed sessions.
        
        Returns time-series data for tracking improvement:
        - date: Session date
        - overall: Overall score
        - communication: Communication score
        - content: Content quality score
        
        Useful for showing progress charts.
        """
        try:
            sessions = InterviewSession.objects.filter(
                status='Completed'
            ).order_by('created_at')[:10]
            
            progress_data = []
            for s in sessions:
                if s.feedback_report:
                    report = s.feedback_report
                    progress_data.append({
                        'date': s.created_at.strftime("%Y-%m-%d"),
                        'session_id': str(s.id),
                        'position': s.position,
                        'overall': report.get('overall_score', 0),
                        'communication': next(
                            (c['score'] for c in report.get('category_scores', []) 
                             if c['name'] == 'Communication'), 
                            0
                        ),
                        'content': next(
                            (c['score'] for c in report.get('category_scores', []) 
                             if c['name'] == 'Content Quality'), 
                            0
                        ),
                    })
            
            logger.info(f"Retrieved progress data for {len(progress_data)} sessions")
            return Response(progress_data)
            
        except Exception as e:
            logger.exception('Error getting student progress: %s', e)
            return Response({
                'error': str(e),
                'detail': 'Failed to retrieve progress data'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    @action(detail=True, methods=['delete'])
    def delete_session(self, request, pk=None):
        """
        Privacy Feature: Delete session and all associated data.
        
        Permanently removes:
        - Session record
        - All questions
        - All responses (including transcripts)
        - Audio/video files (if stored)
        
        This is irreversible.
        """
        try:
            session = self.get_object()
            session_id = session.id
            
            # Delete cascades to questions and responses automatically
            session.delete()
            
            logger.info(f"Deleted session {session_id}")
            return Response({
                'status': 'Session deleted successfully',
                'session_id': str(session_id)
            }, status=status.HTTP_204_NO_CONTENT)
            
        except Exception as e:
            logger.exception('Error deleting session: %s', e)
            return Response({
                'error': str(e),
                'detail': 'Failed to delete session'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def resources(self, request):
        """
        Resource Hub: Curated interview preparation resources.
        
        Returns categorized guides, tips, and external resources
        organized for easy consumption by freshers.
        
        Categories:
        - interview_basics: Fundamental interview skills
        - star_method: STAR answer framework with examples
        - common_questions: Frequently asked questions by role
        - body_language: Non-verbal communication tips
        - resume_tips: Resume optimization advice
        """
        resources = {
            "interview_basics": {
                "title": "Interview Fundamentals",
                "icon": "BookOpen",
                "items": [
                    {
                        "title": "How to Introduce Yourself",
                        "description": "Craft a compelling 60-second introduction that highlights your value",
                        "tips": [
                            "Start with your current role/studies",
                            "Highlight 2-3 key achievements",
                            "End with why you're excited about this role"
                        ]
                    },
                    {
                        "title": "Research the Company",
                        "description": "Know the company inside out before your interview",
                        "tips": [
                            "Check their website, LinkedIn, and recent news",
                            "Understand their products/services",
                            "Know their mission and values"
                        ]
                    },
                    {
                        "title": "Questions to Ask the Interviewer",
                        "description": "Show engagement by asking thoughtful questions",
                        "examples": [
                            "What does success look like in this role?",
                            "How would you describe the team culture?",
                            "What are the biggest challenges for this position?"
                        ]
                    }
                ]
            },
            "star_method": {
                "title": "STAR Method Mastery",
                "icon": "Star",
                "description": "The proven framework for answering behavioral questions",
                "components": {
                    "S": {"name": "Situation", "tip": "Set the context in 1-2 sentences"},
                    "T": {"name": "Task", "tip": "Explain what you needed to accomplish"},
                    "A": {"name": "Action", "tip": "Describe what YOU specifically did (2-3 sentences)"},
                    "R": {"name": "Result", "tip": "Share the outcome with metrics if possible"}
                },
                "example": {
                    "question": "Tell me about a time you handled a difficult team situation",
                    "answer": {
                        "S": "During my final year project, two team members had a conflict about technical approach.",
                        "T": "As team lead, I needed to resolve this and keep us on track for our deadline.",
                        "A": "I scheduled a meeting, let each person explain their view, then facilitated finding common ground. We created a hybrid solution using the best parts of both approaches.",
                        "R": "The project was completed on time, scored 95%, and both members later thanked me for handling it professionally."
                    }
                }
            },
            "common_questions": {
                "title": "Common Interview Questions",
                "icon": "HelpCircle",
                "categories": [
                    {
                        "name": "Behavioral",
                        "questions": [
                            "Tell me about yourself",
                            "What's your greatest strength/weakness?",
                            "Describe a challenge you overcame",
                            "Tell me about a time you failed"
                        ]
                    },
                    {
                        "name": "Technical (General)",
                        "questions": [
                            "Explain [technology] to a 5-year-old",
                            "How do you stay updated with tech trends?",
                            "Walk me through a project you built",
                            "How do you approach debugging?"
                        ]
                    },
                    {
                        "name": "Situational",
                        "questions": [
                            "How would you handle a tight deadline?",
                            "What if you disagreed with your manager?",
                            "How do you prioritize tasks?"
                        ]
                    }
                ]
            },
            "body_language": {
                "title": "Body Language Tips",
                "icon": "User",
                "tips": [
                    {"do": "Maintain eye contact 60-70% of the time", "dont": "Stare constantly or avoid eye contact"},
                    {"do": "Sit upright with shoulders back", "dont": "Slouch or lean too far back"},
                    {"do": "Use natural hand gestures", "dont": "Fidget or touch your face repeatedly"},
                    {"do": "Smile when appropriate", "dont": "Keep a blank expression throughout"},
                    {"do": "Nod to show understanding", "dont": "Nod excessively or interrupt"}
                ]
            },
            "resume_tips": {
                "title": "Resume Best Practices",
                "icon": "FileText",
                "tips": [
                    "Keep it to 1 page for less than 5 years experience",
                    "Use action verbs: Led, Built, Improved, Achieved",
                    "Quantify achievements with numbers when possible",
                    "Tailor keywords to match the job description",
                    "Use a clean, ATS-friendly format",
                    "Proofread multiple times for errors"
                ]
            }
        }
        
        logger.info("Served resources to user")
        return Response(resources)

    @action(detail=False, methods=['get'])
    def daily_tip(self, request):
        """
        Quick Tips: Random daily interview advice.
        
        Returns a rotating tip from a curated pool.
        Different tip each time the endpoint is called.
        
        Categories: behavioral, technical, mindset, body_language
        """
        import random
        
        tips = [
            {"category": "mindset", "tip": "Treat the interview as a conversation, not an interrogation. You're evaluating them too!", "icon": "💡"},
            {"category": "behavioral", "tip": "Always use specific examples, not hypothetical answers. Real stories are more convincing.", "icon": "📝"},
            {"category": "technical", "tip": "It's okay to say 'I don't know, but here's how I'd figure it out.' Shows problem-solving.", "icon": "🔧"},
            {"category": "body_language", "tip": "Keep a glass of water nearby. Sipping gives you time to think on tough questions.", "icon": "💧"},
            {"category": "mindset", "tip": "Prepare 3 stories that showcase different skills. You can adapt them to many questions.", "icon": "📚"},
            {"category": "behavioral", "tip": "End your STAR answers by connecting the result to the role you're applying for.", "icon": "⭐"},
            {"category": "technical", "tip": "When asked about a technology you don't know, relate it to something similar you DO know.", "icon": "🔗"},
            {"category": "body_language", "tip": "Mirror the interviewer's energy level. If they're enthusiastic, match that energy.", "icon": "🪞"},
            {"category": "mindset", "tip": "Arrive 10-15 minutes early. Use that time to calm your nerves and review notes.", "icon": "⏰"},
            {"category": "behavioral", "tip": "When describing failures, focus 80% on what you learned and did differently after.", "icon": "📈"},
            {"category": "technical", "tip": "Practice explaining your projects to non-technical friends. Clarity beats jargon.", "icon": "🎯"},
            {"category": "body_language", "tip": "Sit with your hands visible on the table. Hidden hands can seem untrustworthy.", "icon": "🙌"},
            {"category": "mindset", "tip": "Rejection isn't failure—it's redirection. Each interview makes you better for the next.", "icon": "🔄"},
            {"category": "behavioral", "tip": "Use 'I' not 'we' when describing achievements. Own your contributions.", "icon": "👤"},
            {"category": "technical", "tip": "Before diving into a solution, ask clarifying questions. It shows thoroughness.", "icon": "❓"},
        ]
        
        tip = random.choice(tips)
        logger.info(f"Served daily tip: {tip['category']}")
        return Response(tip)

    @action(detail=False, methods=['get'])
    def detailed_analytics(self, request):
        """
        Analytics Dashboard: Comprehensive performance insights.
        
        Aggregates data across all completed sessions to show:
        - Overall performance trends
        - Category score breakdown
        - Strength areas
        - Areas needing improvement
        - Session-by-session comparison
        - Personalized recommendations
        """
        try:
            sessions = InterviewSession.objects.filter(
                status='Completed'
            ).order_by('-created_at')[:20]
            
            if not sessions.exists():
                return Response({
                    'has_data': False,
                    'message': 'Complete some interviews to see your analytics!'
                })
            
            # Aggregate metrics
            total_sessions = sessions.count()
            scores = [s.overall_score or 0 for s in sessions if s.overall_score]
            avg_score = sum(scores) / len(scores) if scores else 0
            
            # Calculate trends (last 5 vs previous 5)
            recent_5 = scores[:5] if len(scores) >= 5 else scores
            previous_5 = scores[5:10] if len(scores) >= 10 else []
            
            recent_avg = sum(recent_5) / len(recent_5) if recent_5 else 0
            previous_avg = sum(previous_5) / len(previous_5) if previous_5 else recent_avg
            
            improvement = recent_avg - previous_avg
            trend = 'improving' if improvement > 2 else ('declining' if improvement < -2 else 'stable')
            
            # Category breakdown
            category_totals = {'Communication': [], 'Content Quality': [], 'Technical': [], 'Behavioral': []}
            
            for s in sessions:
                if s.feedback_report:
                    for cat in s.feedback_report.get('category_scores', []):
                        if cat['name'] in category_totals:
                            category_totals[cat['name']].append(cat['score'])
            
            category_scores = []
            for name, values in category_totals.items():
                if values:
                    category_scores.append({
                        'name': name,
                        'score': round(sum(values) / len(values), 1),
                        'sessions': len(values)
                    })
            
            # Find strengths and weaknesses
            sorted_cats = sorted(category_scores, key=lambda x: x['score'], reverse=True)
            strengths = [c['name'] for c in sorted_cats[:2] if c['score'] >= 60]
            weaknesses = [c['name'] for c in sorted_cats[-2:] if c['score'] < 70]
            
            # Session timeline
            timeline = []
            for s in sessions[:10]:
                timeline.append({
                    'id': str(s.id),
                    'date': s.created_at.strftime("%Y-%m-%d"),
                    'position': s.position,
                    'score': s.overall_score or 0,
                    'difficulty': s.difficulty
                })
            
            # Recommendations
            recommendations = []
            if avg_score < 50:
                recommendations.append("Focus on practicing the basics - start with easy difficulty interviews")
            if 'Communication' in weaknesses:
                recommendations.append("Work on speaking clearly and structuring your answers with STAR method")
            if 'Technical' in weaknesses:
                recommendations.append("Review fundamental concepts and practice explaining them simply")
            if trend == 'improving':
                recommendations.append("Great progress! Keep up the consistent practice")
            if total_sessions < 5:
                recommendations.append("Complete more practice sessions to get accurate insights")
            
            logger.info(f"Generated analytics for {total_sessions} sessions")
            
            return Response({
                'has_data': True,
                'overview': {
                    'total_sessions': total_sessions,
                    'average_score': round(avg_score, 1),
                    'best_score': max(scores) if scores else 0,
                    'trend': trend,
                    'improvement': round(improvement, 1)
                },
                'category_scores': category_scores,
                'strengths': strengths,
                'areas_to_improve': weaknesses,
                'timeline': timeline,
                'recommendations': recommendations
            })
            
        except Exception as e:
            logger.exception('Error generating analytics: %s', e)
            return Response({
                'error': str(e),
                'detail': 'Failed to generate analytics'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def company_prep(self, request):
        """
        Company Prep Bank: Company-specific interview preparation.
        
        Returns questions commonly asked at major tech companies,
        along with company culture info and hiring process details.
        
        Query params:
        - company: str (optional, filter by company name)
        """
        company_filter = request.query_params.get('company', '').lower()
        
        companies = {
            "tcs": {
                "name": "Tata Consultancy Services",
                "logo": "TCS",
                "culture": "Process-driven, learning-focused, global exposure",
                "hiring_process": ["Online Test", "Technical Round", "Managerial Round", "HR Round"],
                "tips": [
                    "Strong focus on aptitude and coding basics",
                    "Be prepared to discuss TCS Digital vs Ninja roles",
                    "Show willingness to relocate and work in teams"
                ],
                "common_questions": [
                    {"question": "Tell me about yourself", "category": "HR", "frequency": "Very Common"},
                    {"question": "Why do you want to join TCS?", "category": "HR", "frequency": "Very Common"},
                    {"question": "Explain OOP concepts with examples", "category": "Technical", "frequency": "Common"},
                    {"question": "What is your biggest weakness?", "category": "Behavioral", "frequency": "Common"},
                    {"question": "Where do you see yourself in 5 years?", "category": "HR", "frequency": "Common"},
                    {"question": "Explain any project you worked on", "category": "Technical", "frequency": "Very Common"},
                ]
            },
            "infosys": {
                "name": "Infosys",
                "logo": "Infosys",
                "culture": "Innovation-driven, strong training programs",
                "hiring_process": ["Online Assessment", "Technical Interview", "HR Interview"],
                "tips": [
                    "InfyTQ certification gives you an edge",
                    "Focus on problem-solving and adaptability",
                    "Research Infosys Lex and training programs"
                ],
                "common_questions": [
                    {"question": "Why Infosys over other companies?", "category": "HR", "frequency": "Very Common"},
                    {"question": "Explain SDLC phases", "category": "Technical", "frequency": "Common"},
                    {"question": "Tell me about a time you showed leadership", "category": "Behavioral", "frequency": "Common"},
                    {"question": "What do you know about Infosys?", "category": "HR", "frequency": "Very Common"},
                    {"question": "Difference between stack and queue", "category": "Technical", "frequency": "Common"},
                ]
            },
            "wipro": {
                "name": "Wipro",
                "logo": "Wipro",
                "culture": "Sustainability-focused, diverse work environment",
                "hiring_process": ["Online Test", "Technical Round", "HR Round"],
                "tips": [
                    "Wipro values diversity and inclusion",
                    "Prepare for situational judgment questions",
                    "Know about Wipro's sustainability initiatives"
                ],
                "common_questions": [
                    {"question": "Why do you want to work at Wipro?", "category": "HR", "frequency": "Very Common"},
                    {"question": "Explain database normalization", "category": "Technical", "frequency": "Common"},
                    {"question": "How do you handle pressure?", "category": "Behavioral", "frequency": "Common"},
                    {"question": "Tell me about your final year project", "category": "Technical", "frequency": "Very Common"},
                ]
            },
            "cognizant": {
                "name": "Cognizant",
                "logo": "CTS",
                "culture": "Client-focused, digital transformation leaders",
                "hiring_process": ["Online Assessment", "Technical Interview", "HR Interview"],
                "tips": [
                    "GenC and GenC Next programs have different requirements",
                    "Strong communication skills are valued",
                    "Research their digital transformation work"
                ],
                "common_questions": [
                    {"question": "Why Cognizant?", "category": "HR", "frequency": "Very Common"},
                    {"question": "Explain polymorphism with an example", "category": "Technical", "frequency": "Common"},
                    {"question": "Describe a difficult situation you handled", "category": "Behavioral", "frequency": "Common"},
                    {"question": "What are your salary expectations?", "category": "HR", "frequency": "Common"},
                ]
            },
            "accenture": {
                "name": "Accenture",
                "logo": "Accenture",
                "culture": "Innovation, inclusion, client success focus",
                "hiring_process": ["Cognitive Assessment", "Technical Round", "HR Round"],
                "tips": [
                    "Accenture values adaptability and learning",
                    "Prepare for case study questions",
                    "Know about their consulting vs technology roles"
                ],
                "common_questions": [
                    {"question": "Tell me about yourself in 2 minutes", "category": "HR", "frequency": "Very Common"},
                    {"question": "Explain cloud computing basics", "category": "Technical", "frequency": "Common"},
                    {"question": "How do you handle conflicting priorities?", "category": "Behavioral", "frequency": "Common"},
                    {"question": "What interests you about consulting?", "category": "HR", "frequency": "Common"},
                ]
            },
            "tech_mahindra": {
                "name": "Tech Mahindra",
                "logo": "TechM",
                "culture": "Connected World, Connected Experiences",
                "hiring_process": ["Online Test", "Technical Interview", "HR Interview"],
                "tips": [
                    "Focus on telecom and digital transformation knowledge",
                    "They value entrepreneurial mindset",
                    "Prepare for networking and 5G related questions"
                ],
                "common_questions": [
                    {"question": "Why Tech Mahindra?", "category": "HR", "frequency": "Very Common"},
                    {"question": "Explain OSI model layers", "category": "Technical", "frequency": "Common"},
                    {"question": "How do you stay updated with technology?", "category": "Behavioral", "frequency": "Common"},
                    {"question": "What do you know about 5G?", "category": "Technical", "frequency": "Common"},
                ]
            },
            "hcl": {
                "name": "HCL Technologies",
                "logo": "HCL",
                "culture": "Employee-first culture, innovation driven",
                "hiring_process": ["Aptitude Test", "Technical Round", "HR Round"],
                "tips": [
                    "HCL values 'ideapreneurship' - employee innovation",
                    "Strong focus on coding skills for freshers",
                    "Prepare for data structures and algorithms"
                ],
                "common_questions": [
                    {"question": "Tell me about yourself", "category": "HR", "frequency": "Very Common"},
                    {"question": "Write code to reverse a linked list", "category": "Technical", "frequency": "Common"},
                    {"question": "Where do you see yourself in 5 years?", "category": "HR", "frequency": "Common"},
                    {"question": "Explain your major project", "category": "Technical", "frequency": "Very Common"},
                ]
            },
            "capgemini": {
                "name": "Capgemini",
                "logo": "Capgemini",
                "culture": "Freedom, trust, team spirit",
                "hiring_process": ["Game-Based Assessment", "Technical Interview", "HR Interview"],
                "tips": [
                    "Unique game-based assessments - practice on their portal",
                    "French multinational - global mindset valued",
                    "Focus on problem-solving approach"
                ],
                "common_questions": [
                    {"question": "Why do you want to join Capgemini?", "category": "HR", "frequency": "Very Common"},
                    {"question": "Explain MVC architecture", "category": "Technical", "frequency": "Common"},
                    {"question": "Tell me about a team project", "category": "Behavioral", "frequency": "Common"},
                    {"question": "What are your strengths and weaknesses?", "category": "HR", "frequency": "Very Common"},
                ]
            },
            "ibm": {
                "name": "IBM",
                "logo": "IBM",
                "culture": "Think. Innovation at scale",
                "hiring_process": ["Cognitive Assessment", "Technical Interview", "HR Interview"],
                "tips": [
                    "Research IBM Cloud, Watson AI, and Quantum computing",
                    "Strong emphasis on problem-solving",
                    "Prepare for design thinking concepts"
                ],
                "common_questions": [
                    {"question": "What do you know about IBM?", "category": "HR", "frequency": "Very Common"},
                    {"question": "Explain REST API concepts", "category": "Technical", "frequency": "Common"},
                    {"question": "Describe a challenging problem you solved", "category": "Behavioral", "frequency": "Common"},
                    {"question": "What is AI and machine learning?", "category": "Technical", "frequency": "Common"},
                ]
            },
            "deloitte": {
                "name": "Deloitte",
                "logo": "Deloitte",
                "culture": "Making an impact that matters",
                "hiring_process": ["Online Assessment", "Case Study", "Technical + HR Interview"],
                "tips": [
                    "Big 4 consulting - prepare for case studies",
                    "Research their consulting vs technology roles",
                    "Communication skills are highly valued"
                ],
                "common_questions": [
                    {"question": "Walk me through your resume", "category": "HR", "frequency": "Very Common"},
                    {"question": "Solve this case study...", "category": "Technical", "frequency": "Common"},
                    {"question": "Why consulting?", "category": "HR", "frequency": "Common"},
                    {"question": "How do you handle ambiguity?", "category": "Behavioral", "frequency": "Common"},
                ]
            }
        }
        
        if company_filter and company_filter in companies:
            result = {company_filter: companies[company_filter]}
        else:
            result = companies
            
        logger.info(f"Served company prep for: {company_filter or 'all'}")
        return Response(result)

    @action(detail=False, methods=['get'])
    def answer_templates(self, request):
        """
        Answer Templates: Pre-built answer structures for common questions.
        
        Provides fill-in-the-blank templates that freshers can customize
        with their own experiences.
        """
        templates = {
            "tell_me_about_yourself": {
                "question": "Tell me about yourself",
                "category": "Introduction",
                "difficulty": "Easy",
                "structure": [
                    "Present: I am [your name], a [degree] graduate from [college].",
                    "Past: During my studies, I [key achievement/project].",
                    "Skills: I have experience in [skill 1], [skill 2], and [skill 3].",
                    "Future: I'm excited about this role because [connection to job]."
                ],
                "example": "I am Priya, a Computer Science graduate from Mumbai University. During my final year, I built a college event management system that handled registrations for 500+ students. I have hands-on experience in Python, React, and MySQL from my projects. I'm excited about this role at TCS because I want to work on enterprise-scale solutions and grow my technical skills.",
                "tips": [
                    "Keep it under 90 seconds",
                    "Focus on what's relevant to the job",
                    "End with enthusiasm for the role"
                ]
            },
            "greatest_strength": {
                "question": "What is your greatest strength?",
                "category": "Self-Assessment",
                "difficulty": "Easy",
                "structure": [
                    "Strength: My greatest strength is [specific strength].",
                    "Evidence: For example, [specific situation where you demonstrated it].",
                    "Result: This helped [positive outcome]."
                ],
                "example": "My greatest strength is problem-solving. When our college fest website crashed the day before the event, I debugged the server issue and optimized the database queries within 3 hours. This saved the registration process and we had a successful event with 1000+ participants.",
                "tips": [
                    "Choose a strength relevant to the job",
                    "Always back it up with a specific example",
                    "Quantify the result if possible"
                ]
            },
            "greatest_weakness": {
                "question": "What is your greatest weakness?",
                "category": "Self-Assessment",
                "difficulty": "Medium",
                "structure": [
                    "Weakness: I sometimes struggle with [genuine weakness].",
                    "Awareness: I realized this when [situation].",
                    "Action: To improve, I've started [specific steps].",
                    "Progress: Now I [improvement made]."
                ],
                "example": "I sometimes struggle with public speaking. I noticed this during my first project presentation when I got nervous. To improve, I joined my college's debate club and started presenting in smaller team meetings first. Now I'm much more confident presenting to groups of 20+ people.",
                "tips": [
                    "Never say 'I'm a perfectionist' - it's overused",
                    "Show self-awareness and improvement",
                    "Don't mention a critical job skill as weakness"
                ]
            },
            "why_this_company": {
                "question": "Why do you want to join this company?",
                "category": "Company Research",
                "difficulty": "Medium",
                "structure": [
                    "Company Praise: I admire [company's specific achievement/value].",
                    "Personal Connection: This resonates with me because [your reason].",
                    "Career Fit: I believe [company] is the right place to [your goal].",
                    "Contribution: I can add value by [your skills/potential contribution]."
                ],
                "example": "I admire TCS's focus on innovation and their work on AI-powered solutions for banking. This resonates with me because I built a fraud detection project using machine learning. I believe TCS is the right place to develop enterprise-scale AI skills. I can contribute my Python and data analysis skills to projects in the BFSI domain.",
                "tips": [
                    "Research the company beforehand",
                    "Mention specific projects or values",
                    "Connect their work to your goals"
                ]
            },
            "project_explanation": {
                "question": "Tell me about your project",
                "category": "Technical",
                "difficulty": "Medium",
                "structure": [
                    "Overview: I built [project name] which [what it does].",
                    "Problem: The problem I solved was [specific issue].",
                    "Tech Stack: I used [technologies] because [reason].",
                    "My Role: I specifically worked on [your contribution].",
                    "Result: The outcome was [measurable result or learning]."
                ],
                "example": "I built a Campus Placement Portal that automated our college's placement process. The problem was manual tracking of 500+ students across 30+ companies. I used React for frontend, Node.js for backend, and MongoDB for database because I needed flexibility for different company requirements. I specifically designed the interview scheduling algorithm. The portal reduced administrative work by 60% and was adopted by our placement cell.",
                "tips": [
                    "Prepare to answer follow-up technical questions",
                    "Mention challenges you faced",
                    "Quantify impact if possible"
                ]
            },
            "five_year_plan": {
                "question": "Where do you see yourself in 5 years?",
                "category": "Career Goals",
                "difficulty": "Medium",
                "structure": [
                    "Short-term (1-2 years): I want to [immediate goals].",
                    "Skill growth: I plan to develop expertise in [specific skills].",
                    "Long-term (5 years): I see myself as [role/position].",
                    "Company connection: I believe [company] can help me achieve this because [reason]."
                ],
                "example": "In the first two years, I want to master full-stack development and contribute to major client projects. I plan to develop expertise in cloud technologies and DevOps. In 5 years, I see myself as a technical lead, mentoring junior developers and architecting solutions. I believe Infosys can help me achieve this because of their strong training programs and diverse project exposure.",
                "tips": [
                    "Show ambition but be realistic",
                    "Align goals with company's growth paths",
                    "Don't say 'I want your job' to the interviewer"
                ]
            }
        }
        
        logger.info("Served answer templates")
        return Response(templates)

    @action(detail=False, methods=['post'])
    def quick_practice(self, request):
        """
        Quick Practice: Fast 3-question drill for busy freshers.
        
        Returns 3 random questions for a quick practice session.
        Can be filtered by category.
        
        Payload (optional):
        - category: str (behavioral/technical/hr)
        - difficulty: str (easy/medium/hard)
        """
        import random
        
        category_filter = request.data.get('category', '').lower()
        difficulty_filter = request.data.get('difficulty', '').lower()
        
        all_questions = [
            # Easy HR
            {"text": "Tell me about yourself", "category": "HR", "difficulty": "Easy", "time_limit": 90},
            {"text": "What are your hobbies?", "category": "HR", "difficulty": "Easy", "time_limit": 60},
            {"text": "Why did you choose your major?", "category": "HR", "difficulty": "Easy", "time_limit": 60},
            
            # Medium HR
            {"text": "Why should we hire you?", "category": "HR", "difficulty": "Medium", "time_limit": 90},
            {"text": "Where do you see yourself in 5 years?", "category": "HR", "difficulty": "Medium", "time_limit": 90},
            {"text": "What are your salary expectations?", "category": "HR", "difficulty": "Medium", "time_limit": 60},
            
            # Easy Behavioral
            {"text": "Describe a time you worked in a team", "category": "Behavioral", "difficulty": "Easy", "time_limit": 120},
            {"text": "What is your greatest strength?", "category": "Behavioral", "difficulty": "Easy", "time_limit": 90},
            
            # Medium Behavioral
            {"text": "Tell me about a time you failed", "category": "Behavioral", "difficulty": "Medium", "time_limit": 120},
            {"text": "How do you handle criticism?", "category": "Behavioral", "difficulty": "Medium", "time_limit": 90},
            {"text": "Describe a time you showed leadership", "category": "Behavioral", "difficulty": "Medium", "time_limit": 120},
            
            # Hard Behavioral
            {"text": "Tell me about a time you disagreed with your manager", "category": "Behavioral", "difficulty": "Hard", "time_limit": 120},
            
            # Easy Technical
            {"text": "Explain the difference between a list and tuple in Python", "category": "Technical", "difficulty": "Easy", "time_limit": 90},
            {"text": "What is OOP?", "category": "Technical", "difficulty": "Easy", "time_limit": 90},
            
            # Medium Technical  
            {"text": "Explain the concept of database normalization", "category": "Technical", "difficulty": "Medium", "time_limit": 120},
            {"text": "What is the difference between REST and GraphQL?", "category": "Technical", "difficulty": "Medium", "time_limit": 90},
            
            # Hard Technical
            {"text": "How would you design a URL shortener?", "category": "Technical", "difficulty": "Hard", "time_limit": 180},
        ]
        
        # Apply filters
        filtered = all_questions
        if category_filter:
            filtered = [q for q in filtered if q['category'].lower() == category_filter]
        if difficulty_filter:
            filtered = [q for q in filtered if q['difficulty'].lower() == difficulty_filter]
        
        # Select 3 random questions
        if len(filtered) >= 3:
            selected = random.sample(filtered, 3)
        else:
            selected = filtered if filtered else random.sample(all_questions, 3)
        
        logger.info(f"Quick practice: {len(selected)} questions, category={category_filter}, difficulty={difficulty_filter}")
        
        return Response({
            'questions': selected,
            'total_time': sum(q['time_limit'] for q in selected),
            'session_type': 'quick_practice'
        })