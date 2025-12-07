import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser

class Student(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Additional fields can be added here (e.g., bio, linked_in)

class Resume(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='resumes')
    file = models.FileField(upload_to='resumes/')
    parsed_content = models.JSONField(default=dict, blank=True) # Stores skills, exp, etc.
    created_at = models.DateTimeField(auto_now_add=True)

class InterviewSession(models.Model):
    DIFFICULTY_CHOICES = [
        ('Easy', 'Easy'),
        ('Medium', 'Medium'),
        ('Hard', 'Hard'),
    ]
    STATUS_CHOICES = [
        ('Started', 'Started'),
        ('Completed', 'Completed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='interviews')
    resume = models.ForeignKey(Resume, on_delete=models.SET_NULL, null=True)
    position = models.CharField(max_length=255)
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES)
    experience_level = models.CharField(max_length=50, default="0-2 years")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Started')
    
    # Analytics & Feedback
    overall_score = models.FloatField(default=0.0)
    feedback_report = models.JSONField(default=dict, blank=True) # Full structured report
    
    # Fairness/Config
    blind_mode_enabled = models.BooleanField(default=False)
    dialect = models.CharField(max_length=50, default="Standard English")
    
    created_at = models.DateTimeField(auto_now_add=True)

class Question(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(InterviewSession, on_delete=models.CASCADE, related_name='questions')
    text = models.TextField()
    order = models.IntegerField()
    category = models.CharField(max_length=100) # Technical, Behavioral, Situational
    
    created_at = models.DateTimeField(auto_now_add=True)

class InterviewResponse(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='responses')
    audio_file = models.FileField(upload_to='responses/audio/', null=True, blank=True)
    transcript = models.TextField(blank=True)
    
    # AI Analysis Data
    fluency_score = models.FloatField(default=0.0)
    sentiment_score = models.FloatField(default=0.0)
    grammar_errors = models.JSONField(default=list)
    filler_word_count = models.IntegerField(default=0)
    
    # Body Language Metrics (from Frontend)
    eye_contact_score = models.FloatField(default=0.0)
    posture_score = models.FloatField(default=0.0)
    body_language_metadata = models.JSONField(default=dict) # Stores fidget, gaze, voice_metrics, etc.
    
    # Video & Time-series Data
    # Video & Time-series Data
    video = models.FileField(upload_to='interview_videos/', null=True, blank=True)
    metrics_timeline = models.JSONField(default=list, blank=True) # [{time: 1.2, type: 'posture', msg: 'Slouching'}]
    
    # AI Coaching Feedback
    feedback_text = models.TextField(blank=True) # Summary feedback
    detailed_positives = models.JSONField(default=list, blank=True)  # ["You did X well", "Y was excellent"]
    detailed_improvements = models.JSONField(default=list, blank=True)  # ["Try doing X", "Improve Y"]
    improvement_tips = models.JSONField(default=list, blank=True)  # Actionable practice tips
    
    created_at = models.DateTimeField(auto_now_add=True)
