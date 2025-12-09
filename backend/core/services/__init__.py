"""
Services package for the core app.
Re-exports all public functions and classes for backward compatibility.
"""
from .ai_service import (
    call_ai,
    check_grammar,
    log_ai_failure,
    HAS_GEMINI,
    HAS_OPENAI,
    HAS_PERPLEXITY,
    HAS_OPENROUTER,
    HAS_BYTEZ,
    HAS_GROQ,
    HAS_CEREBRAS,
)

from .helper_functions import (
    get_pre_interview_tips,
    progressive_question_order,
    generate_beginner_encouragement,
    detect_performance_trend,
    detect_star_method,
    calculate_content_quality,
    calculate_percentile,
    validate_and_normalize_metrics,
    add_beginner_friendly_tips_to_feedback,
)

from .interview_service import (
    ResumeParserService,
    InterviewEngine,
)

from .voice_service import VoiceService
from .analyze_body_language import analyze_single_photo, analyze_multiple_photos

__all__ = [
    # AI Service
    'call_ai',
    'check_grammar',
    'log_ai_failure',
    'HAS_GEMINI',
    'HAS_OPENAI',
    'HAS_PERPLEXITY',
    'HAS_OPENROUTER',
    'HAS_BYTEZ',
    'HAS_GROQ',
    'HAS_CEREBRAS',
    
    # Helper Functions
    'get_pre_interview_tips',
    'progressive_question_order',
    'generate_beginner_encouragement',
    'detect_performance_trend',
    'detect_star_method',
    'calculate_content_quality',
    'calculate_percentile',
    'validate_and_normalize_metrics',
    'add_beginner_friendly_tips_to_feedback',
    
    # Interview Service
    'ResumeParserService',
    'InterviewEngine',
    
    # Voice Service
    'VoiceService',
    
    # Body Language Analysis
    'analyze_single_photo',
    'analyze_multiple_photos',
]
