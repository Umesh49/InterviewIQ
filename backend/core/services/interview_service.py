"""
Interview Service Module - Core interview business logic.
Contains ResumeParserService and InterviewEngine classes.
"""
import json
import logging
from pdfminer.high_level import extract_text

from .ai_service import (
    call_ai, log_ai_failure, check_grammar,
    HAS_GEMINI, HAS_OPENAI, HAS_PERPLEXITY, HAS_OPENROUTER, HAS_BYTEZ
)
from .helper_functions import (
    progressive_question_order, detect_star_method, calculate_content_quality,
    validate_and_normalize_metrics, calculate_percentile
)

logger = logging.getLogger(__name__)


class ResumeParserService:
    """Handles resume parsing and interview question generation."""
    
    @staticmethod
    def parse_resume(file_path):
        """Extracts text from PDF and uses AI to structure it."""
        logger.info("=" * 80)
        logger.info("RESUME PARSING STARTED")
        logger.info(f"File path: {file_path}")
        
        try:
            logger.info("Step 1: Extracting text from PDF...")
            raw_text = extract_text(file_path)
            text_length = len(raw_text)
            logger.info(f"Extracted {text_length} characters from PDF")
            
            if text_length < 100:
                logger.warning(f"PDF text is very short ({text_length} chars)")
            
            if not (HAS_GEMINI or HAS_OPENAI or HAS_PERPLEXITY or HAS_OPENROUTER or HAS_BYTEZ):
                logger.warning("NO AI PROVIDERS AVAILABLE - Using mock data")
                return {
                    "skills": ["Python", "Django", "React (Mock)"],
                    "experience_years": 2,
                    "projects": [{"name": "Mock Project", "description": "Sample"}],
                    "experience": [{"title": "Developer", "company": "Mock Corp"}],
                    "education": [{"degree": "CS", "institution": "Mock University"}],
                    "strengths": ["Communication"],
                    "areas_for_growth": ["Public speaking"]
                }

            logger.info("Step 2: Sending to AI for parsing...")
            
            prompt = f"""You are an expert resume parser. Analyze this resume and extract structured information.

RESUME TEXT:
{raw_text[:10000]}

Extract in JSON format:
{{
"skills": ["skill1", "skill2"],
"experience_years": <integer>,
"projects": [{{"name": "Name", "description": "Brief", "technologies": ["tech1"]}}],
"experience": [{{"title": "Title", "company": "Company", "duration": "2020-2022"}}],
"education": [{{"degree": "Degree", "institution": "School", "graduation_year": "2020"}}],
"certifications": ["cert1"],
"strengths": ["strength1"],
"areas_for_growth": ["area1"]
}}

Return ONLY valid JSON."""
            
            response_text = call_ai(prompt, temperature=0.3)
            
            if response_text:
                logger.info("AI response received")
                json_str = response_text.replace('```json', '').replace('```', '').strip()
                parsed_data = json.loads(json_str)
                
                parsed_data.setdefault('skills', [])
                parsed_data.setdefault('projects', [])
                parsed_data.setdefault('experience', [])
                parsed_data.setdefault('education', [])
                parsed_data.setdefault('experience_years', 0)
                
                logger.info("RESUME PARSING SUCCESSFUL")
                logger.info(f"Skills: {len(parsed_data.get('skills', []))}")
                return parsed_data
            else:
                logger.error("AI returned no response")
                log_ai_failure('resume_parsing')
                
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing failed: {e}")
            log_ai_failure('resume_parsing', e)
        except Exception as e:
            logger.error(f"Resume parsing failed: {e}")
            log_ai_failure('resume_parsing', e)
        
        logger.warning("Using fallback mock data")
        return {
            "skills": ["Communication", "Problem Solving"],
            "experience_years": 1, "projects": [], "experience": [],
            "education": [], "strengths": ["Adaptability"],
            "areas_for_growth": ["Technical depth"]
        }

    @staticmethod
    def generate_questions(position, resume_data, difficulty="Medium", 
                          experience_level="0-2 years", excluded_questions=None):
        """Generates personalized interview questions using AI."""
        excluded_questions = excluded_questions or []
        
        skills = resume_data.get('skills', [])
        projects = resume_data.get('projects', [])
        experience_years = resume_data.get('experience_years', 0)
        
        has_any_ai = HAS_GEMINI or HAS_OPENAI or HAS_PERPLEXITY or HAS_OPENROUTER or HAS_BYTEZ
        print(f"[AI Status] Gemini: {HAS_GEMINI}, OpenRouter: {HAS_OPENROUTER}, "
              f"OpenAI: {HAS_OPENAI}, Perplexity: {HAS_PERPLEXITY}, Bytez: {HAS_BYTEZ}")
        
        excluded_text = ""
        if excluded_questions:
            recent = excluded_questions[:20]
            excluded_text = "\n\n**DO NOT ASK THESE (ALREADY ASKED):**\n" + \
                           "\n".join([f"- {q}" for q in recent])
        
        skills_list = ', '.join(skills[:10]) if skills else 'general skills'
        
        import uuid
        session_seed = str(uuid.uuid4())[:8]
        
        prompt = f"""You are an expert interviewer for a {difficulty} level {position} interview.
{excluded_text}

CANDIDATE: {experience_level} ({experience_years} years), Skills: {skills_list}
Session: {session_seed}

Generate 12-14 UNIQUE interview questions:
- Phase 1 (Q1-4): Intro/warmup
- Phase 2 (Q5-9): Technical deep-dive on their skills
- Phase 3 (Q10-14): Behavioral STAR questions

CRITICAL: Each question MUST be different. Do NOT ask the same thing twice in different words.
- NO duplicate questions
- NO rephrasing of the same question
- Each question should cover a DIFFERENT topic or skill

Output JSON array:
[{{"text": "Question?", "category": "Intro|Technical|Behavioral|Project", "difficulty": "Easy|Medium|Hard"}}]"""

        if has_any_ai:
            response_text = call_ai(prompt, temperature=0.9)  # Lower temperature for more consistent output
            if response_text:
                try:
                    json_str = response_text.replace('```json', '').replace('```', '').strip()
                    questions = json.loads(json_str)
                    
                    validated = []
                    for q in questions:
                        if isinstance(q, dict) and 'text' in q:
                            validated.append({
                                'text': q['text'],
                                'category': q.get('category', 'Technical'),
                                'difficulty': q.get('difficulty', difficulty)
                            })
                    
                    if len(validated) >= 10:
                        print(f"[SUCCESS] Generated {len(validated)} AI questions")
                        return progressive_question_order(validated[:15], experience_level)
                        
                except Exception as e:
                    print(f"[ERROR] Failed to parse AI questions: {e}")
                    log_ai_failure('question_generation', e)
        
        # Fallback questions
        logger.info("Using fallback questions")
        fallback = [
            {"text": "Tell me about yourself.", "category": "Intro", "difficulty": "Easy"},
            {"text": f"What interests you about {position}?", "category": "Intro", "difficulty": "Easy"},
            {"text": "Walk me through your resume.", "category": "Intro", "difficulty": "Easy"},
            {"text": "Describe a challenging situation you handled.", "category": "Behavioral", "difficulty": "Medium"},
            {"text": "Tell me about a time you worked with a difficult team member.", "category": "Behavioral", "difficulty": "Medium"},
            {"text": "What's your greatest achievement?", "category": "Behavioral", "difficulty": "Easy"},
            {"text": "Where do you see yourself in 5 years?", "category": "Behavioral", "difficulty": "Easy"},
            {"text": "Describe a time you failed and what you learned.", "category": "Behavioral", "difficulty": "Medium"},
        ]
        
        for skill in skills[:3]:
            skill_str = str(skill) if not isinstance(skill, dict) else skill.get('name', 'this skill')
            fallback.append({
                "text": f"How have you used {skill_str}? Give an example.",
                "category": "Technical", "difficulty": difficulty
            })
        
        return progressive_question_order(fallback, experience_level)

    @staticmethod
    def analyze_response(question_text, user_transcript, fluency_metrics):
        """Provides detailed coaching feedback using AI."""
        fluency_metrics = validate_and_normalize_metrics(fluency_metrics, user_transcript)
        
        voice = fluency_metrics.get('voiceMetrics', {})
        wpm = voice.get('words_per_minute', 0)
        word_count = voice.get('word_count', 0)
        filler_words = voice.get('filler_words', {})
        total_fillers = sum(filler_words.values()) if filler_words else 0
        
        used_star, star_score = detect_star_method(user_transcript)
        content_quality = calculate_content_quality(question_text, user_transcript)
        grammar_errors = check_grammar(user_transcript)
        
        if HAS_GEMINI or HAS_OPENAI or HAS_PERPLEXITY or HAS_OPENROUTER:
            prompt = f"""You are a SENIOR ENGINEERING MANAGER. Provide honest feedback.

Question: "{question_text}"
Answer: "{user_transcript}"
Duration: {word_count} words, {wpm} wpm, {total_fillers} fillers

Provide JSON:
{{
  "is_answer_correct": true/false,
  "correctness_feedback": "Direct correction",
  "strengths": ["Quote specific phrases that were good"],
  "weaknesses": ["Quote vague phrases, missing concepts"],
  "feedback_text": "2-3 sentences of direct advice",
  "improvement_tips": ["Actionable tip 1", "Actionable tip 2"],
  "recommended_resources": [{{"title": "Video", "url": "https://youtube.com/...", "topic": "Topic"}}]
}}"""
            
            ai_response = call_ai(prompt, temperature=0.7)
            if ai_response:
                try:
                    json_str = ai_response.replace('```json', '').replace('```', '').strip()
                    ai_analysis = json.loads(json_str)
                    
                    return {
                        "is_answer_correct": ai_analysis.get('is_answer_correct', True),
                        "correctness_feedback": ai_analysis.get('correctness_feedback', ''),
                        "strengths": ai_analysis.get('strengths', [])[:3],
                        "weaknesses": ai_analysis.get('weaknesses', [])[:3],
                        "feedback_text": ai_analysis.get('feedback_text', ''),
                        "improvement_tips": ai_analysis.get('improvement_tips', [])[:2],
                        "recommended_resources": ai_analysis.get('recommended_resources', [])[:2],
                        "sentiment_score": 0.7 if used_star else 0.5,
                        "star_method_used": used_star,
                        "content_quality_score": content_quality,
                        "grammar_errors": [e['message'] for e in grammar_errors]
                    }
                except Exception as e:
                    print(f"[ERROR] AI Parsing failed: {e}")
                    log_ai_failure('response_analysis', e)

        return {
            "is_answer_correct": True,
            "feedback_text": "AI unavailable. Check metrics.",
            "strengths": ["Clear audio"], "weaknesses": ["Analysis unavailable"],
            "improvement_tips": ["Check connection"], "recommended_resources": [],
            "grammar_errors": [], "sentiment_score": 0.5,
            "star_method_used": used_star, "content_quality_score": content_quality
        }

    @staticmethod
    def generate_final_report(session_id):
        """Generates comprehensive interview performance report."""
        from ..models import InterviewSession
        
        try:
            session = InterviewSession.objects.get(id=session_id)
        except Exception as e:
            return {"error": f"Session not found: {e}"}
        
        responses = []
        for q in session.questions.all():
            responses.extend(q.responses.all())

        if not responses:
            return {"error": "No responses found."}

        count = len(responses)
        total_fluency = sum(r.fluency_score for r in responses)
        total_sentiment = sum(r.sentiment_score for r in responses)
        
        # Aggregate voice metrics
        total_wpm = 0
        total_fillers = 0
        total_words = 0
        star_count = 0
        content_scores = []
        grammar_errors = []
        
        for resp in responses:
            meta = resp.body_language_metadata or {}
            voice = meta.get('voiceMetrics', {})
            total_wpm += voice.get('words_per_minute', 0)
            fillers = voice.get('filler_words', {})
            total_fillers += sum(fillers.values()) if fillers else 0
            total_words += voice.get('word_count', 0)
            if meta.get('star_method_used'): star_count += 1
            if 'content_quality_score' in meta:
                content_scores.append(meta['content_quality_score'])
            if resp.grammar_errors:
                grammar_errors.extend(resp.grammar_errors)

        avg_fluency = total_fluency / count
        avg_sentiment = total_sentiment / count
        avg_wpm = total_wpm / count
        avg_fillers = total_fillers / count
        avg_words = total_words / count
        avg_content = sum(content_scores) / len(content_scores) if content_scores else 50
        star_pct = (star_count / count) * 100

        # Calculate scores
        pace_score = 100 if 100 <= avg_wpm <= 150 else max(0, 100 - abs(avg_wpm - 125) * 0.8)
        filler_penalty = min(50, avg_fillers * 12)
        comm_score = int((pace_score * 0.5) + ((100 - filler_penalty) * 0.3) + (avg_fluency * 20))
        comm_score = max(0, min(100, comm_score))
        
        depth_score = min(100, avg_words * 1.5)
        sentiment_adj = (avg_sentiment * 50) + 50
        content_score = int((avg_content * 0.5) + (depth_score * 0.3) + (sentiment_adj * 0.2))
        content_score = max(0, min(100, content_score))
        
        overall = int((comm_score * 0.5) + (content_score * 0.5))
        overall = max(0, min(100, overall))

        report = {
            "overall_score": overall,
            "percentile": calculate_percentile(overall),
            "category_scores": [
                {"name": "Communication", "score": comm_score},
                {"name": "Content Quality", "score": content_score},
            ],
            "strengths": [],
            "areas_for_improvement": [],
            "key_metrics": {
                "total_questions": count,
                "avg_words": int(avg_words),
                "speaking_pace": f"{int(avg_wpm)} wpm",
                "star_usage": f"{star_pct:.0f}%"
            },
            "recommendations": ["Practice STAR method", "Track filler words"],
            "progress_note": "Keep practicing - you're improving!"
        }
        
        # Generate strengths/improvements
        if avg_wpm >= 100 and avg_wpm <= 150:
            report["strengths"].append(f"Good pace ({int(avg_wpm)} wpm)")
        if avg_fillers <= 2:
            report["strengths"].append("Minimal filler words")
        if star_pct >= 50:
            report["strengths"].append(f"Good STAR usage ({star_pct:.0f}%)")
        
        if avg_words < 40:
            report["areas_for_improvement"].append("Answers too brief")
        if avg_fillers > 3:
            report["areas_for_improvement"].append(f"High filler count ({avg_fillers:.1f}/answer)")
        if star_pct < 30:
            report["areas_for_improvement"].append("Use STAR method more")
        
        session.feedback_report = report
        session.overall_score = overall
        session.save()
        
        print(f"[SUCCESS] Generated report - Overall: {overall}/100")
        return report


class InterviewEngine:
    """Main interview engine that wraps ResumeParserService methods."""
    
    @staticmethod
    def parse_resume(file_path):
        return ResumeParserService.parse_resume(file_path)
    
    @staticmethod
    def generate_questions(resume_data, position, difficulty="Medium", 
                          dialect="American English", experience_level="0-2 years",
                          excluded_questions=None):
        return ResumeParserService.generate_questions(
            position=position, resume_data=resume_data, difficulty=difficulty,
            experience_level=experience_level, excluded_questions=excluded_questions
        )
    
    @staticmethod
    def analyze_response(question_text, user_transcript, fluency_metrics):
        return ResumeParserService.analyze_response(
            question_text=question_text, user_transcript=user_transcript,
            fluency_metrics=fluency_metrics
        )
    
    @staticmethod
    def generate_final_report(session_id):
        return ResumeParserService.generate_final_report(session_id)
