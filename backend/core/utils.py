"""
Core Utilities - Input sanitization, API responses, and file validation.
"""
import re
import html
import mimetypes
import logging
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)

# INPUT SANITIZATION

def sanitize_text(text, max_length=10000, strip_html=True):
    """
    Sanitize user input text.
    - Strips leading/trailing whitespace
    - Optionally removes HTML tags
    - Escapes HTML entities
    - Limits length
    """
    if not text:
        return ""
    
    if not isinstance(text, str):
        text = str(text)
    
    # Strip whitespace
    text = text.strip()
    
    # Remove HTML tags if requested
    if strip_html:
        text = re.sub(r'<[^>]+>', '', text)
    
    # Escape HTML entities
    text = html.escape(text)
    
    # Limit length
    if len(text) > max_length:
        text = text[:max_length]
    
    return text

def sanitize_filename(filename):
    """
    Sanitize uploaded filename to prevent path traversal.
    Returns only the basename with safe characters.
    """
    if not filename:
        return "file"
    
    # Get basename only (prevent path traversal)
    import os
    filename = os.path.basename(filename)
    
    # Remove dangerous characters
    filename = re.sub(r'[^\w\s\-\.]', '', filename)
    
    # Limit length
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:250] + ext
    
    return filename or "file"

# STANDARD API RESPONSES

def success_response(data=None, message="Success", status_code=status.HTTP_200_OK):
    """
    Standard success response format.
    {success: true, message: str, data: any}
    """
    return Response({
        "success": True,
        "message": message,
        "data": data
    }, status=status_code)


def error_response(message="An error occurred", errors=None, status_code=status.HTTP_400_BAD_REQUEST):
    """
    Standard error response format.
    {success: false, message: str, errors: any}
    """
    return Response({
        "success": False,
        "message": message,
        "errors": errors
    }, status=status_code)


def validation_error_response(errors):
    """
    Validation error response for serializer errors.
    """
    return Response({
        "success": False,
        "message": "Validation failed",
        "errors": errors
    }, status=status.HTTP_400_BAD_REQUEST)

# FILE VALIDATION

# Allowed file types
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
ALLOWED_DOCUMENT_EXTENSIONS = {'.pdf', '.doc', '.docx'}
ALLOWED_AUDIO_EXTENSIONS = {'.mp3', '.wav', '.m4a', '.webm', '.ogg'}

# Max file sizes (in bytes)
MAX_IMAGE_SIZE = 2 * 1024 * 1024  # 2MB
MAX_DOCUMENT_SIZE = 5 * 1024 * 1024  # 5MB
MAX_AUDIO_SIZE = 10 * 1024 * 1024  # 10MB

# MIME type mappings
ALLOWED_MIMES = {
    '.pdf': ['application/pdf'],
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.png': ['image/png'],
    '.gif': ['image/gif'],
    '.webp': ['image/webp'],
    '.doc': ['application/msword'],
    '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    '.mp3': ['audio/mpeg', 'audio/mp3'],
    '.wav': ['audio/wav', 'audio/x-wav'],
    '.m4a': ['audio/mp4', 'audio/x-m4a'],
    '.webm': ['audio/webm', 'video/webm'],
    '.ogg': ['audio/ogg'],
}

def validate_file(file, file_type='document'):
    """
    Validate uploaded file for security.
    
    Args:
        file: Django UploadedFile object
        file_type: 'image', 'document', or 'audio'
    
    Returns:
        (is_valid: bool, error_message: str or None)
    """
    if not file:
        return False, "No file provided"
    
    # Get file info
    import os
    filename = file.name
    extension = os.path.splitext(filename)[1].lower()
    file_size = file.size
    
    # Check extension
    if file_type == 'image':
        allowed = ALLOWED_IMAGE_EXTENSIONS
        max_size = MAX_IMAGE_SIZE
    elif file_type == 'audio':
        allowed = ALLOWED_AUDIO_EXTENSIONS
        max_size = MAX_AUDIO_SIZE
    else:
        allowed = ALLOWED_DOCUMENT_EXTENSIONS
        max_size = MAX_DOCUMENT_SIZE
    
    if extension not in allowed:
        return False, f"Invalid file type. Allowed: {', '.join(allowed)}"
    
    # Check size
    if file_size > max_size:
        max_mb = max_size / (1024 * 1024)
        return False, f"File too large. Maximum: {max_mb:.1f}MB"
    
    # Check MIME type (read first bytes)
    try:
        mime_type, _ = mimetypes.guess_type(filename)
        
        # Also check file content magic bytes for common types
        file.seek(0)
        header = file.read(16)
        file.seek(0)
        
        # PDF check
        if extension == '.pdf':
            if not header.startswith(b'%PDF'):
                return False, "Invalid PDF file"
        
        # Image checks
        elif extension in {'.jpg', '.jpeg'}:
            if not (header.startswith(b'\xff\xd8\xff') or header.startswith(b'\xff\xd8')):
                return False, "Invalid JPEG file"
        
        elif extension == '.png':
            if not header.startswith(b'\x89PNG'):
                return False, "Invalid PNG file"
        
        elif extension == '.gif':
            if not header.startswith(b'GIF8'):
                return False, "Invalid GIF file"
        
    except Exception as e:
        logger.warning(f"MIME validation error: {e}")
        # Don't fail on MIME check errors, just log
    
    return True, None


def generate_safe_filename(original_filename, prefix="file"):
    """
    Generate a safe, unique filename using UUID.
    Preserves original extension.
    """
    import uuid
    import os
    
    extension = os.path.splitext(original_filename)[1].lower() if original_filename else ''
    
    # Only allow safe extensions
    safe_extensions = ALLOWED_IMAGE_EXTENSIONS | ALLOWED_DOCUMENT_EXTENSIONS | ALLOWED_AUDIO_EXTENSIONS
    if extension not in safe_extensions:
        extension = ''
    
    return f"{prefix}_{uuid.uuid4().hex[:12]}{extension}"

# CUSTOM EXCEPTION HANDLER

def custom_exception_handler(exc, context):
    """
    Custom DRF exception handler for consistent error responses.
    """
    from rest_framework.views import exception_handler
    from rest_framework.exceptions import (
        ValidationError, PermissionDenied, NotAuthenticated, NotFound
    )
    
    # Call DRF's default handler first
    response = exception_handler(exc, context)
    
    if response is not None:
        # Wrap in standard format
        if isinstance(exc, ValidationError):
            response.data = {
                "success": False,
                "message": "Validation error",
                "errors": response.data
            }
        elif isinstance(exc, (PermissionDenied, NotAuthenticated)):
            response.data = {
                "success": False,
                "message": str(exc.detail) if hasattr(exc, 'detail') else "Permission denied",
                "errors": None
            }
        elif isinstance(exc, NotFound):
            response.data = {
                "success": False,
                "message": "Resource not found",
                "errors": None
            }
        else:
            response.data = {
                "success": False,
                "message": str(exc.detail) if hasattr(exc, 'detail') else "An error occurred",
                "errors": response.data if response.data else None
            }
    else:
        # Unhandled exception - log it and return generic error
        logger.exception(f"Unhandled exception: {exc}")
        return Response({
            "success": False,
            "message": "An unexpected error occurred",
            "errors": None
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    return response
