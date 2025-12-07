import { useRef, useState, useCallback } from 'react';

/**
 * Custom hook for Deepgram real-time speech-to-text
 * Uses WebSocket for streaming transcription with Indian English support
 */
const useDeepgram = () => {
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState(null);

    const socketRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);

    // Tech term corrections for common misrecognitions
    const correctTechTerms = (text) => {
        const corrections = {
            'tango': 'Django',
            'jungle': 'Django',
            'jango': 'Django',
            'd jango': 'Django',
            'react js': 'React.js',
            'no js': 'Node.js',
            'node js': 'Node.js',
            'pie chart': 'PyTorch',
            'pie torch': 'PyTorch',
            'tensor flow': 'TensorFlow',
            'post grass': 'PostgreSQL',
            'post gress': 'PostgreSQL',
            'postgres sequel': 'PostgreSQL',
            'mongo db': 'MongoDB',
            'my sequel': 'MySQL',
            'css 3': 'CSS3',
            'html 5': 'HTML5',
            'jason': 'JSON',
            'ci cd': 'CI/CD',
            'dev ops': 'DevOps',
            'star method': 'STAR method'
        };

        let correctedText = text;
        Object.entries(corrections).forEach(([wrong, right]) => {
            const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
            correctedText = correctedText.replace(regex, right);
        });
        return correctedText;
    };

    const startListening = useCallback(async () => {
        try {
            setError(null);
            setTranscript('');
            setInterimTranscript('');

            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            streamRef.current = stream;

            // Connect to Deepgram WebSocket
            const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
            if (!apiKey) {
                throw new Error('Deepgram API key not found');
            }

            // Deepgram real-time endpoint with Indian English model
            const socket = new WebSocket(
                `wss://api.deepgram.com/v1/listen?` +
                `encoding=linear16&sample_rate=16000&channels=1&` +
                `language=en-IN&` +  // Indian English
                `model=nova-2&` +     // Latest model
                `smart_format=true&` +
                `punctuate=true&` +
                `interim_results=true&` +
                `endpointing=300&` +  // Faster response
                `keywords=Django:5,React:5,Python:5,Node.js:5,PostgreSQL:5,MongoDB:5,TensorFlow:5,PyTorch:5,API:5,DevOps:5`, // Boost tech terms
                ['token', apiKey]
            );

            socket.onopen = () => {
                console.log('[Deepgram] Connected');
                setIsListening(true);

                // Create MediaRecorder for audio capture
                const mediaRecorder = new MediaRecorder(stream, {
                    mimeType: 'audio/webm;codecs=opus'
                });

                mediaRecorder.ondataavailable = async (event) => {
                    if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                        // Convert to raw audio and send
                        const arrayBuffer = await event.data.arrayBuffer();
                        socket.send(arrayBuffer);
                    }
                };

                mediaRecorder.start(250); // Send chunks every 250ms
                mediaRecorderRef.current = mediaRecorder;
            };

            socket.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.channel?.alternatives?.[0]) {
                    const result = data.channel.alternatives[0];
                    const text = result.transcript || '';

                    if (text) {
                        const correctedText = correctTechTerms(text);

                        if (data.is_final) {
                            // Final result - add to transcript
                            setTranscript(prev => prev + correctedText + ' ');
                            setInterimTranscript('');
                            console.log('[Deepgram] Final:', correctedText);
                        } else {
                            // Interim result - show as preview
                            setInterimTranscript(correctedText);
                        }
                    }
                }
            };

            socket.onerror = (event) => {
                console.error('[Deepgram] WebSocket error:', event);
                setError('Connection error. Falling back to browser STT.');
            };

            socket.onclose = (event) => {
                console.log('[Deepgram] Disconnected:', event.code, event.reason);
                setIsListening(false);
            };

            socketRef.current = socket;

        } catch (err) {
            console.error('[Deepgram] Start error:', err);
            setError(err.message);
            setIsListening(false);
        }
    }, []);

    const stopListening = useCallback(() => {
        // Stop MediaRecorder
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }

        // Close WebSocket
        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
        }

        // Stop microphone stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        setIsListening(false);
        setInterimTranscript('');
    }, []);

    const resetTranscript = useCallback(() => {
        setTranscript('');
        setInterimTranscript('');
    }, []);

    return {
        transcript,
        interimTranscript,
        isListening,
        error,
        startListening,
        stopListening,
        resetTranscript,
        setTranscript  // Allow external updates
    };
};

export default useDeepgram;
