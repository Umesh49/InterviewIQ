"""
Helper Functions Module - Utility functions for interview evaluation.
"""
import re
import random
import logging

logger = logging.getLogger(__name__)


def get_pre_interview_tips(position, experience_level):
    """Shows beginner-friendly tips before interview starts."""
    return {
        "preparation": [
            "[TIP] Have your resume open to reference projects/skills",
            "[TIP] Keep water nearby - dry mouth is normal when nervous",
            "[TIP] Smile before you start - it helps you sound confident",
            "[TIP] It's okay to pause and think before answering"
        ],
        "star_method": {
            "explanation": "Structure behavioral answers with STAR:",
            "S": "Situation - Set the scene (1 sentence)",
            "T": "Task - What needed to be done (1 sentence)", 
            "A": "Action - What YOU did (2-3 sentences)",
            "R": "Result - Outcome with numbers if possible (1 sentence)"
        },
        "example_answer": {
            "question": "Tell me about a time you solved a problem",
            "good_answer": (
                "At my internship (S), our website was loading slowly affecting users (T). "
                "I researched the issue and found unoptimized images were the cause. I learned image compression "
                "techniques and implemented lazy loading (A). This reduced page load time from 8 seconds to 2 seconds, "
                "and user engagement increased 25% (R)."
            ),
            "why_good": "[OK] Specific situation, [OK] Clear actions taken, [OK] Measurable results"
        },
        "common_mistakes": [
            "[X] Don't say 'I don't know' - try 'I haven't worked with that, but here's how I'd approach it'",
            "[X] Don't memorize answers - practice key points and speak naturally",
            "[X] Don't rush - interviewers prefer thoughtful slower answers"
        ],
        "mindset": [
            "[!] This is PRACTICE - mistakes help you improve",
            "[!] Even senior engineers get nervous in interviews",
            "[!] Your first answer will be rough - that's normal"
        ]
    }


def progressive_question_order(questions, experience_level="0-2 years"):
    """Orders questions: Intro -> Project/Technical -> Behavioral."""
    category_order = {
        'intro': 1, 'project': 3, 'technical': 3, 'ai': 2,
        'behavioral': 4, 'situational': 4
    }
    
    def get_sort_key(q):
        cat = q.get('category', '').lower()
        priority = category_order.get(cat, 3)
        diff = q.get('difficulty', 'Medium').lower()
        diff_score = {'easy': 1, 'medium': 2, 'hard': 3}.get(diff, 2)
        return (priority, diff_score)

    ordered = sorted(questions, key=get_sort_key)
    return ordered[:15]


def generate_beginner_encouragement(response_count, performance_trend):
    """Provides progressive encouragement throughout interview."""
    encouragements = {
        1: ["Great start!", "You're doing this!", "Nice job breaking the ice!"],
        3: ["You're in rhythm now!", "Three down!", "Solid progress!"],
        5: ["Halfway through!", "Your confidence is showing.", "Great focus!"],
        8: ["Almost there!", "Home stretch!", "Just a few more!"]
    }
    
    if performance_trend == 'improving':
        return "You're improving with each answer!"
    elif performance_trend == 'consistent':
        return "Consistent delivery - that's professionalism!"
    elif performance_trend == 'struggling':
        return "Keep going - you've got this."
    
    for milestone, messages in encouragements.items():
        if response_count == milestone:
            return random.choice(messages)
    
    return "Keep going!"


def detect_performance_trend(recent_responses):
    """Analyzes last 3 responses to detect improvement/decline."""
    if len(recent_responses) < 2:
        return 'new'
    
    scores = []
    for resp in recent_responses[-3:]:
        meta = resp.body_language_metadata or {}
        voice = meta.get('voiceMetrics', {})
        word_score = min(100, voice.get('word_count', 0) * 1.5)
        composite = (resp.fluency_score * 20) + (resp.sentiment_score * 50) + word_score
        scores.append(composite)
    
    if len(scores) >= 2:
        if scores[-1] > scores[-2] + 15:
            return 'improving'
        elif scores[-1] < scores[-2] - 15:
            return 'struggling'
    
    return 'consistent'


def detect_star_method(transcript):
    """Detects if answer follows STAR method. Returns: (bool, int)."""
    if not transcript or len(transcript) < 20:
        return False, 0
    
    transcript_lower = transcript.lower()
    
    situation = ['situation', 'when i was', 'at my previous', 'in my role', 'while working']
    task = ['task', 'needed to', 'had to', 'responsible for', 'my goal was']
    action = ['i did', 'i created', 'i implemented', 'i decided', 'my approach', 'i developed']
    result = ['result', 'outcome', 'achieved', 'improved', 'increased', 'successfully']
    
    has_s = any(i in transcript_lower for i in situation)
    has_t = any(i in transcript_lower for i in task)
    has_a = any(i in transcript_lower for i in action)
    has_r = any(i in transcript_lower for i in result)
    
    star_score = sum([has_s, has_t, has_a, has_r])
    return star_score >= 3, star_score


def calculate_content_quality(question_text, answer_text):
    """Evaluates answer quality. Returns score 0-100."""
    if not answer_text or len(answer_text.strip()) < 5:
        return 0
    
    word_count = len(answer_text.split())
    score = 0
    
    # Length (0-30)
    if word_count >= 80: score += 30
    elif word_count >= 60: score += 25
    elif word_count >= 40: score += 20
    elif word_count >= 20: score += 10
    else: score += 5
    
    # Specificity (0-25)
    specificity = 0
    if re.search(r'\d+', answer_text): specificity += 8
    if any(p in answer_text.lower() for p in ['for example', 'specifically', 'such as']): specificity += 10
    if re.search(r'[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+', answer_text): specificity += 7
    score += min(25, specificity)
    
    # Structure (0-20)
    used_star, star_score = detect_star_method(answer_text)
    if used_star: score += 20
    elif star_score >= 2: score += 10
    
    # Relevance (0-25)
    common = {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'of', 'in', 'to', 'for', 'on', 'at'}
    q_words = set(question_text.lower().split()) - common
    a_words = set(answer_text.lower().split()) - common
    if q_words:
        overlap = len(q_words & a_words)
        score += min(25, (overlap / len(q_words)) * 25)
    else:
        score += 15
    
    return min(100, int(score))


def calculate_percentile(score, metric_type='overall'):
    """Estimates percentile based on score."""
    thresholds = {90: 90, 80: 75, 70: 60, 60: 45, 50: 30, 40: 20, 30: 10}
    for threshold, percentile in sorted(thresholds.items(), reverse=True):
        if score >= threshold:
            return f"{percentile}th percentile"
    return "Below 10th percentile"


def validate_and_normalize_metrics(fluency_metrics, user_transcript):
    """Validates voice metrics and fills missing values."""
    if not fluency_metrics or not isinstance(fluency_metrics, dict):
        fluency_metrics = {}
    
    voice = fluency_metrics.get('voiceMetrics', {})
    
    if not voice.get('word_count'):
        voice['word_count'] = len(user_transcript.split())
        print(f"[INFO] Calculated word count: {voice['word_count']}")
    
    if voice.get('speaking_duration_seconds'):
        duration = voice['speaking_duration_seconds']
        if not voice.get('words_per_minute') and duration > 0:
            voice['words_per_minute'] = int((voice['word_count'] / duration) * 60)
    else:
        voice.setdefault('words_per_minute', 120)
        voice['speaking_duration_seconds'] = voice['word_count'] / 2
    
    if not isinstance(voice.get('filler_words'), dict):
        voice['filler_words'] = {}
    
    voice.setdefault('pause_count', 0)
    voice.setdefault('average_volume', 0.5)
    
    fluency_metrics['voiceMetrics'] = voice
    return fluency_metrics


def add_beginner_friendly_tips_to_feedback(feedback_dict, user_metrics):
    """Enhances feedback with beginner-specific tips."""
    wpm = user_metrics.get('words_per_minute', 0)
    fillers_dict = user_metrics.get('filler_words', {})
    fillers = sum(fillers_dict.values()) if fillers_dict else 0
    word_count = user_metrics.get('word_count', 0)
    
    tips = []
    
    if 0 < wpm < 80:
        tips.append({"issue": "Speaking slowly", "how_to_fix": "Practice at conversational speed"})
    
    if fillers > 5:
        filler = max(fillers_dict, key=fillers_dict.get) if fillers_dict else 'um'
        tips.append({"issue": f"Using '{filler}' frequently", "how_to_fix": "Pause silently instead"})
    
    if word_count < 40:
        tips.append({"issue": "Answers too brief", "how_to_fix": "Use STAR method for more detail"})
    
    feedback_dict['beginner_tips'] = tips
    return feedback_dict
