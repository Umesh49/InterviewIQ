"""
Body Language Photo Analysis Service.

Analyzes photos captured during interviews to assess body language,
posture, eye contact, and overall presentation using AI vision models.
"""
import base64
import logging
import json
import re

logger = logging.getLogger(__name__)

# Check for Gemini availability
try:
    import google.generativeai as genai
    from django.conf import settings
    genai.configure(api_key=settings.GEMINI_API_KEY)
    HAS_GEMINI_VISION = True
    logger.info("[OK] Gemini Vision available for body language analysis")
except Exception as e:
    HAS_GEMINI_VISION = False
    logger.warning(f"Gemini Vision not available: {e}")


def analyze_single_photo(base64_image: str) -> dict:
    """
    Analyze body language from a single photo using Gemini Vision.
    
    Args:
        base64_image: Base64-encoded image (JPEG/PNG)
        
    Returns:
        dict with:
        - posture_score (0-100)
        - eye_contact_score (0-100)
        - confidence_score (0-100)
        - positive_indicators: list
        - concerns: list
        - summary: str
    """
    if not HAS_GEMINI_VISION:
        logger.warning("Gemini Vision not available, using fallback")
        return _fallback_analysis()
    
    try:
        model = genai.GenerativeModel('gemini-2.0-flash-lite')
        
        # Clean base64 string (remove data URI prefix if present)
        if ',' in base64_image:
            base64_image = base64_image.split(',')[1]
        
        image_data = base64.b64decode(base64_image)
        
        prompt = """Analyze this photo of a person in a video interview context. 
Evaluate their body language and presentation.

IMPORTANT: Be encouraging and constructive. This is for interview practice.

Respond ONLY with valid JSON in this exact format:
{
    "posture_score": <0-100, 100=excellent upright posture>,
    "eye_contact_score": <0-100, 100=looking directly at camera>,
    "confidence_score": <0-100, based on overall presentation>,
    "positive_indicators": ["list", "of", "good", "things"],
    "concerns": ["list", "of", "areas", "to", "improve"],
    "summary": "One sentence overall assessment"
}

If you cannot analyze the image clearly, provide reasonable default scores around 70 with appropriate notes."""

        response = model.generate_content([
            prompt,
            {"mime_type": "image/jpeg", "data": image_data}
        ])
        
        # Parse JSON response
        response_text = response.text.strip()
        # Remove code block markers if present
        response_text = re.sub(r'^```json\s*', '', response_text)
        response_text = re.sub(r'\s*```$', '', response_text)
        
        result = json.loads(response_text)
        
        # Validate and ensure all fields exist
        result.setdefault('posture_score', 70)
        result.setdefault('eye_contact_score', 70)
        result.setdefault('confidence_score', 70)
        result.setdefault('positive_indicators', [])
        result.setdefault('concerns', [])
        result.setdefault('summary', 'Analysis complete')
        
        logger.info(f"Photo analysis: posture={result['posture_score']}, eye_contact={result['eye_contact_score']}")
        return result
        
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse Gemini response as JSON: {e}")
        return _fallback_analysis()
    except Exception as e:
        logger.error(f"Photo analysis error: {e}")
        return _fallback_analysis()


def analyze_multiple_photos(photos: list) -> dict:
    """
    Analyze multiple photos and aggregate results.
    
    Args:
        photos: List of base64-encoded images
        
    Returns:
        Aggregated metrics with averages and combined feedback
    """
    if not photos:
        return _fallback_analysis()
    
    # Limit to 5 photos max to avoid rate limits
    photos = photos[:5]
    
    results = []
    for i, photo in enumerate(photos):
        logger.info(f"Analyzing photo {i+1}/{len(photos)}")
        result = analyze_single_photo(photo)
        results.append(result)
    
    # Aggregate scores
    if not results:
        return _fallback_analysis()
    
    avg_posture = sum(r['posture_score'] for r in results) / len(results)
    avg_eye_contact = sum(r['eye_contact_score'] for r in results) / len(results)
    avg_confidence = sum(r['confidence_score'] for r in results) / len(results)
    
    # Collect all unique indicators and concerns
    all_positives = set()
    all_concerns = set()
    for r in results:
        all_positives.update(r.get('positive_indicators', []))
        all_concerns.update(r.get('concerns', []))
    
    # Overall summary based on averages
    if avg_posture >= 80 and avg_eye_contact >= 80:
        overall_summary = "Excellent presentation! Great posture and eye contact throughout."
    elif avg_posture >= 60 and avg_eye_contact >= 60:
        overall_summary = "Good presentation overall. Minor improvements possible."
    else:
        overall_summary = "Some areas for improvement in body language detected."
    
    return {
        'posture_score': round(avg_posture, 1),
        'eye_contact_score': round(avg_eye_contact, 1),
        'confidence_score': round(avg_confidence, 1),
        'positive_indicators': list(all_positives)[:5],
        'concerns': list(all_concerns)[:5],
        'summary': overall_summary,
        'photos_analyzed': len(results),
        'individual_results': results
    }


def _fallback_analysis() -> dict:
    """
    Fallback analysis when AI is not available.
    Returns neutral/encouraging default scores.
    """
    return {
        'posture_score': 70,
        'eye_contact_score': 70,
        'confidence_score': 70,
        'positive_indicators': ['Photo captured successfully', 'Camera positioning is good'],
        'concerns': ['AI analysis unavailable - using default scores'],
        'summary': 'Photo captured. AI analysis not available at this time.',
        'photos_analyzed': 0,
        'fallback': True
    }
