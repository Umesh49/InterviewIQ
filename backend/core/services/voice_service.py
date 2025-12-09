import os
import logging
from deepgram import DeepgramClient

logger = logging.getLogger(__name__)

class VoiceService:
    def __init__(self):
        self.api_key = os.getenv('DEEPGRAM_API_KEY')
        if not self.api_key:
            logger.warning("DEEPGRAM_API_KEY is not set in environment variables.")
        
        # Initialize with specific options if needed, here just API Key
        # The SDK can also pull from env DEEPGRAM_API_KEY automatically if passed nothing,
        # but passing explicitly is safer if we loaded it.
        self.client = DeepgramClient(api_key=self.api_key)

    def generate_speech(self, text, model="aura-asteria-en"):
        """
        Generates audio from text using Deepgram's Aura TTS.
        Returns the audio bytes.
        """
        try:
            # Using syntax from documentation:
            # response = client.speak.v1.audio.generate(text="...")
            # We add model as a parameter if supported, assuming similar to v2 listen options.
            # If strictly following the snippet: client.speak.v1.audio.generate(text=text)
            
            # Correct SDK Path based on introspection: client.speak.v1.audio.generate
            # Signature enforces keyword arguments: (*, text: str, model: Union[...] = None, ...)
            
            response = self.client.speak.v1.audio.generate(
                text=text,
                model=model
            )
            
            # The signature says it returns Iterator[bytes]
            # Verify if it is a simple iterator or object
            try:
                # If it's a generator/iterator of bytes, this consumes it into a single bytes object
                return b"".join(response)
            except TypeError:
                # Fallback if it turns out to be an object with .content (though signature says Iterator)
                if hasattr(response, 'stream'):
                    return response.stream.getvalue()
                elif hasattr(response, 'content'):
                    return response.content
                else:
                    return response

        except Exception as e:
            logger.error(f"Deepgram TTS Error: {str(e)}")
            raise