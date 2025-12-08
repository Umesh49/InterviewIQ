import os
from pdfminer.high_level import extract_text
from django.conf import settings
import json
import time
import random
import re
from datetime import datetime
import concurrent.futures
from concurrent.futures import ThreadPoolExecutor, as_completed

import logging
logger = logging.getLogger(__name__)

# Try to import LanguageTool for grammar checking (works offline, no API needed)
try:
    import language_tool_python
    GRAMMAR_TOOL = language_tool_python.LanguageTool('en-US')
    HAS_GRAMMAR_TOOL = True
    print("✓ LanguageTool initialized for grammar checking")
except Exception as e:
    HAS_GRAMMAR_TOOL = False
    GRAMMAR_TOOL = None
    print(f"WARNING: LanguageTool not available: {e}")


def check_grammar(text):
    """
    Check grammar using LanguageTool (free, offline).
    Returns list of grammar issues.
    """
    if not HAS_GRAMMAR_TOOL or not text:
        return []
    
    try:
        matches = GRAMMAR_TOOL.check(text)
        errors = []
        for match in matches[:5]:  # Limit to 5 errors
            errors.append({
                "message": match.message,
                "suggestion": match.replacements[0] if match.replacements else None,
                "context": match.context
            })
        return errors
    except Exception as e:
        print(f"Grammar check error: {e}")
        return []


# Try to import Gemini, mock if fails (for local dev environments with DLL issues)
try:
    import google.generativeai as genai
    if settings.GEMINI_API_KEY:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        HAS_GEMINI = True
    else:
        HAS_GEMINI = False
except ImportError:
    HAS_GEMINI = False
    print("WARNING: google.generativeai could not be imported. Using mock services.")
except Exception as e:
    HAS_GEMINI = False
    print(f"WARNING: Gemini configuration failed: {e}. Using mock services.")

# Try to import OpenAI
try:
    from openai import OpenAI
    if settings.OPENAI_API_KEY:
        OPENAI_CLIENT = OpenAI(api_key=settings.OPENAI_API_KEY)
        HAS_OPENAI = True
        print("✓ OpenAI initialized")
    else:
        HAS_OPENAI = False
        OPENAI_CLIENT = None
except Exception as e:
    HAS_OPENAI = False
    OPENAI_CLIENT = None
    print(f"WARNING: OpenAI not available: {e}")

# Perplexity uses OpenAI-compatible API
try:
    if settings.PERPLEXITY_API_KEY:
        PERPLEXITY_CLIENT = OpenAI(
            api_key=settings.PERPLEXITY_API_KEY,
            base_url="https://api.perplexity.ai"
        )
        HAS_PERPLEXITY = True
        print("✓ Perplexity initialized")
    else:
        HAS_PERPLEXITY = False
        PERPLEXITY_CLIENT = None
except Exception as e:
    HAS_PERPLEXITY = False
    PERPLEXITY_CLIENT = None
    print(f"WARNING: Perplexity not available: {e}")

# Groq Configuration (OpenAI-compatible, FAST inference, 1000 req/day)
GROQ_CLIENT = None
HAS_GROQ = False
try:
    groq_key = getattr(settings, 'GROQ_API_KEY', None) or os.getenv('GROQ_API_KEY')
    if groq_key:
        GROQ_CLIENT = OpenAI(
            api_key=groq_key,
            base_url="https://api.groq.com/openai/v1"
        )
        HAS_GROQ = True
        print("✓ Groq initialized (FAST, 1000 req/day)")
except Exception as e:
    print(f"WARNING: Groq not available: {e}")

# Cerebras Configuration (OpenAI-compatible, 14,400 req/day, premium models)
CEREBRAS_CLIENT = None
HAS_CEREBRAS = False
try:
    cerebras_key = getattr(settings, 'CEREBRAS_API_KEY', None) or os.getenv('CEREBRAS_API_KEY')
    if cerebras_key:
        CEREBRAS_CLIENT = OpenAI(
            api_key=cerebras_key,
            base_url="https://api.cerebras.ai/v1"
        )
        HAS_CEREBRAS = True
        print("✓ Cerebras initialized (14,400 req/day)")
except Exception as e:
    print(f"WARNING: Cerebras not available: {e}")

# OpenRouter Configuration (OpenAI-compatible)
OPENROUTER_CLIENT = None
OPENROUTER_CLIENT_FALLBACK = None
HAS_OPENROUTER = False
HAS_OPENROUTER_FALLBACK = False

try:
    if settings.OPENROUTER_API_KEY:
        OPENROUTER_CLIENT = OpenAI(
            api_key=settings.OPENROUTER_API_KEY,
            base_url="https://openrouter.ai/api/v1"
        )
        HAS_OPENROUTER = True
        print("✓ OpenRouter initialized (primary)")
    
    # Initialize fallback client if available
    openrouter_fallback_key = getattr(settings, 'OPENROUTER_API_KEY_FALLBACK', None) or os.getenv('OPENROUTER_API_KEY_FALLBACK')
    if openrouter_fallback_key:
        OPENROUTER_CLIENT_FALLBACK = OpenAI(
            api_key=openrouter_fallback_key,
            base_url="https://openrouter.ai/api/v1"
        )
        HAS_OPENROUTER_FALLBACK = True
        print("✓ OpenRouter fallback initialized")
except Exception as e:
    print(f"WARNING: OpenRouter not available: {e}")

# Gemini fallback API key
GEMINI_API_KEY_FALLBACK = getattr(settings, 'GEMINI_API_KEY_FALLBACK', None) or os.getenv('GEMINI_API_KEY_FALLBACK')
if GEMINI_API_KEY_FALLBACK:
    print("✓ Gemini fallback key configured")

# Bytez Configuration
try:
    from bytez import Bytez
    if settings.BYTEZ_API_KEY:
        BYTEZ_CLIENT = Bytez(settings.BYTEZ_API_KEY)
        HAS_BYTEZ = True
        print("✓ Bytez initialized")
    else:
        HAS_BYTEZ = False
        BYTEZ_CLIENT = None
except ImportError:
    HAS_BYTEZ = False
    BYTEZ_CLIENT = None
    print("WARNING: 'bytez' package not installed. Skipping Bytez.")
except Exception as e:
    HAS_BYTEZ = False
    BYTEZ_CLIENT = None
    print(f"WARNING: Bytez configuration failed: {e}")


def call_gemini_with_backoff(model_name, prompt, retries=3, temperature=1.0, use_fallback=False):
    """
    Helper to call Gemini with exponential backoff for rate limits.
    Temperature controls randomness: 0.0 = deterministic, 1.0+ = more creative/varied
    Uses fallback API key if primary is rate limited.
    """
    if not HAS_GEMINI:
        return None
    
    # If using fallback, reconfigure with fallback key
    if use_fallback and GEMINI_API_KEY_FALLBACK:
        genai.configure(api_key=GEMINI_API_KEY_FALLBACK)
        print("[AI] Gemini: Using FALLBACK API key")
        
    for i in range(retries):
        try:
            model = genai.GenerativeModel(model_name)
            generation_config = genai.types.GenerationConfig(
                temperature=temperature,
            )
            response = model.generate_content(prompt, generation_config=generation_config)
            
            # Restore primary key if we used fallback
            if use_fallback and settings.GEMINI_API_KEY:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                
            return response.text
        except Exception as e:
            if "429" in str(e) or "ResourceExhausted" in str(e):
                wait_time = (2 ** i) + random.random()
                print(f"[RATE LIMIT] Waiting {wait_time:.1f}s before retry {i+1}/{retries}")
                time.sleep(wait_time)
            else:
                print(f"[ERROR] Gemini error: {e}")
                # Restore primary key if we used fallback
                if use_fallback and settings.GEMINI_API_KEY:
                    genai.configure(api_key=settings.GEMINI_API_KEY)
                return None
    
    # If all retries failed with rate limit and we haven't tried fallback yet
    if not use_fallback and GEMINI_API_KEY_FALLBACK:
        print("[AI] Gemini primary key exhausted - trying FALLBACK key...")
        return call_gemini_with_backoff(model_name, prompt, retries=2, temperature=temperature, use_fallback=True)
    
    # Restore primary key if we used fallback
    if use_fallback and settings.GEMINI_API_KEY:
        genai.configure(api_key=settings.GEMINI_API_KEY)
    
    return None


def _call_gemini_wrapper(prompt, temperature):
    """Wrapper for thread pool execution"""
    print(f"[AI] Starting Gemini thread for prompt: {prompt[:30]}...")
    if HAS_GEMINI:
        # Using Gemini 2.0 Flash Experimental (current free model)
        return call_gemini_with_backoff('gemini-2.0-flash-exp', prompt, temperature=temperature)
    return None


def _call_openrouter_wrapper(prompt, temperature):
    """Wrapper for thread pool execution. Prioritizes FREE models. Uses fallback key on rate limit."""
    
    def _try_openrouter_models(client, is_fallback=False):
        """Try models with a specific client"""
        prefix = "[AI] OpenRouter" + (" (FALLBACK)" if is_fallback else "")
        
        # 1. Try: Google Gemini 2.0 Flash Exp (Free & Powerful)
        try:
            print(f"{prefix}: Trying google/gemini-2.0-flash-exp:free...")
            response = client.chat.completions.create(
                model="google/gemini-2.0-flash-exp:free",
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=2000,
                extra_headers={
                    "HTTP-Referer": "http://localhost:8000",
                    "X-Title": "Fair AI Interview App",
                }
            )
            return response.choices[0].message.content
        except Exception as e:
            error_str = str(e)
            print(f"{prefix} Gemini Exp failed: {e}")
            # If rate limit and not already using fallback, signal to try fallback
            if "429" in error_str and not is_fallback:
                return "RATE_LIMIT_HIT"

        # 2. Try: Chimera (Free Reasoning)
        try:
            print(f"{prefix}: Trying tngtech/tng-r1t-chimera:free...")
            response = client.chat.completions.create(
                model="tngtech/tng-r1t-chimera:free", 
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=2000
            )
            return response.choices[0].message.content
        except Exception as e:
            error_str = str(e)
            print(f"{prefix} Chimera failed: {e}")
            if "429" in error_str and not is_fallback:
                return "RATE_LIMIT_HIT"
            
        # 3. Fallback: Llama 3.1 70B (Free & Reliable)
        try:
            print(f"{prefix}: Fallback to Llama 3.1 70B (free)...")
            response = client.chat.completions.create(
                model="meta-llama/llama-3.1-70b-instruct:free",
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=2000
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"{prefix} Llama 70B failed: {e}")

        return None
    
    # Try primary client first
    if HAS_OPENROUTER and OPENROUTER_CLIENT:
        result = _try_openrouter_models(OPENROUTER_CLIENT, is_fallback=False)
        
        # If rate limit hit, try fallback client
        if result == "RATE_LIMIT_HIT" and HAS_OPENROUTER_FALLBACK and OPENROUTER_CLIENT_FALLBACK:
            print("[AI] Primary OpenRouter rate limited - switching to FALLBACK key...")
            result = _try_openrouter_models(OPENROUTER_CLIENT_FALLBACK, is_fallback=True)
        
        if result and result != "RATE_LIMIT_HIT":
            return result

    return None

def call_ai(prompt, temperature=1.0):
    """
    Unified AI call function.
    Priority: Groq (fastest, 14,400/day) -> Cerebras -> Gemini/OpenRouter race -> other fallbacks
    """
    
    # PRIMARY: Groq (FASTEST, 14,400 req/day, Llama 3.3 70B)
    if HAS_GROQ and GROQ_CLIENT:
        try:
            print("[AI] Trying Groq (PRIMARY - Llama 3.3 70B)...")
            response = GROQ_CLIENT.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=2000
            )
            print("[AI] Groq succeeded!")
            return response.choices[0].message.content
        except Exception as e:
            print(f"[AI] Groq error: {e}")
    
    # SECONDARY: Cerebras (14,400 req/day, Llama 3.3 70B)
    if HAS_CEREBRAS and CEREBRAS_CLIENT:
        try:
            print("[AI] Trying Cerebras (Llama 3.3 70B)...")
            response = CEREBRAS_CLIENT.chat.completions.create(
                model="llama-3.3-70b",
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=2000
            )
            print("[AI] Cerebras succeeded!")
            return response.choices[0].message.content
        except Exception as e:
            print(f"[AI] Cerebras error: {e}")
    
    # FALLBACK: Race Gemini vs OpenRouter
    print("[AI] Primary providers failed. Starting Gemini vs OpenRouter race...")
    
    with ThreadPoolExecutor(max_workers=2) as executor:
        future_to_provider = {}
        if HAS_GEMINI:
            future_to_provider[executor.submit(_call_gemini_wrapper, prompt, temperature)] = 'Gemini'
        if HAS_OPENROUTER:
            future_to_provider[executor.submit(_call_openrouter_wrapper, prompt, temperature)] = 'OpenRouter'
            
        try:
            for future in as_completed(future_to_provider, timeout=15):
                provider = future_to_provider[future]
                try:
                    result = future.result()
                    if result:
                        print(f"[AI] WINNER: {provider}")
                        executor.shutdown(wait=False) 
                        return result
                except Exception as exc:
                    print(f"[AI] {provider} generated an exception: {exc}")
        except concurrent.futures.TimeoutError:
            print("[AI] Race timed out!")
        except Exception as e:
            print(f"[AI] Race failed: {e}")

    print("[AI] All primary options failed. Trying remaining fallbacks...")

    # Fallback 1: Bytez (Qwen, Free-ish)
    if HAS_BYTEZ and BYTEZ_CLIENT:
        try:
            print("[AI] Trying Bytez (Qwen)...")
            model = BYTEZ_CLIENT.model("Qwen/Qwen3-4B-Instruct-2507")
            output, error = model.run([
                {"role": "user", "content": prompt}
            ])
            if error:
                print(f"[AI] Bytez error returned: {error}")
            elif output:
                return output
        except Exception as e:
            print(f"[AI] Bytez exception: {e}")

    # Fallback 2: OpenAI (Free/Cheap models with quota)
    if HAS_OPENAI and OPENAI_CLIENT:
        # Try free models first
        free_models = [
            "gpt-4o-mini",      # Free tier available
            "gpt-3.5-turbo",    # Very cheap/nearly free
        ]
        
        for model in free_models:
            try:
                print(f"[AI] Trying OpenAI {model} (Free tier)...")
                response = OPENAI_CLIENT.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_tokens=2000
                )
                print(f"[AI] OpenAI {model} succeeded!")
                return response.choices[0].message.content
            except Exception as e:
                print(f"[AI] OpenAI {model} error: {e}")
                continue
    
    # Fallback 3: Perplexity (Free models with quota)
    if HAS_PERPLEXITY and PERPLEXITY_CLIENT:
        # Try free models in order of preference
        free_models = [
            "llama-3.1-sonar-small-128k-online",   # Free with web search
            "llama-3.1-sonar-large-128k-online",   # Better quality, still free
            "sonar",                                # Basic free model
        ]
        
        for model in free_models:
            try:
                print(f"[AI] Trying Perplexity {model} (Free tier)...")
                response = PERPLEXITY_CLIENT.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_tokens=2000
                )
                print(f"[AI] Perplexity {model} succeeded!")
                return response.choices[0].message.content
            except Exception as e:
                print(f"[AI] Perplexity {model} error: {e}")
                continue
    
    return None


# ============================================================================
# BEGINNER-FOCUSED HELPER FUNCTIONS
# ============================================================================

def get_pre_interview_tips(position, experience_level):
    """
    Shows beginner-friendly tips before interview starts.
    Reduces anxiety and sets expectations.
    """
    tips = {
        "preparation": [
            "📋 Have your resume open to reference projects/skills",
            "💧 Keep water nearby - dry mouth is normal when nervous",
            "😊 Smile before you start - it helps you sound confident",
            "⏸️ It's okay to pause and think before answering"
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
            "why_good": "✅ Specific situation, ✅ Clear actions taken, ✅ Measurable results"
        },
        "common_mistakes": [
            "❌ Don't say 'I don't know' - try 'I haven't worked with that, but here's how I'd approach it'",
            "❌ Don't memorize answers - practice key points and speak naturally",
            "❌ Don't rush - interviewers prefer thoughtful slower answers over fast rambling"
        ],
        "mindset": [
            "🎯 This is PRACTICE - mistakes help you improve",
            "💪 Even senior engineers get nervous in interviews",
            "📈 Your first answer will be rough - that's normal, you'll improve by #3"
        ]
    }
    
    return tips


    @staticmethod
    def progressive_question_order(questions, experience_level="0-2 years"):
        """
        Orders questions logically: Intro -> Project/Technical -> Behavioral.
        Preserves ALL generated questions instead of arbitrary slicing.
        """
        # 1. Define category priority (lower = earlier)
        category_order = {
            'intro': 1,
            'project': 3,
            'technical': 3, # Project and Technical are interleaved/same phase usually
            'ai': 2,
            'behavioral': 4,
            'situational': 4
        }
        
        # 2. Sort function
        def get_sort_key(q):
            cat = q.get('category', '').lower()
            # Default to middle priority if unknown
            priority = category_order.get(cat, 3) 
            
            # Secondary sort: Difficulty (Easy -> Medium -> Hard) within category
            diff = q.get('difficulty', 'Medium').lower()
            diff_score = {'easy': 1, 'medium': 2, 'hard': 3}.get(diff, 2)
            
            # Maintain original AI order as tie-breaker (implied by index stability in python sort)
            return (priority, diff_score)

        # 3. Sort and return
        # Python's sort is stable, so original AI ordering within categories is preserved
        ordered = sorted(questions, key=get_sort_key)
        
        # Ensure we don't return too many questions if AI went crazy, but don't cut strict 2-6-3
        return ordered[:15]


def generate_beginner_encouragement(response_count, performance_trend):
    """
    Provides progressive encouragement throughout interview.
    Beginners need more positive reinforcement.
    """
    encouragements = {
        1: [
            "Great start! First questions are always the hardest. 🌟",
            "You're doing this! Take a breath and keep going.",
            "Nice job breaking the ice! The next ones will feel easier."
        ],
        3: [
            "You're getting into a rhythm now! Keep it up. 💪",
            "Three questions down! Notice how you're getting more comfortable?",
            "Solid progress! Your answers are becoming more detailed."
        ],
        5: [
            "Halfway through! You're handling this really well. 🎯",
            "Five answers in! Your confidence is showing.",
            "Great job sustaining focus! You've got this."
        ],
        8: [
            "Almost there! Strong finish incoming. 🚀",
            "You're in the home stretch - finish strong!",
            "Look at you go! Just a few more questions."
        ]
    }
    
    # Performance-based messages
    if performance_trend == 'improving':
        return "🔥 You're improving with each answer! This is exactly how practice works."
    elif performance_trend == 'consistent':
        return "✅ Consistent delivery - that's professionalism!"
    elif performance_trend == 'struggling':
        return "💙 Interviews are tough! Every answer is practice. Keep going - you've got this."
    
    # Milestone-based
    for milestone, messages in encouragements.items():
        if response_count == milestone:
            return random.choice(messages)
    
    return "Keep going! 💪"


def detect_performance_trend(recent_responses):
    """
    Analyzes last 3 responses to detect improvement/decline.
    Used for adaptive encouragement.
    """
    if len(recent_responses) < 2:
        return 'new'
    
    # Get scores for last 2-3 responses
    scores = []
    for resp in recent_responses[-3:]:
        # Composite score: fluency + sentiment + word_count_normalized
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


def add_beginner_friendly_tips_to_feedback(feedback_dict, user_metrics):
    """
    Enhances feedback with beginner-specific, actionable tips.
    Replaces jargon with simple language.
    """
    # Extract metrics
    wpm = user_metrics.get('words_per_minute', 0)
    fillers_dict = user_metrics.get('filler_words', {})
    fillers = sum(fillers_dict.values()) if fillers_dict else 0
    word_count = user_metrics.get('word_count', 0)
    
    # Add beginner-friendly explanations
    beginner_tips = []
    
    if wpm < 80 and wpm > 0:
        beginner_tips.append({
            "issue": "Speaking slowly",
            "why_it_matters": "Slow pace can make you seem uncertain or unprepared",
            "how_to_fix": "Practice answering in front of a mirror at conversational speed (like talking to a friend)",
            "try_now": "Record yourself on your phone - you should sound natural, not rehearsed"
        })
    
    if fillers > 5:
        most_common_filler = max(fillers_dict, key=fillers_dict.get) if fillers_dict else 'um'
        beginner_tips.append({
            "issue": f"Using '{most_common_filler}' frequently",
            "why_it_matters": "Filler words make you seem less confident and distract from your message",
            "how_to_fix": "When you catch yourself about to say 'um', pause silently for 1 second instead",
            "try_now": "Count your fillers in your next answer - awareness is the first step"
        })
    
    if word_count < 40:
        beginner_tips.append({
            "issue": "Answers are too brief",
            "why_it_matters": "Interviewers want details to evaluate your experience and thinking",
            "how_to_fix": "Use STAR method: Every answer should have Situation, Task, Action, Result (aim for 60-90 seconds)",
            "try_now": "Before answering, mentally outline: What happened? What did I do? What was the outcome?"
        })
    
    # Add to feedback
    feedback_dict['beginner_tips'] = beginner_tips
    
    # Simplify language in existing feedback
    if 'detailed_improvements' in feedback_dict:
        simplified = []
        for improvement in feedback_dict['detailed_improvements']:
            # Remove jargon
            simple = improvement.replace('fluency', 'speaking smoothness')
            simple = simple.replace('articulation', 'clarity')
            simple = simple.replace('cadence', 'rhythm')
            simplified.append(simple)
        feedback_dict['detailed_improvements'] = simplified
    
    return feedback_dict


# ============================================================================
# UTILITY FUNCTIONS FOR BETTER EVALUATION
# ============================================================================

def detect_star_method(transcript):
    """
    Detects if answer follows STAR method (Situation, Task, Action, Result).
    Returns: (bool, int) - (used_star, score_out_of_4)
    """
    if not transcript or len(transcript) < 20:
        return False, 0
    
    transcript_lower = transcript.lower()
    
    # STAR indicators
    situation_indicators = [
        'situation', 'when i was', 'at my previous', 'in my role', 
        'while working', 'at that time', 'back when', 'during my time'
    ]
    task_indicators = [
        'task', 'needed to', 'had to', 'responsible for', 'my goal was',
        'assignment was', 'challenge was', 'problem was'
    ]
    action_indicators = [
        'i did', 'i created', 'i implemented', 'i decided', 'my approach',
        'i developed', 'i built', 'i designed', 'i executed', 'i led'
    ]
    result_indicators = [
        'result', 'outcome', 'achieved', 'improved', 'increased', 
        'decreased', 'successfully', 'completed', 'delivered'
    ]
    
    has_situation = any(indicator in transcript_lower for indicator in situation_indicators)
    has_task = any(indicator in transcript_lower for indicator in task_indicators)
    has_action = any(indicator in transcript_lower for indicator in action_indicators)
    has_result = any(indicator in transcript_lower for indicator in result_indicators)
    
    star_score = sum([has_situation, has_task, has_action, has_result])
    used_star = star_score >= 3  # Need at least 3 of 4 components
    
    return used_star, star_score


def calculate_content_quality(question_text, answer_text):
    """
    Evaluates answer quality beyond just length.
    Returns score 0-100 based on multiple factors.
    """
    if not answer_text or len(answer_text.strip()) < 5:
        return 0
    
    word_count = len(answer_text.split())
    score = 0
    
    # 1. Length appropriateness (0-30 points)
    if word_count >= 80:
        score += 30  # Excellent depth
    elif word_count >= 60:
        score += 25  # Good depth
    elif word_count >= 40:
        score += 20  # Adequate
    elif word_count >= 20:
        score += 10  # Brief but acceptable
    else:
        score += 5  # Too short
    
    # 2. Specificity (0-25 points) - contains examples/numbers/details
    specificity = 0
    
    # Contains numbers (dates, metrics, percentages)
    if re.search(r'\d+', answer_text):
        specificity += 8
    
    # Contains specific examples
    example_phrases = [
        'for example', 'specifically', 'such as', 'for instance', 
        'in particular', 'one time', 'once when'
    ]
    if any(phrase in answer_text.lower() for phrase in example_phrases):
        specificity += 10
    
    # Contains concrete details (project names, company names, technologies)
    if re.search(r'[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+', answer_text):  # Proper nouns
        specificity += 7
    
    score += min(25, specificity)
    
    # 3. Structure (0-20 points)
    used_star, star_score = detect_star_method(answer_text)
    if used_star:
        score += 20
    elif star_score >= 2:
        score += 10  # Partial structure
    
    # 4. Relevance (0-25 points) - addresses the question
    question_words = set(question_text.lower().split())
    answer_words = set(answer_text.lower().split())
    
    # Remove common words
    common_words = {
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'can', 'of', 'in', 'to', 'for', 'on', 'at'
    }
    question_keywords = question_words - common_words
    answer_keywords = answer_words - common_words
    
    if question_keywords:
        overlap = len(question_keywords & answer_keywords)
        relevance_score = min(25, (overlap / len(question_keywords)) * 25)
        score += relevance_score
    else:
        score += 15  # Default if no keywords
    
    return min(100, int(score))


def calculate_percentile(score, metric_type='overall'):
    """
    Estimates percentile based on score.
    In production, this should query actual user data.
    """
    percentiles = {
        'overall': {
            90: 90, 80: 75, 70: 60, 60: 45, 50: 30, 40: 20, 30: 10
        },
        'communication': {
            90: 85, 80: 70, 70: 55, 60: 40, 50: 25, 40: 15, 30: 8
        }
    }
    
    thresholds = percentiles.get(metric_type, percentiles['overall'])
    for threshold, percentile in sorted(thresholds.items(), reverse=True):
        if score >= threshold:
            return f"{percentile}th percentile"
    
    return "Below 10th percentile"


def validate_and_normalize_metrics(fluency_metrics, user_transcript):
    """
    Validates voice metrics from frontend and fills in missing values.
    Returns normalized metrics dictionary.
    """
    if not fluency_metrics or not isinstance(fluency_metrics, dict):
        print("[WARNING] No fluency metrics provided, calculating from transcript")
        fluency_metrics = {}
    
    voice_metrics = fluency_metrics.get('voiceMetrics', {})
    
    # Calculate word count from transcript if missing
    if not voice_metrics.get('word_count'):
        voice_metrics['word_count'] = len(user_transcript.split())
        print(f"[INFO] Calculated word count: {voice_metrics['word_count']}")
    
    # Calculate WPM if we have duration
    if voice_metrics.get('speaking_duration_seconds'):
        duration = voice_metrics['speaking_duration_seconds']
        word_count = voice_metrics['word_count']
        if not voice_metrics.get('words_per_minute') and duration > 0:
            voice_metrics['words_per_minute'] = int((word_count / duration) * 60)
            print(f"[INFO] Calculated WPM: {voice_metrics['words_per_minute']}")
    else:
        # Estimate duration if missing (assume 120 wpm average)
        if not voice_metrics.get('words_per_minute'):
            voice_metrics['words_per_minute'] = 120  # Default average
            voice_metrics['speaking_duration_seconds'] = voice_metrics['word_count'] / 2
    
    # Ensure filler_words is a dict
    if not isinstance(voice_metrics.get('filler_words'), dict):
        voice_metrics['filler_words'] = {}
    
    # Default other metrics if missing
    voice_metrics.setdefault('pause_count', 0)
    voice_metrics.setdefault('average_volume', 0.5)
    
    fluency_metrics['voiceMetrics'] = voice_metrics
    return fluency_metrics


def log_ai_failure(context, error=None):
    """
    Logs AI failures for monitoring.
    In production, send to logging service or database.
    """
    timestamp = datetime.now().isoformat()
    log_entry = {
        'timestamp': timestamp,
        'context': context,
        'has_gemini': HAS_GEMINI,
        'has_openai': HAS_OPENAI,
        'has_perplexity': HAS_PERPLEXITY,
        'has_openrouter': HAS_OPENROUTER,
        'has_bytez': HAS_BYTEZ,
        'error': str(error) if error else None
    }
    print(f"[AI_FAILURE] {json.dumps(log_entry)}")
    # TODO: Send to monitoring service (Sentry, CloudWatch, etc.)


# ============================================================================
# MAIN SERVICE CLASSES
# ============================================================================

class ResumeParserService:
    @staticmethod
    def parse_resume(file_path):
        """
        Extracts text from PDF and uses AI to structure it intelligently.
        """
        logger.info("=" * 80)
        logger.info("RESUME PARSING STARTED")
        logger.info(f"File path: {file_path}")
        
        try:
            logger.info("Step 1: Extracting text from PDF...")
            raw_text = extract_text(file_path)
            text_length = len(raw_text)
            logger.info(f"Extracted {text_length} characters from PDF")
            
            if text_length < 100:
                logger.warning(f"PDF text is very short ({text_length} chars) - might be scanned image or corrupted")
            
            logger.info(f"Preview: {raw_text[:200]}...")
            
            if not (HAS_GEMINI or HAS_OPENAI or HAS_PERPLEXITY or HAS_OPENROUTER or HAS_BYTEZ):
                logger.warning("NO AI PROVIDERS AVAILABLE - Using mock data")
                return {
                    "skills": ["Python", "Django", "React (Mock)"],
                    "experience_years": 2,
                    "projects": [{"name": "Mock Project A", "description": "Sample project"}],
                    "experience": [{"title": "Developer", "company": "Mock Corp"}],
                    "education": [{"degree": "Computer Science", "institution": "Mock University"}],
                    "strengths": ["Communication"],
                    "areas_for_growth": ["Public speaking"]
                }

            logger.info("Step 2: Sending to AI for parsing...")
            logger.info(f"AI Status - Gemini: {HAS_GEMINI}, OpenRouter: {HAS_OPENROUTER}, OpenAI: {HAS_OPENAI}")
            
            prompt = f"""You are an expert resume parser. Analyze this resume and extract structured information.

    RESUME TEXT:
    {raw_text[:10000]}

    Extract the following in JSON format:
    {{
    "skills": ["skill1", "skill2", ...],
    "experience_years": <integer>,
    "projects": [
        {{"name": "Project Name", "description": "Brief description", "technologies": ["tech1", "tech2"]}}
    ],
    "experience": [
        {{"title": "Job Title", "company": "Company Name", "duration": "2020-2022", "achievements": ["achievement1"]}}
    ],
    "education": [
        {{"degree": "Degree Name", "institution": "School Name", "graduation_year": "2020"}}
    ],
    "certifications": ["cert1", "cert2"],
    "strengths": ["strength1", "strength2"],
    "areas_for_growth": ["area1", "area2"]
    }}

    Be thorough and extract ALL skills mentioned. Return ONLY valid JSON."""
            
            response_text = call_ai(prompt, temperature=0.3)
            
            if response_text:
                logger.info("AI response received")
                logger.info(f"Response length: {len(response_text)} chars")
                logger.info(f"Preview: {response_text[:150]}...")
                
                json_str = response_text.replace('```json', '').replace('```', '').strip()
                parsed_data = json.loads(json_str)
                
                # Ensure required fields exist
                parsed_data.setdefault('skills', [])
                parsed_data.setdefault('projects', [])
                parsed_data.setdefault('experience', [])
                parsed_data.setdefault('education', [])
                parsed_data.setdefault('experience_years', 0)
                
                logger.info("RESUME PARSING SUCCESSFUL")
                logger.info("Extracted:")
                logger.info(f"   - Skills: {len(parsed_data.get('skills', []))} items")
                logger.info(f"   - Projects: {len(parsed_data.get('projects', []))} items")
                logger.info(f"   - Experience: {len(parsed_data.get('experience', []))} items")
                logger.info(f"   - Education: {len(parsed_data.get('education', []))} items")
                logger.info(f"   - Years of Experience: {parsed_data.get('experience_years', 0)}")
                
                if parsed_data.get('skills'):
                    logger.info(f"   - Top Skills: {', '.join(parsed_data['skills'][:5])}")
                
                logger.info("=" * 80)
                return parsed_data
            else:
                logger.error("AI returned no response")
                log_ai_failure('resume_parsing')
                
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing failed: {e}")
            logger.error(f"Response was: {response_text[:500] if response_text else 'None'}")
            log_ai_failure('resume_parsing', e)
        except Exception as e:
            logger.error(f"Resume parsing failed: {e}")
            logger.exception("Full traceback:")
            log_ai_failure('resume_parsing', e)
        
        # Fallback: basic extraction
        logger.warning("Using fallback mock data")
        logger.info("=" * 80)
        return {
            "skills": ["Communication", "Problem Solving"],
            "experience_years": 1,
            "projects": [],
            "experience": [],
            "education": [],
            "strengths": ["Adaptability"],
            "areas_for_growth": ["Technical depth"]
        }

    @staticmethod
    def generate_questions(position, resume_data, difficulty="Medium", experience_level="0-2 years", excluded_questions=None):
        """
        Generates personalized interview questions using enhanced AI prompting.
        Excludes recently asked questions to prevent repetition.
        """
        excluded_questions = excluded_questions or []
        
        # Extract resume details
        skills = resume_data.get('skills', [])
        projects = resume_data.get('projects', [])
        experience = resume_data.get('experience', [])
        education = resume_data.get('education', [])
        experience_years = resume_data.get('experience_years', 0)
        
        # Check AI availability
        has_any_ai = HAS_GEMINI or HAS_OPENAI or HAS_PERPLEXITY or HAS_OPENROUTER or HAS_BYTEZ
        print(f"[AI Status] Gemini: {HAS_GEMINI}, OpenRouter: {HAS_OPENROUTER}, "
              f"OpenAI: {HAS_OPENAI}, Perplexity: {HAS_PERPLEXITY}, Bytez: {HAS_BYTEZ}")
        
        # Filter excluded questions specific to this context if needed, 
        # but passing the raw list to LLM is usually better.
        # Format excluded list for prompt
        excluded_text = ""
        if excluded_questions:
            # Take last 20 to keep prompt size manageable
            recent_excluded = excluded_questions[:20] 
            excluded_text = "\n\n**CRITICAL - DO NOT ASK THESE QUESTIONS (ALREADY ASKED):**\n" + \
                            "\n".join([f"- {q}" for q in recent_excluded])

        # Build detailed resume context
        context_parts = []
        
        if skills:
            context_parts.append(f"**Technical Skills:** {', '.join(skills[:15])}")
        
        if projects:
            project_details = []
            for p in projects[:3]:
                if isinstance(p, dict):
                    tech_str = (f" (using {', '.join(p.get('technologies', [])[:3])})" 
                               if p.get('technologies') else "")
                    project_details.append(
                        f"• {p.get('name', 'Project')}: {p.get('description', '')}{tech_str}"
                    )
                else:
                    project_details.append(f"• {p}")
            context_parts.append(f"**Key Projects:**\n" + "\n".join(project_details))
        
        if experience:
            exp_details = []
            for e in experience[:3]:
                if isinstance(e, dict):
                    duration_str = f" ({e.get('duration', '')})" if e.get('duration') else ""
                    exp_details.append(
                        f"• {e.get('title', 'Position')} at {e.get('company', 'Company')}{duration_str}"
                    )
                else:
                    exp_details.append(f"• {e}")
            context_parts.append(f"**Work Experience:**\n" + "\n".join(exp_details))
        
        if education:
            edu_details = []
            for e in education[:2]:
                if isinstance(e, dict):
                    grad_str = f", {e.get('graduation_year', '')}" if e.get('graduation_year') else ""
                    edu_details.append(
                        f"• {e.get('degree', 'Degree')} from {e.get('institution', 'Institution')}{grad_str}"
                    )
                else:
                    edu_details.append(f"• {e}")
            context_parts.append(f"**Education:**\n" + "\n".join(edu_details))

        resume_context = "\n\n".join(context_parts) if context_parts else "Limited resume information provided."

        # Unique session seed
        import uuid
        session_seed = str(uuid.uuid4())[:8]
        
        # Determine role type
        technical_keywords = [
            'developer', 'engineer', 'programmer', 'architect', 'devops', 'data', 
            'analyst', 'scientist', 'backend', 'frontend', 'fullstack', 'software', 
            'sre', 'qa', 'tester', 'designer', 'ml', 'ai'
        ]
        is_technical_role = any(keyword in position.lower() for keyword in technical_keywords)
        
        skills_list = ', '.join(skills[:10]) if skills else 'general skills'
        
        # Build role-specific guidance
        if is_technical_role:
            role_guidance = f"""
**TECHNICAL ROLE QUESTION DISTRIBUTION:**

**A. Fundamentals & Concepts (3-4 questions)**
Ask about SPECIFIC concepts from: {skills_list}
Examples: "Explain Python decorators", "How does React's virtual DOM work?"

**B. Practical Problem-Solving (3-4 questions)**
Real scenarios: "Debug a memory leak", "Optimize slow API", "Design caching strategy"

**C. Project Deep-Dive (2-3 questions)**
Reference their actual projects from resume

**D. Behavioral (2-3 questions)**
STAR method scenarios

**E. Modern Tech/AI (1-2 questions)**
AI integration, current tools"""
        else:
            role_guidance = f"""
**NON-TECHNICAL ROLE QUESTION DISTRIBUTION:**

**A. Domain Knowledge (3-4 questions)**
Industry-specific concepts and best practices

**B. Problem-Solving (3-4 questions)**
Case studies and situational judgment

**C. Experience-Based (2-3 questions)**
STAR method stories from their background

**D. Behavioral (2-3 questions)**
Teamwork, leadership, adaptability

**E. Strategic Thinking (1-2 questions)**
Future trends, innovation"""

        difficulty_examples = {
            'Easy': 'Definitions: "What is X?", "Explain Y"',
            'Medium': 'Implementation: "How does X work?", "Compare X vs Y"',
            'Hard': 'Design: "Architect a system", "Analyze trade-offs"'
        }

        prompt = f"""You are an expert interviewer conducting a {difficulty} level mock interview for **{position}**.

OBJECTIVE: Generate realistic interview questions for this candidate. Follow the EXACT structure below.
{excluded_text}

CANDIDATE PROFILE:
{resume_context}
Experience: {experience_level} ({experience_years} years)
Session: {session_seed}

**EXACT QUESTION STRUCTURE (12-14 questions total):**

**PHASE 1: INTRO (Questions 1-4)** - Build rapport and confidence
Q1: "Tell me about yourself and your background"
Q2: "What interests you about the {position} role?"  
Q3: "Which technology or programming language from your resume are you most comfortable with?"
Q4: "Great! I'd like to ask you some technical questions about [their answer to Q3]. Are you comfortable with that?" (Transition question)

**PHASE 2: TECHNOLOGY DEEP-DIVE (Questions 5-9)** - Based on their preferred technology
- Ask 4-5 specific questions about the technology they mentioned in Q3
- Start with basics, then go deeper into implementation details
- Ask about specific technologies from: {skills_list}
- Reference their ACTUAL projects: e.g., questions about architecture, challenges, trade-offs
{role_guidance}

**PHASE 3: BEHAVIORAL (Questions 9-12/14)** - STAR method
- "Tell me about a time when you faced a challenging deadline"
- "Describe a situation where you had a disagreement with a team member"
- "Give an example of when you failed and what you learned"
- "Tell me about your greatest professional achievement"

**DIFFICULTY LEVEL:** {difficulty_examples.get(difficulty, difficulty_examples['Medium'])}

**IMPORTANT RULES:**
- Generate EXACTLY 12-14 questions (not less!)
- Questions must reference their ACTUAL skills and projects
- Start easy, build to harder, end with behavioral
- Each question should be unique and specific
- **DO NOT** ask questions from the "ALREADY ASKED" list above.

**OUTPUT FORMAT (JSON array):**
```json
[
  {{"text": "Question text", "category": "Intro|Technical|Behavioral|Project", "difficulty": "Easy|Medium|Hard", "coaching_tip": "What this evaluates"}}
]
```

Generate exactly 12-14 questions following the structure above:"""

        # Try AI generation
        if has_any_ai:
            response_text = call_ai(prompt, temperature=1.2)
            if response_text:
                try:
                    json_str = response_text.replace('```json', '').replace('```', '').strip()
                    questions = json.loads(json_str)
                    
                    validated_questions = []
                    for q in questions:
                        if isinstance(q, dict) and 'text' in q:
                            # Verify deduplication locally just in case
                            is_duplicate = False
                            q_text_clean = q['text'].lower().strip()
                            for ex in excluded_questions:
                                if q_text_clean == ex.lower().strip() or q_text_clean in ex.lower() or ex.lower() in q_text_clean:
                                    # Simple collision check - skip only if extremely similar
                                    # But relax it a bit because "Tell me about yourself" is always needed.
                                    if "tell me about yourself" not in q_text_clean: 
                                        is_duplicate = True
                                        break
                            
                            if not is_duplicate:
                                validated_questions.append({
                                    'text': q['text'],
                                    'category': q.get('category', 'Technical'),
                                    'difficulty': q.get('difficulty', difficulty),
                                    'coaching_tip': q.get('coaching_tip', '')
                                })
                    
                    if len(validated_questions) >= 10:
                        print(f"[SUCCESS] Generated {len(validated_questions)} AI questions")
                        # Apply progressive ordering for beginners
                        return progressive_question_order(validated_questions[:15], experience_level)
                        
                except Exception as e:
                    print(f"[ERROR] Failed to parse AI questions: {e}")
                    log_ai_failure('question_generation', e)
            else:
                log_ai_failure('question_generation')
        
        # ENHANCED FALLBACK
        logger.info("AI unavailable or failed - Using enhanced fallback questions")
        print("[INFO] Using enhanced fallback questions")
        
        # Base fallback set
        fallback_questions = [
            # INTRO/WARMUP (First - build confidence)
            {
                "text": f"Tell me about yourself and your background.",
                "category": "Intro",
                "difficulty": "Easy",
                "coaching_tip": "Elevator pitch - keep it under 2 minutes"
            },
            {
                "text": f"What interests you about the {position} role?",
                "category": "Intro",
                "difficulty": "Easy",
                "coaching_tip": "Show genuine interest and research"
            },
            {
                "text": "Walk me through your resume briefly.",
                "category": "Intro",
                "difficulty": "Easy",
                "coaching_tip": "Highlight relevant experience"
            },
            {
                "text": "Describe a challenging situation at work and how you handled it.",
                "category": "Behavioral",
                "difficulty": "Medium",
                "coaching_tip": "STAR method and problem-solving"
            },
            {
                "text": "Tell me about a time you worked with a difficult team member.",
                "category": "Behavioral",
                "difficulty": "Medium",
                "coaching_tip": "Conflict resolution"
            },
            {
                "text": "What's your greatest professional achievement?",
                "category": "Behavioral",
                "difficulty": "Easy",
                "coaching_tip": "Self-awareness"
            },
            {
                "text": "Where do you see yourself in 3-5 years?",
                "category": "Behavioral",
                "difficulty": "Easy",
                "coaching_tip": "Career goals"
            },
            {
                "text": "Describe a time you failed and what you learned.",
                "category": "Behavioral",
                "difficulty": "Medium",
                "coaching_tip": "Growth mindset"
            },
            {
                "text": "How do you handle competing priorities?",
                "category": "Behavioral",
                "difficulty": "Medium",
                "coaching_tip": "Time management"
            },
        ]
        
        # Add skill-specific questions
        for skill in skills[:3]:
            skill_str = str(skill) if not isinstance(skill, dict) else skill.get('name', 'this skill')
            fallback_questions.append({
                "text": f"How have you used {skill_str} in your projects? Give a specific example.",
                "category": "Technical",
                "difficulty": difficulty,
                "coaching_tip": f"Practical {skill_str} experience"
            })
        
        # Add project questions
        if projects:
            proj = projects[0]
            proj_name = proj.get('name', 'your main project') if isinstance(proj, dict) else str(proj)
            fallback_questions.extend([
                {
                    "text": f"Walk me through {proj_name} - what was your role?",
                    "category": "Project",
                    "difficulty": "Medium",
                    "coaching_tip": "Project ownership"
                },
                {
                    "text": f"What would you do differently if you rebuilt {proj_name}?",
                    "category": "Project",
                    "difficulty": "Hard",
                    "coaching_tip": "Learning from experience"
                }
            ])
        
        # Technical depth for technical roles
        if is_technical_role:
            fallback_questions.extend([
                {
                    "text": "Explain your debugging approach for complex issues.",
                    "category": "Technical",
                    "difficulty": "Medium",
                    "coaching_tip": "Problem-solving methodology"
                },
                {
                    "text": "How do you stay current with technology trends?",
                    "category": "Technical",
                    "difficulty": "Easy",
                    "coaching_tip": "Continuous learning"
                },
            ])
        
        # AI/Modern tech
        fallback_questions.append({
            "text": f"How would you use AI to improve productivity in a {position} role?",
            "category": "AI",
            "difficulty": "Medium",
            "coaching_tip": "Innovation awareness"
        })
        
        # Deduplicate Fallbacks
        final_fallbacks = []
        for q in fallback_questions:
            is_dup = False
            for ex in excluded_questions:
                 # Check for collision
                 if q['text'].lower() == ex.lower():
                     if "tell me about yourself" not in ex.lower():
                        is_dup = True
                        break
            if not is_dup:
                final_fallbacks.append(q)

        # Don't shuffle - maintain Intro → Technical → Behavioral order
        # progressive_question_order will ensure proper ordering
        return progressive_question_order(final_fallbacks, experience_level)

    @staticmethod
    def generate_followup_question(session, prev_question, prev_answer, voice_metrics=None):
        """
        Generates empathetic follow-up questions based on performance.
        """
        if not (HAS_GEMINI or HAS_OPENAI or HAS_PERPLEXITY or HAS_OPENROUTER):
            # Simple fallback
            answer_length = len(prev_answer.strip()) if prev_answer else 0
            if answer_length < 30:
                return {
                    "text": "That's a good start! Can you elaborate with a specific example?",
                    "category": "Follow-up"
                }
            return {
                "text": "Interesting! Can you tell me more about that specific aspect?",
                "category": "Follow-up"
            }
        
        answer_length = len(prev_answer.strip()) if prev_answer else 0
        voice_metrics = voice_metrics or {}
        
        # Extract and validate metrics
        pause_count = voice_metrics.get('pause_count', 0)
        words_per_minute = voice_metrics.get('words_per_minute', 120)
        filler_words = voice_metrics.get('filler_words', {})
        avg_volume = voice_metrics.get('average_volume', 0.5)
        total_fillers = sum(filler_words.values()) if filler_words else 0
        
        # Detect nervousness
        nervousness_signals = []
        if pause_count > 3:
            nervousness_signals.append(f"Frequent pauses ({pause_count})")
        if words_per_minute < 80 or words_per_minute > 180:
            nervousness_signals.append(f"Unusual pace ({words_per_minute} wpm)")
        if total_fillers > 5:
            nervousness_signals.append(f"Many fillers ({total_fillers})")
        if avg_volume < 0.3:
            nervousness_signals.append("Quiet voice")
        if answer_length < 50:
            nervousness_signals.append("Very brief")
        
        seems_nervous = len(nervousness_signals) >= 2

        nervous_strategy = """**STRATEGY:**
1. Encourage: "You're doing great!"
2. Simplify: Ask about ONE thing they mentioned
3. Guide: "Try: Situation → Action → Result"
"""

        confident_strategy = """**STRATEGY:**
1. Acknowledge: "Great answer!"
2. Go deeper: Technical details or trade-offs
3. Reference specifics from their answer
"""

        prompt = f"""You are a supportive interview coach. Generate ONE contextual follow-up question.

**PREVIOUS QUESTION:** "{prev_question}"
**CANDIDATE'S ANSWER:** "{prev_answer}"

**VOICE METRICS:** {words_per_minute} wpm, {pause_count} pauses, {total_fillers} fillers, {answer_length} chars

**ASSESSMENT:** {"⚠️ SEEMS NERVOUS - Be supportive and encouraging" if seems_nervous else "✅ CONFIDENT - Challenge them to go deeper"}

**INSTRUCTIONS:**
1. READ their answer carefully and extract KEY DETAILS they mentioned:
   - Any technologies, tools, or frameworks
   - Any projects or experiences
   - Any challenges or problems
   - Any team interactions or achievements
   
2. Generate a follow-up that:
   - REFERENCES something specific from their answer
   - If they mentioned a technology → ask about its implementation details
   - If they mentioned a project → ask about challenges or trade-offs
   - If they mentioned a problem → ask how they solved it
   - If they gave a short answer → ask them to elaborate with a specific example

{nervous_strategy if seems_nervous else confident_strategy}

Return JSON: {{"text": "Your specific follow-up question?"}}"""

        response_text = call_ai(prompt, temperature=0.85)
        if response_text:
            try:
                json_str = response_text.replace('```json', '').replace('```', '').strip()
                data = json.loads(json_str)
                followup_text = data.get('text', "Can you elaborate on that?")
                print(f"[SUCCESS] Generated AI follow-up: {followup_text[:50]}...")
                return {"text": followup_text, "category": "Follow-up"}
            except json.JSONDecodeError as e:
                print(f"[ERROR] Follow-up JSON parsing failed: {e}")
                log_ai_failure('followup_generation', e)
            except Exception as e:
                print(f"[ERROR] Follow-up generation error: {e}")
                log_ai_failure('followup_generation', e)
        else:
            print("[WARNING] AI returned no response for follow-up")
            log_ai_failure('followup_generation')
        
        # Intelligent fallback based on answer characteristics
        print("[INFO] Using fallback follow-up question")
        
        if answer_length < 30:
            return {
                "text": "That's a good start! Can you give me a specific example from your experience?",
                "category": "Follow-up"
            }
        elif seems_nervous:
            return {
                "text": "You're doing well! Take your time and tell me more about one specific aspect you mentioned.",
                "category": "Follow-up"
            }
        elif total_fillers > 3:
            return {
                "text": "Can you walk me through that step by step? Take a moment to organize your thoughts.",
                "category": "Follow-up"
            }
        elif answer_length > 150:
            # Long answer - dig into specifics
            return {
                "text": "That's comprehensive! Can you focus on one specific challenge you faced and how you overcame it?",
                "category": "Follow-up"
            }
        else:
            # Confident answer - challenge them
            return {
                "text": "Interesting approach! How would that change if you had half the time or resources?",
                "category": "Follow-up"
            }

    @staticmethod
    def analyze_response(question_text, user_transcript, fluency_metrics):
        """
        Provides detailed coaching feedback using a 'Senior Engineer' persona.
        Avoids generic feedback by enforcing quote-based critique.
        """
        # Validate and normalize metrics
        fluency_metrics = validate_and_normalize_metrics(fluency_metrics, user_transcript)
        
        voice_metrics = fluency_metrics.get('voiceMetrics', {})
        wpm = voice_metrics.get('words_per_minute', 0)
        pause_count = voice_metrics.get('pause_count', 0)
        filler_words = voice_metrics.get('filler_words', {})
        avg_volume = voice_metrics.get('average_volume', 0.5)
        word_count = voice_metrics.get('word_count', 0)
        total_fillers = sum(filler_words.values()) if filler_words else 0
        
        # Structure analysis
        used_star, star_score = detect_star_method(user_transcript)
        content_quality = calculate_content_quality(question_text, user_transcript)
        grammar_errors = check_grammar(user_transcript)
        
        # Use AI for meaningful Analysis
        if HAS_GEMINI or HAS_OPENAI or HAS_PERPLEXITY or HAS_OPENROUTER:
            prompt = f"""You are a SENIOR ENGINEERING MANAGER conducting a rigorous interview.
            
**CONTEXT:**
- Question: "{question_text}"
- Candidate Answer: "{user_transcript}"
- Duration: {word_count} words
- Pace: {wpm} wpm (Normal: 120-150)
- Fillers: {total_fillers}

**YOUR TASK:**
Provide raw, honest feedback. Do not coddle. Treat this like a real debrief.
1. **Fact Check**: Is the answer technical/logically sound? 
2. **Quote the Candidate**: You MUST quote exact phrases they used to prove you listened.
3. **No Fluff**: Do NOT say "Good effort", "You tried hard", or "Keep practicing".
4. **Identify Gaps**: specific technologies, concepts, or details missing.

**OUTPUT JSON:**
{{
  "is_answer_correct": true/false,
  "correctness_feedback": "Direct correction of any technical errors. If correct, be brief.",
  "strengths": [
    "Quote a specific strong phrase: 'XYZ' showed good insight.",
    "Specific technical concept explained well."
  ],
  "weaknesses": [
    "Quote a vague phrase: 'I did stuff' is too vague. Say WHAT you did.",
    "Missing specific metrics/results.",
    "Did not mention [Specific Technology/Concept] which is standard for this q."
  ],
  "feedback_text": "2-3 sentences of direct advice. Example: 'You rambled on X. Focus more on Y.'",
  "improvement_tips": [
    "Actionable tip 1",
    "Actionable tip 2"
  ],
  "recommended_resources": [
    {{"title": "Video Title", "url": "https://www.youtube.com/results?search_query=specific+topic", "topic": "Relates to weakness X"}}
  ]
}}"""
            
            ai_response = call_ai(prompt, temperature=0.7)
            if ai_response:
                try:
                    json_str = ai_response.replace('```json', '').replace('```', '').strip()
                    ai_analysis = json.loads(json_str)
                    
                    result = {
                        "is_answer_correct": ai_analysis.get('is_answer_correct', True),
                        "correctness_feedback": ai_analysis.get('correctness_feedback', ''),
                        "strengths": ai_analysis.get('strengths', [])[:3],
                        "weaknesses": ai_analysis.get('weaknesses', [])[:3],
                        "feedback_text": ai_analysis.get('feedback_text', ''),
                        "improvement_tips": ai_analysis.get('improvement_tips', [])[:2],
                        "recommended_resources": ai_analysis.get('recommended_resources', [])[:2],
                        "sentiment_score": 0.5, # Placeholder
                        "star_method_used": used_star,
                        "content_quality_score": content_quality,
                        "grammar_errors": [e['message'] for e in grammar_errors]
                    }
                    return result
                except Exception as e:
                    print(f"[ERROR] AI Parsing failed: {e}")
                    log_ai_failure('response_analysis', e)

        # Fallback if AI fails
        return {
            "is_answer_correct": True, 
            "feedback_text": "AI service unavailable. Please check metrics.",
            "strengths": ["Clear audio"],
            "weaknesses": ["Analysis unavailable"],
            "improvement_tips": ["Check connection"],
            "recommended_resources": [],
            "grammar_errors": []
        }

    @staticmethod
    def generate_final_report(session_id):
        """
        Generates comprehensive interview performance report.
        AI generates detailed insights; falls back to calculated metrics.
        """
        from .models import InterviewSession
        
        try:
            session = InterviewSession.objects.get(id=session_id)
        except Exception as e:
            return {"error": f"Session not found: {e}"}
        
        # Collect all responses
        actual_responses = []
        for q in session.questions.all():
            actual_responses.extend(q.responses.all())

        if not actual_responses:
            return {"error": "No responses found for this session."}

        # Aggregate metrics
        total_fluency = 0
        total_sentiment = 0
        total_wpm = 0
        total_filler_count = 0
        total_word_count = 0
        total_pause_count = 0
        all_grammar_errors = []
        star_method_count = 0
        content_scores = []
        
        for resp in actual_responses:
            total_fluency += resp.fluency_score
            total_sentiment += resp.sentiment_score
            
            # Voice metrics
            meta = resp.body_language_metadata or {}
            voice = meta.get('voiceMetrics', {})
            total_wpm += voice.get('words_per_minute', 0)
            total_pause_count += voice.get('pause_count', 0)
            filler_words = voice.get('filler_words', {})
            total_filler_count += sum(filler_words.values())
            total_word_count += voice.get('word_count', 0)
            
            if resp.grammar_errors:
                all_grammar_errors.extend(resp.grammar_errors)
            
            # STAR method
            if meta.get('star_method_used', False):
                star_method_count += 1
            
            # Content quality
            if 'content_quality_score' in meta:
                content_scores.append(meta['content_quality_score'])

        count = len(actual_responses)
        avg_fluency = (total_fluency / count) if count else 0
        avg_sentiment = (total_sentiment / count) if count else 0
        avg_wpm = (total_wpm / count) if count else 0
        avg_pause = (total_pause_count / count) if count else 0
        avg_fillers_per_answer = (total_filler_count / count) if count else 0
        avg_words_per_answer = (total_word_count / count) if count else 0
        avg_content = (sum(content_scores) / len(content_scores)) if content_scores else 50
        
        # Calculate category scores (0-100)
        pace_score = 100 if 100 <= avg_wpm <= 150 else max(0, 100 - abs(avg_wpm - 125) * 0.8)
        filler_penalty = min(50, avg_fillers_per_answer * 12)
        comm_score = int((pace_score * 0.5) + ((100 - filler_penalty) * 0.3) + (avg_fluency * 20))
        comm_score = max(0, min(100, comm_score))
        
        depth_score = min(100, avg_words_per_answer * 1.5)
        sentiment_score = (avg_sentiment * 50) + 50
        content_score = int((avg_content * 0.5) + (depth_score * 0.3) + (sentiment_score * 0.2))
        content_score = max(0, min(100, content_score))
        
        technical_responses = [
            r for r in actual_responses 
            if 'technical' in (r.question.category or '').lower()
        ]
        behavioral_responses = [
            r for r in actual_responses 
            if 'behavioral' in (r.question.category or '').lower()
        ]
        
        tech_score = content_score if technical_responses else content_score
        behavioral_score = content_score if behavioral_responses else content_score
        
        overall_score = int(
            (comm_score * 0.4) + (content_score * 0.4) + 
            (tech_score * 0.1) + (behavioral_score * 0.1)
        )
        overall_score = max(0, min(100, overall_score))

        # Try AI-generated comprehensive report
        if HAS_GEMINI or HAS_OPENAI or HAS_PERPLEXITY or HAS_OPENROUTER:
            star_percentage = (star_method_count / count) * 100 if count else 0
            
            prompt = f"""You are an expert interview coach. Generate a comprehensive FINAL REPORT for a BEGINNER candidate.

**SESSION STATS:**
- Total Questions: {count}
- Overall Score: {overall_score}/100
- Communication: {comm_score}/100 (pace: {int(avg_wpm)} wpm, fillers: {avg_fillers_per_answer:.1f}/answer, pauses: {avg_pause:.1f})
- Content Quality: {content_score}/100 (avg words: {int(avg_words_per_answer)}, quality: {int(avg_content)}/100)
- STAR Usage: {star_method_count}/{count} ({star_percentage:.0f}%)
- Grammar Issues: {len(all_grammar_errors)}

**TASK:**
Create an encouraging, actionable report for a BEGINNER with:

1. **strengths** (3-5 items): Specific things they did well
- Actionable advice
- End with motivation

Return JSON:
{{
  "strengths": ["Specific strength 1", "Specific strength 2", ...],
  "areas_for_improvement": ["Specific improvement 1", "Specific improvement 2", ...],
  "recommendations": ["Actionable tip 1", "Actionable tip 2", ...],
  "learning_path": [
    {{"title": "Resource Title", "url": "https://www.youtube.com/results?search_query=topic", "type": "Video", "duration": "10 min"}}
  ],
  "key_insights": "2-3 sentence overall assessment",
  "progress_note": "Encouraging final message"
}}"""

            ai_response = call_ai(prompt, temperature=0.7)
            if ai_response:
                try:
                    json_str = ai_response.replace('```json', '').replace('```', '').strip()
                    ai_report = json.loads(json_str)
                    
                    # Build enhanced report with AI insights
                    detailed_report = {
                        "overall_score": overall_score,
                        "percentile": calculate_percentile(overall_score, 'overall'),
                        "category_scores": [
                            {
                                "name": "Communication",
                                "score": comm_score,
                                "percentile": calculate_percentile(comm_score, 'communication')
                            },
                            {"name": "Content Quality", "score": content_score},
                            {
                                "name": "Technical" if technical_responses else "Domain Knowledge",
                                "score": tech_score
                            },
                            {"name": "Behavioral", "score": behavioral_score},
                        ],
                        "strengths": ai_report.get('strengths', [])[:5],
                        "areas_for_improvement": ai_report.get('areas_for_improvement', [])[:5],
                        "detailed_breakdown": {
                            "communication": {
                                "score": comm_score,
                                "avg_pace": f"{int(avg_wpm)} wpm",
                                "ideal_pace": "120-150 wpm",
                                "avg_fillers_per_answer": f"{avg_fillers_per_answer:.1f}",
                                "avg_pauses": f"{avg_pause:.1f}",
                                "benchmark": "< 3 fillers/answer ideal"
                            },
                            "content": {
                                "score": content_score,
                                "avg_words_per_answer": int(avg_words_per_answer),
                                "star_method_usage": f"{star_method_count}/{count} answers ({star_percentage:.0f}%)",
                                "avg_quality_score": f"{int(avg_content)}/100",
                                "sentiment": (
                                    "Positive" if avg_sentiment > 0.2 
                                    else "Neutral" if avg_sentiment > -0.2 
                                    else "Needs work"
                                )
                            },
                            "grammar": {
                                "score": max(0, 100 - (len(all_grammar_errors) * 5)),
                                "total_issues": len(all_grammar_errors),
                                "top_issues": list(set(all_grammar_errors))[:5] if all_grammar_errors else []
                            }
                        },
                        "key_metrics": {
                            "total_questions": count,
                            "avg_answer_length": f"{int(avg_words_per_answer)} words",
                            "speaking_pace": f"{int(avg_wpm)} wpm",
                            "filler_frequency": f"{avg_fillers_per_answer:.1f} per answer",
                            "star_usage": f"{star_percentage:.0f}%",
                            "content_quality": f"{int(avg_content)}/100"
                        },
                        "recommendations": ai_report.get('recommendations', [])[:5],
                        "next_steps": [
                            {
                                "title": "Review Detailed Feedback",
                                "action": "Study question-by-question analysis",
                                "priority": "High"
                            },
                            {
                                "title": "Practice Weak Areas",
                                "action": (
                                    ai_report.get('areas_for_improvement', ['Continue practicing'])[0] 
                                    if ai_report.get('areas_for_improvement') 
                                    else "Focus on key areas"
                                ),
                                "priority": "High"
                            },
                            {
                                "title": "Next Mock Interview",
                                "action": "Schedule another practice session",
                                "priority": "Medium"
                            },
                            {
                                "title": "Learn STAR Method",
                                "action": "Master structured answer technique",
                                "priority": "Medium" if star_percentage < 60 else "Low"
                            }
                        ],
                        "key_insights": ai_report.get('key_insights', ''),
                        "progress_note": ai_report.get(
                            'progress_note',
                            'Keep practicing - you\'re improving!'
                        ),
                        "learning_path": ai_report.get('learning_path', [])[:3],
                        "comparison": {
                            "your_score": overall_score,
                            "average_score": 65,
                            "top_10_percent": 85,
                            "message": (
                                "Above average!" if overall_score > 65 
                                else "Good progress" if overall_score > 50 
                                else "Keep practicing - improvement takes time"
                            )
                        }
                    }
                    
                    session.feedback_report = detailed_report
                    session.save()
                    
                    print(f"[SUCCESS] Generated AI-powered final report - Overall: {overall_score}/100")
                    return detailed_report
                    
                except Exception as e:
                    print(f"[ERROR] AI report parsing failed: {e}")
                    log_ai_failure('final_report_generation', e)
        
        # FALLBACK: Generate insights using calculated metrics
        print("[INFO] Using fallback final report (AI unavailable)")
        
        strengths = []
        improvements = []
        recommendations = []
        
        # Communication insights
        if 100 <= avg_wpm <= 150:
            strengths.append(f"Excellent speaking pace ({int(avg_wpm)} wpm) - confident and clear")
        elif 80 <= avg_wpm < 100:
            strengths.append(f"Steady pace ({int(avg_wpm)} wpm) - thoughtful delivery")
        elif avg_wpm < 80 and avg_wpm > 0:
            improvements.append(f"Speaking pace was slow ({int(avg_wpm)} wpm) - aim for 120-140 wpm")
            recommendations.append("Practice speaking at natural conversational speed daily")
        elif avg_wpm > 160:
            improvements.append(f"Speaking pace was fast ({int(avg_wpm)} wpm) - slow down")
            recommendations.append("Take deliberate pauses between key points")
        
        # Filler words
        if avg_fillers_per_answer <= 1:
            strengths.append("Minimal filler words - polished delivery")
        elif avg_fillers_per_answer <= 3:
            strengths.append(f"Low filler usage ({avg_fillers_per_answer:.1f} per answer)")
        else:
            improvements.append(f"High filler word usage ({avg_fillers_per_answer:.1f} per answer)")
            recommendations.append("Record practice sessions and track filler word reduction")
        
        # Answer depth
        if avg_words_per_answer >= 70:
            strengths.append(
                f"Detailed answers ({int(avg_words_per_answer)} words avg) - excellent depth"
            )
        elif avg_words_per_answer < 35:
            improvements.append(f"Brief answers ({int(avg_words_per_answer)} words avg) - elaborate more")
            recommendations.append("Use STAR method to structure longer, more detailed answers")
        
        # Grammar
        if not all_grammar_errors:
            strengths.append("Grammatically clear speech throughout interview")
        elif len(all_grammar_errors) <= 3:
            strengths.append("Minor grammar issues - overall very clear")
        else:
            improvements.append(f"Found {len(all_grammar_errors)} grammar issues")
            recommendations.append("Practice speaking in complete, grammatically correct sentences")
        
        # STAR method
        star_percentage = (star_method_count / count) * 100 if count else 0
        if star_percentage >= 60:
            strengths.append(f"Strong use of STAR method ({star_method_count}/{count} answers)")
        elif star_percentage >= 30:
            improvements.append(
                f"Partial STAR usage ({star_method_count}/{count}) - use more consistently"
            )
            recommendations.append("Practice structuring all behavioral answers with STAR")
        else:
            improvements.append("Limited use of STAR method structure")
            recommendations.append("Learn and practice STAR method for behavioral questions")
        
        # Content quality
        if avg_content >= 70:
            strengths.append(f"High content quality ({int(avg_content)}/100) - specific and relevant")
        elif avg_content < 50:
            improvements.append(f"Content quality needs improvement ({int(avg_content)}/100)")
            recommendations.append("Include more specific examples and concrete details in answers")
        
        # Pauses
        if avg_pause <= 2:
            strengths.append("Smooth delivery with minimal pauses")
        elif avg_pause > 4:
            improvements.append(
                f"Frequent pauses ({avg_pause:.1f} avg) - may indicate nervousness"
            )
            recommendations.append("Prepare mental outlines before answering to reduce pauses")
        
        # Build comprehensive fallback report
        detailed_report = {
            "overall_score": overall_score,
            "percentile": calculate_percentile(overall_score, 'overall'),
            "category_scores": [
                {
                    "name": "Communication",
                    "score": comm_score,
                    "percentile": calculate_percentile(comm_score, 'communication')
                },
                {"name": "Content Quality", "score": content_score},
                {
                    "name": "Technical" if technical_responses else "Domain Knowledge",
                    "score": tech_score
                },
                {"name": "Behavioral", "score": behavioral_score},
            ],
            "strengths": strengths if strengths else ["Completed the interview successfully"],
            "areas_for_improvement": (
                improvements if improvements else ["Continue practicing to refine skills"]
            ),
            "detailed_breakdown": {
                "communication": {
                    "score": comm_score,
                    "avg_pace": f"{int(avg_wpm)} wpm",
                    "ideal_pace": "120-150 wpm",
                    "avg_fillers_per_answer": f"{avg_fillers_per_answer:.1f}",
                    "avg_pauses": f"{avg_pause:.1f}",
                    "benchmark": "< 3 fillers/answer ideal"
                },
                "content": {
                    "score": content_score,
                    "avg_words_per_answer": int(avg_words_per_answer),
                    "star_method_usage": f"{star_method_count}/{count} answers ({star_percentage:.0f}%)",
                    "avg_quality_score": f"{int(avg_content)}/100",
                    "sentiment": (
                        "Positive" if avg_sentiment > 0.2 
                        else "Neutral" if avg_sentiment > -0.2 
                        else "Needs work"
                    )
                },
                "grammar": {
                    "score": max(0, 100 - (len(all_grammar_errors) * 5)),
                    "total_issues": len(all_grammar_errors),
                    "top_issues": list(set(all_grammar_errors))[:5] if all_grammar_errors else []
                }
            },
            "key_metrics": {
                "total_questions": count,
                "avg_answer_length": f"{int(avg_words_per_answer)} words",
                "speaking_pace": f"{int(avg_wpm)} wpm",
                "filler_frequency": f"{avg_fillers_per_answer:.1f} per answer",
                "star_usage": f"{star_percentage:.0f}%",
                "content_quality": f"{int(avg_content)}/100"
            },
            "recommendations": recommendations if recommendations else [
                "Practice common interview questions daily",
                "Record yourself and review for improvement areas",
                "Use STAR method for behavioral questions"
            ],
            "next_steps": [
                {
                    "title": "Review Detailed Feedback",
                    "action": "Study question-by-question analysis",
                    "priority": "High"
                },
                {
                    "title": "Practice Weak Areas",
                    "action": (
                        f"Focus on: {', '.join(improvements[:2])}" 
                        if improvements else "Continue practicing"
                    ),
                    "priority": "High"
                },
                {
                    "title": "Next Mock Interview",
                    "action": "Schedule another practice session",
                    "priority": "Medium"
                },
                {
                    "title": "Learn STAR Method",
                    "action": "Master structured answer technique",
                    "priority": "Medium" if star_percentage < 60 else "Low"
                }
            ],
            "key_insights": (
                f"You completed {count} questions with an overall score of {overall_score}/100. "
                f"{'Your strengths include: ' + strengths[0] if strengths else 'Keep practicing to build confidence.'}"
            ),
            "progress_note": (
                "Remember: Every interview is practice. You're building skills that will serve you "
                "throughout your career. Keep going! 💪"
            ),
            "comparison": {
                "your_score": overall_score,
                "average_score": 65,
                "top_10_percent": 85,
                "message": (
                    "Above average!" if overall_score > 65 
                    else "Good progress" if overall_score > 50 
                    else "Keep practicing - improvement takes time"
                )
            }
        }
        
        session.feedback_report = detailed_report
        session.save()
        
        print(f"[SUCCESS] Generated fallback final report - Overall: {overall_score}/100, "
              f"Comm: {comm_score}, Content: {content_score}")
        return detailed_report

# ============================================================================
# INTERVIEW ENGINE CLASS - Add this at the very end of services.py
# ============================================================================

class InterviewEngine:
    """
    Main interview engine that wraps ResumeParserService methods.
    This class is used by views.py to handle all interview operations.
    """
    
    @staticmethod
    def parse_resume(file_path):
        """Parse resume PDF and extract structured data"""
        return ResumeParserService.parse_resume(file_path)
    
    @staticmethod
    def generate_questions(resume_data, position, difficulty="Medium", 
                          dialect="American English", experience_level="0-2 years"):
        """Generate personalized interview questions"""
        return ResumeParserService.generate_questions(
            position=position,
            resume_data=resume_data,
            difficulty=difficulty,
            experience_level=experience_level
        )
    
    @staticmethod
    def generate_followup_question(session, prev_question, prev_answer, voice_metrics=None):
        """Generate adaptive follow-up question"""
        return ResumeParserService.generate_followup_question(
            session=session,
            prev_question=prev_question,
            prev_answer=prev_answer,
            voice_metrics=voice_metrics
        )
    
    @staticmethod
    def analyze_response(question_text, user_transcript, fluency_metrics):
        """Analyze interview response and provide feedback"""
        return ResumeParserService.analyze_response(
            question_text=question_text,
            user_transcript=user_transcript,
            fluency_metrics=fluency_metrics
        )
    
    @staticmethod
    def generate_final_report(session_id):
        """Generate comprehensive final interview report"""
        return ResumeParserService.generate_final_report(session_id)