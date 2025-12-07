import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { startInterview, submitResponse } from '../services/api';
import useMediaPipe from '../hooks/useMediaPipe';
import useDeepgram from '../hooks/useDeepgram';
import { Volume2, Mic, CheckCircle, Play, ArrowRight } from 'lucide-react';

/**
 * Interview Page - Complete Version
 * 
 * Features:
 * - TTS: Reads questions aloud (Deepgram Aura or browser)
 * - STT: Deepgram for Indian accent support, fallback to Web Speech API
 * - Voice Metrics: Tracks pauses, speaking pace, filler words, volume
 * - Camera: Uses MediaPipe for body language
 */

const Interview = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const videoRef = useRef(null);

    // Deepgram STT Hook
    const {
        transcript: deepgramTranscript,
        interimTranscript: deepgramInterim,
        isListening: deepgramListening,
        error: deepgramError,
        startListening: startDeepgram,
        stopListening: stopDeepgram,
        resetTranscript: resetDeepgram
    } = useDeepgram();

    // Core State
    const [questions, setQuestions] = useState([]);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [error, setError] = useState(null);
    const [useDeepgramSTT, setUseDeepgramSTT] = useState(true); // Try Deepgram first

    // Transcript State (for fallback Web Speech API)
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const recognitionRef = useRef(null);

    // Voice Metrics State
    const [voiceMetrics, setVoiceMetrics] = useState({
        speakingDuration: 0,
        pauseCount: 0,
        longestPause: 0,
        avgVolume: 0,
        fillerWords: {}
    });
    const voiceMetricsRef = useRef({
        startTime: null,
        lastSpeechTime: null,
        pauseCount: 0,
        longestPause: 0,
        volumeSamples: [],
        isSpeaking: false
    });

    // Audio Analysis Refs
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationFrameRef = useRef(null);
    const isRecordingRef = useRef(false);  // To avoid stale closure in analyzeAudio
    const isSubmittingRef = useRef(false);  // To prevent double submits (React StrictMode)

    // MediaPipe for body language
    const { metrics, issueLog } = useMediaPipe(videoRef, isRecording);
    const metricsBuffer = useRef({ eyeContact: [], posture: [], fidget: [], gaze: [] });

    // ==================== INITIALIZATION ====================

    useEffect(() => {
        const init = async () => {
            try {
                const data = await startInterview(sessionId);
                if (data.questions) {
                    setQuestions(data.questions);
                }
            } catch (e) {
                console.error('Failed to load interview:', e);
                setError('Failed to load interview. Please refresh.');
            }
        };
        init();

        // Setup Speech Recognition
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-IN';  // Indian English for better accent recognition
            recognition.maxAlternatives = 3;  // Get multiple alternatives for better accuracy

            // Add grammar hints for technical terms (if supported)
            if ('webkitSpeechGrammarList' in window || 'SpeechGrammarList' in window) {
                const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
                const grammarList = new SpeechGrammarList();

                // Technical terms that are commonly misrecognized
                const techTerms = [
                    'Django', 'React', 'Angular', 'Vue', 'Node', 'Python', 'JavaScript', 'TypeScript',
                    'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'Azure',
                    'API', 'REST', 'GraphQL', 'JSON', 'HTML', 'CSS', 'SASS', 'Tailwind',
                    'Git', 'GitHub', 'CI CD', 'DevOps', 'Agile', 'Scrum', 'Jira',
                    'Flask', 'FastAPI', 'Express', 'Spring', 'Laravel', 'Rails',
                    'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Scikit', 'Machine Learning',
                    'STAR method', 'algorithm', 'data structure', 'OOP', 'functional programming'
                ];

                const grammar = `#JSGF V1.0; grammar techterms; public <techterm> = ${techTerms.join(' | ')};`;
                grammarList.addFromString(grammar, 1);
                recognition.grammars = grammarList;
            }

            // Common misrecognition corrections
            const correctTechTerms = (text) => {
                const corrections = {
                    'tango': 'Django',
                    'jungle': 'Django',
                    'jango': 'Django',
                    'react js': 'React.js',
                    'no js': 'Node.js',
                    'node js': 'Node.js',
                    'pie chart': 'PyTorch',
                    'pie torch': 'PyTorch',
                    'tensor flow': 'TensorFlow',
                    'post grass': 'PostgreSQL',
                    'post gress': 'PostgreSQL',
                    'mongo db': 'MongoDB',
                    'my sequel': 'MySQL',
                    'css 3': 'CSS3',
                    'html 5': 'HTML5',
                    'jason': 'JSON',
                    'api': 'API',
                    'aws': 'AWS',
                    'ci cd': 'CI/CD',
                    'dev ops': 'DevOps',
                    'star method': 'STAR method',
                    'oop': 'OOP'
                };

                let correctedText = text;
                Object.entries(corrections).forEach(([wrong, right]) => {
                    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
                    correctedText = correctedText.replace(regex, right);
                });
                return correctedText;
            };

            recognition.onresult = (event) => {
                let interim = '';
                let final = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const text = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        // Apply tech term corrections to final transcript
                        final += correctTechTerms(text) + ' ';
                    } else {
                        interim += text;
                    }
                }

                if (final) {
                    setTranscript(prev => prev + final);
                    // Update voice metrics - mark that we're speaking
                    voiceMetricsRef.current.lastSpeechTime = Date.now();
                    voiceMetricsRef.current.isSpeaking = true;
                }
                setInterimTranscript(interim);
            };

            recognition.onerror = (e) => console.warn('STT Error:', e.error);
            recognition.onend = () => {
                // Restart if still recording
                if (isRecording && recognitionRef.current) {
                    try { recognitionRef.current.start(); } catch (e) { }
                }
            };

            recognitionRef.current = recognition;
        }

        return () => {
            window.speechSynthesis?.cancel();
            recognitionRef.current?.stop();
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [sessionId]);

    // Timer effect
    useEffect(() => {
        let interval;
        if (isRecording) {
            interval = setInterval(() => setElapsedTime(p => p + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    // Collect body language metrics
    useEffect(() => {
        if (isRecording && metrics) {
            metricsBuffer.current.eyeContact.push(metrics.eyeContact);
            metricsBuffer.current.posture.push(metrics.posture === 'Good' ? 1 : 0);
            metricsBuffer.current.fidget.push(metrics.fidgetScore);
            metricsBuffer.current.gaze.push(metrics.gazeDirection);
        }
    }, [metrics, isRecording]);

    // ==================== AUDIO ANALYSIS ====================

    const initAudioAnalysis = async () => {
        if (audioContextRef.current) return;

        try {
            // Get dedicated microphone stream for accurate audio analysis
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;  // More frequency bins for better resolution
            analyser.smoothingTimeConstant = 0.3;  // Less smoothing for more responsive detection

            const source = audioCtx.createMediaStreamSource(micStream);
            source.connect(analyser);

            audioContextRef.current = audioCtx;
            analyserRef.current = analyser;
            console.log('[Audio] Microphone AudioContext initialized');
        } catch (e) {
            console.error('[Audio] Init error:', e);
            // Fallback to camera stream if available
            const fallbackStream = videoRef.current?.srcObject;
            if (fallbackStream) {
                try {
                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const analyser = audioCtx.createAnalyser();
                    analyser.fftSize = 256;
                    const source = audioCtx.createMediaStreamSource(fallbackStream);
                    source.connect(analyser);
                    audioContextRef.current = audioCtx;
                    analyserRef.current = analyser;
                    console.log('[Audio] Fallback to camera stream');
                } catch (e2) {
                    console.error('[Audio] Fallback also failed:', e2);
                }
            }
        }
    };

    const startVoiceAnalysis = () => {
        voiceMetricsRef.current = {
            startTime: Date.now(),
            lastSpeechTime: Date.now(),
            lastSilenceStart: null,
            pauseCount: 0,
            longestPause: 0,
            volumeSamples: [],
            isSpeaking: false
        };

        const analyzeAudio = () => {
            if (!analyserRef.current || !isRecordingRef.current) return;

            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);

            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            const normalizedVolume = average / 128; // 0-1 range

            // Track volume samples
            voiceMetricsRef.current.volumeSamples.push(normalizedVolume);

            // More sensitive detection
            const now = Date.now();
            const SPEECH_THRESHOLD = 0.08;  // Slightly higher for clearer speech detection
            const PAUSE_THRESHOLD = 1500;    // 1.5 seconds counts as a pause

            // Debug: Log volume every 100 samples
            if (voiceMetricsRef.current.volumeSamples.length % 100 === 0) {
                console.log('[Audio Debug] Volume:', normalizedVolume.toFixed(3),
                    '| Speaking:', voiceMetricsRef.current.isSpeaking,
                    '| Pauses:', voiceMetricsRef.current.pauseCount);
            }

            if (normalizedVolume > SPEECH_THRESHOLD) {
                // User is speaking
                if (!voiceMetricsRef.current.isSpeaking && voiceMetricsRef.current.lastSilenceStart) {
                    // Coming out of silence - check if it was a pause
                    const silenceDuration = now - voiceMetricsRef.current.lastSilenceStart;
                    if (silenceDuration > PAUSE_THRESHOLD) {
                        voiceMetricsRef.current.pauseCount++;
                        console.log('[Audio] Pause detected!', silenceDuration, 'ms');
                        if (silenceDuration > voiceMetricsRef.current.longestPause) {
                            voiceMetricsRef.current.longestPause = silenceDuration;
                        }
                    }
                }
                voiceMetricsRef.current.isSpeaking = true;
                voiceMetricsRef.current.lastSpeechTime = now;
                voiceMetricsRef.current.lastSilenceStart = null;
            } else {
                // Silence
                if (voiceMetricsRef.current.isSpeaking && !voiceMetricsRef.current.lastSilenceStart) {
                    // Just started being silent after speaking
                    voiceMetricsRef.current.lastSilenceStart = now;
                }
                voiceMetricsRef.current.isSpeaking = false;
            }

            animationFrameRef.current = requestAnimationFrame(analyzeAudio);
        };

        analyzeAudio();
    };

    const calculateFillerWords = (text) => {
        const fillers = ['um', 'uh', 'like', 'you know', 'actually', 'basically', 'sort of', 'kind of'];
        const counts = {};
        const lowerText = text.toLowerCase();

        fillers.forEach(filler => {
            const regex = new RegExp(`\\b${filler}\\b`, 'gi');
            const matches = lowerText.match(regex);
            if (matches) counts[filler] = matches.length;
        });

        return counts;
    };

    // ==================== HANDLERS ====================

    const handleStartInterview = async () => {
        setHasStarted(true);
        await initAudioAnalysis();

        // Resume AudioContext (requires user gesture)
        if (audioContextRef.current?.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        speakAndRecord(questions[currentQIndex]?.text);
    };

    const speakAndRecord = async (text) => {
        if (!text) return;
        
        // Try Deepgram Aura TTS first for better quality
        const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
        if (apiKey) {
            setIsSpeaking(true);
            try {
                // Note: aura-asteria-en is a clear female voice
                // Other options: aura-orion-en (male), aura-luna-en (female)
                const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-asteria-en', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Token ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ text })
                });

                if (response.ok) {
                    const audioBlob = await response.blob();
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);
                    
                    audio.onended = () => {
                        setIsSpeaking(false);
                        URL.revokeObjectURL(audioUrl);
                        setTimeout(() => startRecording(), 500);
                    };
                    
                    audio.onerror = () => {
                        console.warn('[TTS] Audio playback failed, using browser TTS');
                        setIsSpeaking(false);
                        browserSpeak(text);
                    };
                    
                    await audio.play();
                    return;
                }
            } catch (e) {
                console.warn('[TTS] Deepgram Aura failed:', e);
                setIsSpeaking(false);
            }
        }
        
        // Fallback to browser TTS
        browserSpeak(text);
    };

    const browserSpeak = (text) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.95;
            setIsSpeaking(true);

            utterance.onend = () => {
                setIsSpeaking(false);
                setTimeout(() => startRecording(), 500);
            };

            window.speechSynthesis.speak(utterance);
        } else {
            startRecording();
        }
    };

    const startRecording = async () => {
        setIsRecording(true);
        isRecordingRef.current = true;  // Set ref for analyzeAudio loop
        setElapsedTime(0);
        setTranscript('');
        setInterimTranscript('');
        metricsBuffer.current = { eyeContact: [], posture: [], fidget: [], gaze: [] };

        // Try Deepgram first for better Indian accent support
        if (useDeepgramSTT) {
            try {
                resetDeepgram();
                await startDeepgram();
                console.log('[STT] Using Deepgram (Indian English)');
            } catch (e) {
                console.warn('[STT] Deepgram failed, falling back to Web Speech API:', e);
                setUseDeepgramSTT(false);
                // Start Web Speech API as fallback
                if (recognitionRef.current) {
                    try { recognitionRef.current.start(); } catch (e2) { }
                }
            }
        } else {
            // Web Speech API fallback
            if (recognitionRef.current) {
                try { recognitionRef.current.start(); } catch (e) { }
            }
        }

        // Start voice analysis (for metrics)
        startVoiceAnalysis();
    };

    const handleSubmit = async () => {
        // Double-guard: check both state and ref to prevent duplicate submits
        if (isSubmitting || isSubmittingRef.current) return;

        setIsSubmitting(true);
        isSubmittingRef.current = true;
        setIsRecording(false);
        isRecordingRef.current = false;  // Stop analyzeAudio loop

        // Stop STT - both Deepgram and Web Speech API
        if (useDeepgramSTT) {
            stopDeepgram();
        }
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (e) { }
        }

        // Stop audio analysis
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        // Get final transcript from whichever STT was used
        const finalTranscript = (useDeepgramSTT ? deepgramTranscript : transcript).trim();
        const speakingDuration = (Date.now() - voiceMetricsRef.current.startTime) / 1000;
        const wordCount = finalTranscript.split(/\s+/).filter(w => w).length;
        const wordsPerMinute = speakingDuration > 0 ? Math.round((wordCount / speakingDuration) * 60) : 0;
        const avgVolume = voiceMetricsRef.current.volumeSamples.length > 0
            ? voiceMetricsRef.current.volumeSamples.reduce((a, b) => a + b, 0) / voiceMetricsRef.current.volumeSamples.length
            : 0;
        const fillerWords = calculateFillerWords(finalTranscript);

        const voiceData = {
            speaking_duration_seconds: Math.round(speakingDuration),
            pause_count: voiceMetricsRef.current.pauseCount,
            longest_pause_seconds: Math.round(voiceMetricsRef.current.longestPause / 1000 * 10) / 10,
            words_per_minute: wordsPerMinute,
            word_count: wordCount,
            filler_words: fillerWords,
            average_volume: Math.round(avgVolume * 100) / 100
        };

        console.log('[Voice Metrics]', voiceData);

        // Calculate body language metrics
        const count = metricsBuffer.current.eyeContact.length || 1;
        const avgEye = metricsBuffer.current.eyeContact.reduce((a, b) => a + b, 0) / count;
        const avgPosture = metricsBuffer.current.posture.reduce((a, b) => a + b, 0) / count;
        const avgFidget = metricsBuffer.current.fidget.reduce((a, b) => a + b, 0) / count;
        const gazeCounts = metricsBuffer.current.gaze.reduce((acc, curr) => {
            acc[curr] = (acc[curr] || 0) + 1;
            return acc;
        }, {});

        const currentQuestion = questions[currentQIndex];
        if (!currentQuestion) return;

        try {
            const data = await submitResponse(
                sessionId,
                currentQuestion.id,
                finalTranscript,
                null,
                {
                    eyeContact: avgEye,
                    posture: avgPosture > 0.8 ? 'Good' : 'Leaning',
                    fidgetScore: avgFidget,
                    gazeDistribution: gazeCounts,
                    voiceMetrics: voiceData
                },
                issueLog
            );

            if (data.new_question) {
                setQuestions(prev => [...prev, data.new_question]);
            }

            setIsSubmitting(false);
            isSubmittingRef.current = false;

            if (currentQIndex < questions.length - 1 || data.new_question) {
                setCurrentQIndex(prev => prev + 1);
            } else {
                navigate(`/result/${sessionId}`);
            }
        } catch (e) {
            console.error('Submit error:', e);
            setIsSubmitting(false);
            isSubmittingRef.current = false;
            alert('Failed to submit. Please try again.');
        }
    };

    // Auto-advance to next question
    useEffect(() => {
        if (hasStarted && currentQIndex > 0 && questions[currentQIndex]) {
            speakAndRecord(questions[currentQIndex].text);
        }
    }, [currentQIndex]);

    // ==================== HELPERS ====================

    const formatTime = (s) => {
        const mins = Math.floor(s / 60).toString().padStart(2, '0');
        const secs = (s % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    // ==================== RENDER ====================

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-dark-900 text-red-500 gap-4 p-8 text-center">
                <h2 className="text-2xl font-bold">Error</h2>
                <p className="text-lg text-gray-300">{error}</p>
                <button onClick={() => window.location.reload()} className="px-6 py-2 bg-gray-800 rounded-lg text-white hover:bg-gray-700">
                    Refresh Page
                </button>
            </div>
        );
    }

    if (questions.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-dark-900">
                <div className="text-xl text-primary-400 font-semibold animate-pulse">Loading Interview...</div>
            </div>
        );
    }

    const currentQuestion = questions[currentQIndex];
    const activeTranscript = useDeepgramSTT ? deepgramTranscript : transcript;
    const activeInterim = useDeepgramSTT ? deepgramInterim : interimTranscript;

    // Deepgram Aura TTS with Indian accent
    const speakWithDeepgram = async (text) => {
        if (!text) return;
        
        const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
        if (!apiKey) {
            // Fallback to browser TTS
            fallbackSpeak(text);
            return;
        }

        setIsSpeaking(true);
        
        try {
            const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-asteria-en', {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text })
            });

            if (!response.ok) {
                throw new Error('Deepgram TTS failed');
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            audio.onended = () => {
                setIsSpeaking(false);
                URL.revokeObjectURL(audioUrl);
                setTimeout(() => startRecording(), 500);
            };
            
            audio.onerror = () => {
                setIsSpeaking(false);
                fallbackSpeak(text);
            };
            
            await audio.play();
        } catch (e) {
            console.warn('[TTS] Deepgram Aura failed, using browser TTS:', e);
            setIsSpeaking(false);
            fallbackSpeak(text);
        }
    };

    const fallbackSpeak = (text) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.95;
            setIsSpeaking(true);

            utterance.onend = () => {
                setIsSpeaking(false);
                setTimeout(() => startRecording(), 500);
            };

            window.speechSynthesis.speak(utterance);
        } else {
            startRecording();
        }
    };

    return (
        <div className="min-h-screen bg-dark-900 flex relative overflow-hidden">
            {/* Camera Background - Full screen behind everything */}
            <div className="absolute inset-0 z-0">
                <video
                    ref={videoRef}
                    className={`w-full h-full object-cover ${!hasStarted ? 'opacity-20 blur-md' : 'opacity-30'} transition-all transform scale-x-[-1]`}
                    autoPlay muted playsInline
                />
            </div>

            {/* Start Overlay */}
            {!hasStarted && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
                    <button
                        onClick={handleStartInterview}
                        className="group relative px-12 py-6 bg-white text-black rounded-full font-bold text-2xl hover:bg-gray-100 transition-all hover:scale-105 shadow-2xl flex items-center gap-4"
                    >
                        <Play fill="currentColor" size={32} />
                        <span>Start Interview</span>
                    </button>
                    <p className="mt-6 text-gray-400">Click to enable audio & begin</p>
                </div>
            )}

            {/* Main Content Area - Left Side */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8">
                {/* Question Counter */}
                <div className="mb-4 text-gray-400 text-sm">
                    Question {currentQIndex + 1} of {questions.length}
                </div>

                {/* AI Avatar */}
                <div className={`mb-6 w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all ${isSpeaking ? 'bg-primary-500 animate-pulse scale-110' : 'bg-gray-800/80'}`}>
                    {isSpeaking ? <Volume2 className="w-8 h-8 text-white" /> : <div className="text-2xl">🤖</div>}
                </div>

                {/* Question Text */}
                <h2 className="text-xl md:text-3xl font-bold text-white mb-8 leading-tight drop-shadow-lg text-center max-w-2xl">
                    {currentQuestion?.text}
                </h2>

                {/* Status Indicator */}
                <div className="mb-6">
                    {isSpeaking ? (
                        <p className="text-primary-300 animate-pulse text-lg">🎤 AI is reading the question...</p>
                    ) : isRecording ? (
                        <div className="flex items-center gap-3">
                            <div className="px-4 py-2 bg-red-600 rounded-full flex items-center gap-2 shadow-lg">
                                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                                <span className="text-white font-mono font-bold">REC {formatTime(elapsedTime)}</span>
                            </div>
                            <span className="text-xs text-gray-500">
                                {useDeepgramSTT ? '🎯 Deepgram' : '🌐 Browser'}
                            </span>
                        </div>
                    ) : isSubmitting ? (
                        <div className="flex items-center gap-2 text-green-400 font-bold animate-pulse">
                            <ArrowRight size={20} /> Processing...
                        </div>
                    ) : null}
                </div>

                {/* Submit Button */}
                {isRecording && (
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-8 py-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white text-lg font-bold rounded-full shadow-xl transition-all hover:scale-105 flex items-center gap-2"
                    >
                        <CheckCircle size={24} />
                        Submit Answer
                    </button>
                )}
            </div>

            {/* Right Side Panel - Live Transcript */}
            {hasStarted && (
                <div className="relative z-10 w-80 lg:w-96 bg-dark-800/95 border-l border-gray-700 flex flex-col h-screen">
                    {/* Panel Header */}
                    <div className="p-4 border-b border-gray-700 bg-dark-900/50">
                        <div className="flex items-center gap-2">
                            <Mic className="w-5 h-5 text-primary-400" />
                            <h3 className="font-semibold text-white">Your Response</h3>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Live transcription</p>
                    </div>

                    {/* Transcript Content */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {activeTranscript || activeInterim ? (
                            <div className="space-y-2">
                                <p className="text-white leading-relaxed">
                                    {activeTranscript}
                                    <span className="text-gray-400 italic">{activeInterim}</span>
                                    {isRecording && <span className="animate-pulse text-primary-400">|</span>}
                                </p>
                            </div>
                        ) : isRecording ? (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <div className="w-16 h-16 rounded-full bg-dark-700 flex items-center justify-center mb-4">
                                    <Mic className="w-8 h-8 text-gray-500" />
                                </div>
                                <p className="text-gray-500 text-sm">Start speaking...</p>
                                <p className="text-gray-600 text-xs mt-2">Your words will appear here</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <p className="text-gray-500 text-sm">Waiting for recording...</p>
                            </div>
                        )}
                    </div>

                    {/* Panel Footer - Stats */}
                    {activeTranscript && (
                        <div className="p-4 border-t border-gray-700 bg-dark-900/50">
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div>
                                    <p className="text-xs text-gray-500">Words</p>
                                    <p className="text-lg font-bold text-white">
                                        {activeTranscript.split(/\s+/).filter(w => w).length}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Time</p>
                                    <p className="text-lg font-bold text-white">{formatTime(elapsedTime)}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Interview;
