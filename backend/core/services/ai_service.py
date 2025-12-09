"""
AI Service Module - Handles all AI provider integrations.
Supports: Groq, Cerebras, Gemini, OpenRouter, Bytez, OpenAI, Perplexity.
"""
import os
import time
import random
import json
import concurrent.futures
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

from django.conf import settings

import logging
logger = logging.getLogger(__name__)

# AI PROVIDER INITIALIZATION

# Try to import LanguageTool for grammar checking (works offline, no API needed)
try:
    import language_tool_python
    GRAMMAR_TOOL = language_tool_python.LanguageTool('en-US')
    HAS_GRAMMAR_TOOL = True
    print("[OK] LanguageTool initialized for grammar checking")
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


# Try to import Gemini
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
    print("WARNING: google.generativeai could not be imported. Using mock services.")
except Exception as e:
    HAS_GEMINI = False
    genai = None
    print(f"WARNING: Gemini configuration failed: {e}. Using mock services.")

# Try to import OpenAI
try:
    from openai import OpenAI
    if settings.OPENAI_API_KEY:
        OPENAI_CLIENT = OpenAI(api_key=settings.OPENAI_API_KEY)
        HAS_OPENAI = True
        print("[OK] OpenAI initialized")
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
        print("[OK] Perplexity initialized")
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
        print("[OK] Groq initialized (FAST, 1000 req/day)")
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
        print("[OK] Cerebras initialized (14,400 req/day)")
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
        print("[OK] OpenRouter initialized (primary)")
    
    # Initialize fallback client if available
    openrouter_fallback_key = getattr(settings, 'OPENROUTER_API_KEY_FALLBACK', None) or os.getenv('OPENROUTER_API_KEY_FALLBACK')
    if openrouter_fallback_key:
        OPENROUTER_CLIENT_FALLBACK = OpenAI(
            api_key=openrouter_fallback_key,
            base_url="https://openrouter.ai/api/v1"
        )
        HAS_OPENROUTER_FALLBACK = True
        print("[OK] OpenRouter fallback initialized")
except Exception as e:
    print(f"WARNING: OpenRouter not available: {e}")

# Gemini fallback API key
GEMINI_API_KEY_FALLBACK = getattr(settings, 'GEMINI_API_KEY_FALLBACK', None) or os.getenv('GEMINI_API_KEY_FALLBACK')
if GEMINI_API_KEY_FALLBACK:
    print("[OK] Gemini fallback key configured")

# Bytez Configuration
try:
    from bytez import Bytez
    if settings.BYTEZ_API_KEY:
        BYTEZ_CLIENT = Bytez(settings.BYTEZ_API_KEY)
        HAS_BYTEZ = True
        print("[OK] Bytez initialized")
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

# AI CALL FUNCTIONS

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
            # Use first allowed host or fallback to localhost for dev
            referer_host = getattr(settings, 'ALLOWED_HOSTS', ['localhost'])[0] if getattr(settings, 'ALLOWED_HOSTS', None) else 'localhost:8000'
            if referer_host == '*':
                referer_host = 'localhost:8000'
            response = client.chat.completions.create(
                model="google/gemini-2.0-flash-exp:free",
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=2000,
                extra_headers={
                    "HTTP-Referer": f"http://{referer_host}",
                    "X-Title": "InterviewIQ",
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
