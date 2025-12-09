"""
Comprehensive tests for the InterviewIQ.
Tests cover models, API endpoints, and service integration.
"""
import uuid
import json
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from .models import Student, Resume, InterviewSession, Question, InterviewResponse
from .services import ResumeParserService, InterviewEngine


class StudentModelTests(TestCase):
    """Test the Student model."""
    
    def test_create_student(self):
        """Test creating a student with UUID primary key."""
        student = Student.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User'
        )
        self.assertIsInstance(student.id, uuid.UUID)
        self.assertEqual(student.username, 'testuser')
        self.assertEqual(student.email, 'test@example.com')
        
    def test_student_str(self):
        """Test student string representation."""
        student = Student.objects.create_user(username='testuser', password='test123')
        self.assertEqual(str(student), 'testuser')


class ResumeModelTests(TestCase):
    """Test the Resume model."""
    
    def setUp(self):
        self.student = Student.objects.create_user(
            username='resumeuser',
            password='test123'
        )
    
    def test_create_resume(self):
        """Test creating a resume."""
        resume = Resume.objects.create(
            student=self.student,
            file=SimpleUploadedFile('test.pdf', b'PDF content'),
            parsed_content={'skills': ['Python', 'Django']}
        )
        self.assertIsInstance(resume.id, uuid.UUID)
        self.assertEqual(resume.student, self.student)
        self.assertEqual(resume.parsed_content['skills'], ['Python', 'Django'])


class InterviewSessionModelTests(TestCase):
    """Test the InterviewSession model."""
    
    def setUp(self):
        self.student = Student.objects.create_user(
            username='interviewuser',
            password='test123'
        )
        self.resume = Resume.objects.create(
            student=self.student,
            file=SimpleUploadedFile('resume.pdf', b'Resume content')
        )
    
    def test_create_interview_session(self):
        """Test creating an interview session."""
        session = InterviewSession.objects.create(
            student=self.student,
            resume=self.resume,
            position='Software Engineer',
            difficulty='Medium'
        )
        self.assertIsInstance(session.id, uuid.UUID)
        self.assertEqual(session.position, 'Software Engineer')
        self.assertEqual(session.difficulty, 'Medium')
        self.assertEqual(session.status, 'Started')
        
    def test_interview_session_choices(self):
        """Test difficulty and status choices."""
        session = InterviewSession.objects.create(
            student=self.student,
            position='Data Scientist',
            difficulty='Hard'
        )
        self.assertIn(session.difficulty, ['Easy', 'Medium', 'Hard'])


class QuestionModelTests(TestCase):
    """Test the Question model."""
    
    def setUp(self):
        self.student = Student.objects.create_user(username='quser', password='test123')
        self.session = InterviewSession.objects.create(
            student=self.student,
            position='Developer',
            difficulty='Easy'
        )
    
    def test_create_question(self):
        """Test creating a question."""
        question = Question.objects.create(
            session=self.session,
            text='Tell me about yourself.',
            order=1,
            category='Behavioral'
        )
        self.assertIsInstance(question.id, uuid.UUID)
        self.assertEqual(question.text, 'Tell me about yourself.')
        self.assertEqual(question.category, 'Behavioral')


class InterviewResponseModelTests(TestCase):
    """Test the InterviewResponse model."""
    
    def setUp(self):
        self.student = Student.objects.create_user(username='respuser', password='test123')
        self.session = InterviewSession.objects.create(
            student=self.student,
            position='Engineer',
            difficulty='Medium'
        )
        self.question = Question.objects.create(
            session=self.session,
            text='Describe a challenge.',
            order=1,
            category='Situational'
        )
    
    def test_create_response(self):
        """Test creating an interview response."""
        response = InterviewResponse.objects.create(
            question=self.question,
            transcript='I faced a challenging project...',
            fluency_score=0.8,
            sentiment_score=0.6,
            eye_contact_score=0.75,
            posture_score=0.9
        )
        self.assertIsInstance(response.id, uuid.UUID)
        self.assertEqual(response.fluency_score, 0.8)


class ResumeAPITests(APITestCase):
    """Test the Resume API endpoints."""
    
    def setUp(self):
        self.client = APIClient()
        self.student = Student.objects.create_user(
            username='apiuser',
            password='test123'
        )
    
    def test_upload_resume(self):
        """Test uploading a resume via API."""
        pdf_content = b'%PDF-1.4 fake pdf content for testing'
        file = SimpleUploadedFile('test_resume.pdf', pdf_content, content_type='application/pdf')
        
        with patch.object(ResumeParserService, 'parse_resume') as mock_parse:
            mock_parse.return_value = {
                'skills': ['Python', 'Django'],
                'experience_years': 3,
                'key_projects': ['Project A'],
                'education': ['University'],
                'strengths': ['Communication'],
                'weaknesses': []
            }
            
            response = self.client.post(
                '/api/resumes/',
                {'file': file, 'student': str(self.student.id)},
                format='multipart'
            )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', response.data)


class InterviewSessionAPITests(APITestCase):
    """Test the InterviewSession API endpoints."""
    
    def setUp(self):
        self.client = APIClient()
        self.student = Student.objects.create_user(
            username='sessionuser',
            password='test123'
        )
        self.resume = Resume.objects.create(
            student=self.student,
            file=SimpleUploadedFile('resume.pdf', b'Resume content'),
            parsed_content={'skills': ['Python']}
        )
    
    def test_create_interview_session(self):
        """Test creating an interview session via API."""
        response = self.client.post('/api/interviews/', {
            'student': str(self.student.id),
            'resume': str(self.resume.id),
            'position': 'Backend Developer',
            'difficulty': 'Medium',
            'experience_level': '0-2 years'
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['position'], 'Backend Developer')
    
    def test_start_interview(self):
        """Test starting an interview and generating questions."""
        session = InterviewSession.objects.create(
            student=self.student,
            resume=self.resume,
            position='Full Stack Developer',
            difficulty='Easy'
        )
        
        with patch.object(InterviewEngine, 'generate_questions') as mock_gen:
            mock_gen.return_value = [
                {'text': 'Tell me about yourself.', 'category': 'Behavioral'},
                {'text': 'Explain Python decorators.', 'category': 'Technical'},
            ]
            
            response = self.client.post(f'/api/interviews/{session.id}/start_interview/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'Interview Started')
        self.assertEqual(len(response.data['questions']), 2)
    
    def test_submit_response(self):
        """Test submitting a response to a question."""
        session = InterviewSession.objects.create(
            student=self.student,
            resume=self.resume,
            position='Developer',
            difficulty='Medium'
        )
        question = Question.objects.create(
            session=session,
            text='Describe your experience.',
            order=1,
            category='Behavioral'
        )
        
        with patch.object(InterviewEngine, 'analyze_response') as mock_analyze:
            mock_analyze.return_value = {
                'sentiment_score': 0.7,
                'grammar_errors': [],
                'star_method_used': True,
                'feedback_text': 'Good response!',
                'improvement_tips': []
            }
            
            response = self.client.post(
                f'/api/interviews/{session.id}/submit_response/',
                {
                    'question_id': str(question.id),
                    'transcript': 'I have 5 years of experience in software development...',
                    'fluency_metrics': json.dumps({'eyeContact': 0.8, 'posture': 'Good'})
                },
                format='multipart'
            )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('id', response.data)
    
    def test_get_result(self):
        """Test getting interview results."""
        session = InterviewSession.objects.create(
            student=self.student,
            resume=self.resume,
            position='Engineer',
            difficulty='Hard',
            status='Completed',
            feedback_report={'overall_score': 85}
        )
        question = Question.objects.create(
            session=session,
            text='Test question',
            order=1,
            category='Technical'
        )
        InterviewResponse.objects.create(
            question=question,
            transcript='Test answer',
            fluency_score=0.8,
            sentiment_score=0.7,
            eye_contact_score=0.9,
            posture_score=0.85
        )
        
        response = self.client.get(f'/api/interviews/{session.id}/get_result/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('overall_score', response.data)


class InterviewEngineServiceTests(TestCase):
    """Test the InterviewEngine service."""
    
    def test_analyze_response_fallback(self):
        """Test response analysis with fallback (no Gemini)."""
        with patch('core.services.HAS_GEMINI', False):
            result = InterviewEngine.analyze_response(
                'Tell me about yourself',
                'I am a software engineer with 5 years of experience. I led a team and achieved success.',
                {'fluency_score': 0.8}
            )
        
        self.assertIn('sentiment_score', result)
        self.assertIn('feedback_text', result)
        self.assertIn('improvement_tips', result)
    
    def test_generate_questions_fallback(self):
        """Test question generation with fallback (no Gemini)."""
        with patch('core.services.HAS_GEMINI', False):
            questions = InterviewEngine.generate_questions(
                {'skills': ['Python', 'Django']},
                'Software Engineer',
                'Medium'
            )
        
        self.assertIsInstance(questions, list)
        self.assertGreater(len(questions), 0)
        self.assertIn('text', questions[0])
        self.assertIn('category', questions[0])


class StudentProgressAPITests(APITestCase):
    """Test the student progress endpoint."""
    
    def setUp(self):
        self.client = APIClient()
        self.student = Student.objects.create_user(
            username='progressuser',
            password='test123'
        )
    
    def test_get_student_progress(self):
        """Test fetching student progress data."""
        # Create a completed session with feedback
        session = InterviewSession.objects.create(
            student=self.student,
            position='Developer',
            difficulty='Medium',
            status='Completed',
            feedback_report={
                'overall_score': 75,
                'category_scores': [
                    {'name': 'Communication', 'score': 80},
                    {'name': 'Body Language', 'score': 70}
                ]
            }
        )
        
        response = self.client.get('/api/interviews/student_progress/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)


class ClarifyQuestionAPITests(APITestCase):
    """Test the clarify question endpoint."""
    
    def setUp(self):
        self.client = APIClient()
        self.student = Student.objects.create_user(
            username='clarifyuser',
            password='test123'
        )
        self.session = InterviewSession.objects.create(
            student=self.student,
            position='Developer',
            difficulty='Medium'
        )
        self.question = Question.objects.create(
            session=self.session,
            text='Explain the SOLID principles.',
            order=1,
            category='Technical'
        )
    
    def test_clarify_question(self):
        """Test getting a hint for a question."""
        response = self.client.post(
            f'/api/interviews/{self.session.id}/clarify_question/',
            {'question_id': str(self.question.id)}
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('hint', response.data)


class DeleteSessionAPITests(APITestCase):
    """Test the delete session endpoint."""
    
    def setUp(self):
        self.client = APIClient()
        self.student = Student.objects.create_user(
            username='deleteuser',
            password='test123'
        )
    
    def test_delete_session(self):
        """Test deleting an interview session."""
        session = InterviewSession.objects.create(
            student=self.student,
            position='Developer',
            difficulty='Easy'
        )
        
        response = self.client.delete(f'/api/interviews/{session.id}/delete_session/')
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(InterviewSession.objects.filter(id=session.id).exists())
