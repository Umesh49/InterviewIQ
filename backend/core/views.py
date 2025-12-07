import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
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
            
            questions_data = InterviewEngine.generate_questions(
                resume_data=resume_data,
                position=session.position,
                difficulty=session.difficulty,
                dialect=session.dialect,
                experience_level=session.experience_level
            )
            
            logger.info(f"Generated {len(questions_data)} questions")
            
            # Deduplicate questions (compare first 30 chars)
            seen_questions = set()
            unique_questions = []
            for q in questions_data:
                key = q['text'][:30].lower().strip()
                if key not in seen_questions:
                    seen_questions.add(key)
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