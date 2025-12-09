"""
Django Admin Configuration for Core App.
Registers all models with appropriate filters, search, and display options.
"""
from django.contrib import admin
from django.utils.html import format_html
from .models import Student, Resume, InterviewSession, Question, InterviewResponse


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    """Admin for Student model - extends AbstractUser."""
    list_display = ['id', 'username', 'email', 'is_active', 'date_joined']
    list_filter = ['is_active', 'date_joined']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    readonly_fields = ['id', 'date_joined', 'last_login']
    ordering = ['-date_joined']


@admin.register(Resume)
class ResumeAdmin(admin.ModelAdmin):
    """Admin for Resume model - view uploaded resumes and parsed content."""
    list_display = ['id', 'student_name', 'skills_count', 'experience_years', 'created_at']
    list_filter = ['created_at']
    search_fields = ['student__username', 'student__email']
    readonly_fields = ['id', 'created_at', 'parsed_content']
    ordering = ['-created_at']
    
    def student_name(self, obj):
        return obj.student.username if obj.student else "Anonymous"
    student_name.short_description = "Student"
    
    def skills_count(self, obj):
        if obj.parsed_content:
            return len(obj.parsed_content.get('skills', []))
        return 0
    skills_count.short_description = "Skills"
    
    def experience_years(self, obj):
        if obj.parsed_content:
            return obj.parsed_content.get('experience_years', 0)
        return 0
    experience_years.short_description = "Exp. Years"


@admin.register(InterviewSession)
class InterviewSessionAdmin(admin.ModelAdmin):
    """Admin for InterviewSession - main interview management."""
    list_display = [
        'id', 'position', 'difficulty', 'experience_level', 
        'status_badge', 'overall_score', 'question_count', 'created_at'
    ]
    list_filter = ['status', 'difficulty', 'experience_level', 'created_at']
    search_fields = ['position', 'student__username', 'id']
    readonly_fields = ['id', 'created_at', 'feedback_report', 'overall_score']
    ordering = ['-created_at']
    
    fieldsets = (
        ('Session Info', {
            'fields': ('id', 'student', 'resume', 'position', 'difficulty', 'experience_level')
        }),
        ('Status', {
            'fields': ('status', 'overall_score')
        }),
        ('Metadata', {
            'fields': ('dialect', 'blind_mode_enabled', 'created_at')
        }),
        ('Report (Read-only)', {
            'fields': ('feedback_report',),
            'classes': ('collapse',)
        }),
    )
    
    def status_badge(self, obj):
        colors = {
            'Created': '#6c757d',
            'Started': '#007bff',
            'Completed': '#28a745',
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; '
            'border-radius: 3px; font-size: 11px;">{}</span>',
            color, obj.status
        )
    status_badge.short_description = "Status"
    
    def question_count(self, obj):
        return obj.questions.count()
    question_count.short_description = "Questions"


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    """Admin for Question - view interview questions."""
    list_display = ['short_text', 'category', 'session_position', 'order', 'response_count', 'created_at']
    list_filter = ['category', 'created_at', 'session__difficulty']
    search_fields = ['text', 'session__position']
    readonly_fields = ['id', 'created_at']
    ordering = ['session', 'order']
    
    def short_text(self, obj):
        return obj.text[:50] + "..." if len(obj.text) > 50 else obj.text
    short_text.short_description = "Question"
    
    def session_position(self, obj):
        return obj.session.position if obj.session else "-"
    session_position.short_description = "Position"
    
    def response_count(self, obj):
        return obj.responses.count()
    response_count.short_description = "Responses"


@admin.register(InterviewResponse)
class InterviewResponseAdmin(admin.ModelAdmin):
    """Admin for InterviewResponse - view user answers and feedback."""
    list_display = [
        'id', 'question_preview', 'transcript_preview', 
        'fluency_score', 'sentiment_score', 'created_at'
    ]
    list_filter = ['created_at', 'question__category']
    search_fields = ['transcript', 'question__text']
    readonly_fields = [
        'id', 'created_at', 'transcript', 'feedback_text',
        'detailed_positives', 'detailed_improvements', 'improvement_tips',
        'grammar_errors', 'body_language_metadata', 'metrics_timeline'
    ]
    ordering = ['-created_at']
    
    fieldsets = (
        ('Response', {
            'fields': ('id', 'question', 'transcript', 'audio_file')
        }),
        ('Scores', {
            'fields': ('fluency_score', 'sentiment_score', 'eye_contact_score', 'posture_score')
        }),
        ('AI Feedback', {
            'fields': ('feedback_text', 'detailed_positives', 'detailed_improvements', 'improvement_tips'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('grammar_errors', 'body_language_metadata', 'metrics_timeline', 'created_at'),
            'classes': ('collapse',)
        }),
    )
    
    def question_preview(self, obj):
        if obj.question:
            text = obj.question.text
            return text[:40] + "..." if len(text) > 40 else text
        return "-"
    question_preview.short_description = "Question"
    
    def transcript_preview(self, obj):
        if obj.transcript:
            return obj.transcript[:50] + "..." if len(obj.transcript) > 50 else obj.transcript
        return "-"
    transcript_preview.short_description = "Answer"
