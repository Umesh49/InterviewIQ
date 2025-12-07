import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Mic, MicOff, CheckCircle, XCircle } from 'lucide-react';

/**
 * Audio Test Page
 * 
 * Tests Text-to-Speech (TTS) and Speech-to-Text (STT) independently.
 * Use this to verify browser audio APIs work before integrating into Interview.
 */

const AudioTest = () => {
    // TTS State
    const [ttsSupported, setTtsSupported] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [ttsText, setTtsText] = useState("Hello! This is a test of the text to speech system. Can you hear me clearly?");

    // STT State
    const [sttSupported, setSttSupported] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [sttError, setSttError] = useState('');

    const recognitionRef = useRef(null);

    // Check browser support on mount
    useEffect(() => {
        // Check TTS support
        if ('speechSynthesis' in window) {
            setTtsSupported(true);
        }

        // Check STT support
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            setSttSupported(true);
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event) => {
                let interimText = '';
                let finalText = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const text = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalText += text + ' ';
                    } else {
                        interimText += text;
                    }
                }

                // Update final transcript (accumulates)
                if (finalText) {
                    setTranscript(prev => prev + finalText);
                }

                // Update interim transcript (shows current words being spoken)
                setInterimTranscript(interimText);
            };

            recognition.onerror = (event) => {
                console.error('[STT Error]:', event.error);
                setSttError(event.error);
                setIsListening(false);
            };

            recognition.onend = () => {
                console.log('[STT] Recognition ended');
                setIsListening(false);
            };

            recognitionRef.current = recognition;
        }

        return () => {
            window.speechSynthesis?.cancel();
            recognitionRef.current?.stop();
        };
    }, []);

    // ==================== TTS Functions ====================

    const handleSpeak = () => {
        if (!ttsSupported || !ttsText.trim()) return;

        window.speechSynthesis.cancel(); // Stop any previous speech
        const utterance = new SpeechSynthesisUtterance(ttsText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        utterance.onstart = () => {
            console.log('[TTS] Started speaking');
            setIsSpeaking(true);
        };

        utterance.onend = () => {
            console.log('[TTS] Finished speaking');
            setIsSpeaking(false);
        };

        utterance.onerror = (event) => {
            console.error('[TTS Error]:', event.error);
            setIsSpeaking(false);
        };

        window.speechSynthesis.speak(utterance);
    };

    const handleStopSpeaking = () => {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
    };

    // ==================== STT Functions ====================

    const handleStartListening = () => {
        if (!sttSupported || !recognitionRef.current) return;

        setTranscript('');
        setInterimTranscript('');
        setSttError('');

        try {
            recognitionRef.current.start();
            setIsListening(true);
            console.log('[STT] Started listening');
        } catch (e) {
            console.error('[STT] Start error:', e);
            setSttError(e.message);
        }
    };

    const handleStopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsListening(false);
    };

    // ==================== Render ====================

    return (
        <div className="min-h-screen bg-dark-900 text-white p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold mb-8 text-center">🔊 Audio Test Page</h1>
                <p className="text-gray-400 text-center mb-12">
                    Test Text-to-Speech and Speech-to-Text independently before using in interview.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* TTS Section */}
                    <div className="glass-panel p-6">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Volume2 className="text-blue-400" />
                            Text-to-Speech (TTS)
                        </h2>

                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-sm text-gray-400">Browser Support:</span>
                            {ttsSupported ? (
                                <span className="flex items-center gap-1 text-green-400">
                                    <CheckCircle size={16} /> Supported
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-red-400">
                                    <XCircle size={16} /> Not Supported
                                </span>
                            )}
                        </div>

                        <textarea
                            value={ttsText}
                            onChange={(e) => setTtsText(e.target.value)}
                            className="w-full h-32 p-3 bg-dark-800 border border-gray-700 rounded-lg mb-4 text-white resize-none"
                            placeholder="Enter text to speak..."
                        />

                        <div className="flex gap-4">
                            <button
                                onClick={handleSpeak}
                                disabled={!ttsSupported || isSpeaking}
                                className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 
                                    ${isSpeaking ? 'bg-blue-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-500'}
                                    disabled:bg-gray-600 disabled:cursor-not-allowed`}
                            >
                                <Volume2 size={20} />
                                {isSpeaking ? 'Speaking...' : 'Speak Text'}
                            </button>

                            {isSpeaking && (
                                <button
                                    onClick={handleStopSpeaking}
                                    className="px-4 py-3 bg-red-600 hover:bg-red-500 rounded-lg"
                                >
                                    Stop
                                </button>
                            )}
                        </div>
                    </div>

                    {/* STT Section */}
                    <div className="glass-panel p-6">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Mic className="text-green-400" />
                            Speech-to-Text (STT)
                        </h2>

                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-sm text-gray-400">Browser Support:</span>
                            {sttSupported ? (
                                <span className="flex items-center gap-1 text-green-400">
                                    <CheckCircle size={16} /> Supported
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-red-400">
                                    <XCircle size={16} /> Not Supported
                                </span>
                            )}
                        </div>

                        <div className="w-full h-32 p-3 bg-dark-800 border border-gray-700 rounded-lg mb-4 overflow-auto">
                            {(transcript || interimTranscript) ? (
                                <p className="text-white">
                                    {transcript}
                                    <span className="text-gray-400 italic">{interimTranscript}</span>
                                </p>
                            ) : (
                                <p className="text-gray-500 italic">
                                    {isListening ? 'Listening... speak now!' : 'Click "Start Listening" and speak'}
                                </p>
                            )}
                        </div>

                        {sttError && (
                            <div className="text-red-400 text-sm mb-4">
                                Error: {sttError}
                            </div>
                        )}

                        <div className="flex gap-4">
                            {!isListening ? (
                                <button
                                    onClick={handleStartListening}
                                    disabled={!sttSupported}
                                    className="flex-1 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold flex items-center justify-center gap-2"
                                >
                                    <Mic size={20} />
                                    Start Listening
                                </button>
                            ) : (
                                <button
                                    onClick={handleStopListening}
                                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-lg font-bold flex items-center justify-center gap-2 animate-pulse"
                                >
                                    <MicOff size={20} />
                                    Stop Listening
                                </button>
                            )}

                            <button
                                onClick={() => setTranscript('')}
                                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                </div>

                {/* Instructions */}
                <div className="mt-12 glass-panel p-6">
                    <h3 className="text-xl font-bold mb-4">📋 Testing Instructions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-300">
                        <div>
                            <h4 className="font-semibold text-white mb-2">TTS Test:</h4>
                            <ol className="list-decimal pl-5 space-y-1">
                                <li>Click "Speak Text" button</li>
                                <li>You should hear the text spoken aloud</li>
                                <li>Check console for [TTS] logs</li>
                            </ol>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-2">STT Test:</h4>
                            <ol className="list-decimal pl-5 space-y-1">
                                <li>Click "Start Listening" button</li>
                                <li>Speak clearly into your microphone</li>
                                <li>Watch transcript appear in real-time</li>
                                <li>Click "Stop Listening" when done</li>
                            </ol>
                        </div>
                    </div>
                </div>

                {/* Back Link */}
                <div className="mt-8 text-center">
                    <a href="/" className="text-primary-400 hover:underline">
                        ← Back to Dashboard
                    </a>
                </div>
            </div>
        </div>
    );
};

export default AudioTest;
