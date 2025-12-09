from rest_framework import serializers
from .models import Student, Resume, InterviewSession, Question, InterviewResponse

class StudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = ['id', 'username', 'email', 'first_name', 'last_name']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = Student.objects.create_user(**validated_data)
        return user

class ResumeSerializer(serializers.ModelSerializer):
    student = serializers.PrimaryKeyRelatedField(
        queryset=Student.objects.all(),
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = Resume
        fields = ['id', 'student', 'file', 'parsed_content', 'created_at']
        read_only_fields = ['id', 'parsed_content', 'created_at']

class InterviewResponseSerializer(serializers.ModelSerializer):
    question_text = serializers.SerializerMethodField()
    
    class Meta:
        model = InterviewResponse
        fields = [
            'id', 'question', 'question_text', 'audio_file', 'transcript',
            'fluency_score', 'sentiment_score', 'grammar_errors', 'filler_word_count',
            'eye_contact_score', 'posture_score', 'body_language_metadata',
            'video', 'metrics_timeline',
            'feedback_text', 'detailed_positives', 'detailed_improvements', 'improvement_tips',
            'created_at'
        ]
        read_only_fields = ['id', 'question_text', 'created_at']
    
    def get_question_text(self, obj):
        return obj.question.text if obj.question else None

class QuestionSerializer(serializers.ModelSerializer):
    responses = InterviewResponseSerializer(many=True, read_only=True)
    
    class Meta:
        model = Question
        fields = ['id', 'text', 'category', 'order', 'responses']

class InterviewSessionSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    student = serializers.PrimaryKeyRelatedField(
        queryset=Student.objects.all(),
        required=False,
        allow_null=True
    )
    resume = serializers.PrimaryKeyRelatedField(
        queryset=Resume.objects.all(),
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = InterviewSession
        fields = ['id', 'student', 'resume', 'position', 'difficulty', 'experience_level', 
                  'status', 'overall_score', 'feedback_report', 'blind_mode_enabled', 
                  'dialect', 'created_at', 'questions']
        read_only_fields = ['id', 'overall_score', 'feedback_report', 'created_at', 'questions']
