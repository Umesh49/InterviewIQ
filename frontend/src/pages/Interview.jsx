import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api, { startInterview, submitResponse } from '../services/api';
import useMediaPipe from '../hooks/useMediaPipe';
import useDeepgram from '../hooks/useDeepgram';
import { Volume2, Mic, CheckCircle, Play, ArrowRight } from 'lucide-react';
import Loading from '../components/Loading';

const Interview = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const videoRef = useRef(null);

    // Deepgram STT Hook
    // Deepgram STT Handler
    const handleDeepgramTranscript = (data) => {
        if (data.transcript && data.transcript.trim()) {
            voiceMetricsRef.current.lastSpeechTime = Date.now();
            voiceMetricsRef.current.isSpeaking = true;
        }
    };

    const {
        transcript: deepgramTranscript,
        interimTranscript: deepgramInterim,
        isListening: deepgramListening,
        error: deepgramError,
        startListening: startDeepgram,
        stopListening: stopDeepgram,
        resetTranscript: resetDeepgram
    } = useDeepgram({ onTranscript: handleDeepgramTranscript });

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
    const [audioLevel, setAudioLevel] = useState(0); // 0-100 audio level for wave animation
    const [needsResume, setNeedsResume] = useState(false); // True when session restored but needs user click

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

                    // Restore progress from sessionStorage if available
                    const savedIndex = sessionStorage.getItem(`interview_${sessionId}_index`);
                    const savedStarted = sessionStorage.getItem(`interview_${sessionId}_started`);

                    if (savedIndex !== null) {
                        const index = parseInt(savedIndex, 10);
                        if (index >= 0 && index < data.questions.length) {
                            setCurrentQIndex(index);
                            console.log('[Session] Restored to question', index + 1);
                        }
                    }
                    // If session was started before refresh, show resume button instead of auto-starting
                    // This is needed because browser blocks autoplay without user gesture
                    if (savedStarted === 'true') {
                        setNeedsResume(true);
                        console.log('[Session] Session needs resume (autoplay policy)');
                    }
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
            // Console log to see if we get ANY signal
            if (Date.now() % 1000 < 50) { // Log roughly once per second
                console.log(`[Audio Debug] Raw: ${average.toFixed(2)}, Norm: ${normalizedVolume.toFixed(3)}`);
            }

            // Update audio level for wave animation (0-100)
            setAudioLevel(Math.min(100, normalizedVolume * 150));

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

    const handleStartInterview = async () => {
        setHasStarted(true);
        // Save interview started state to sessionStorage
        sessionStorage.setItem(`interview_${sessionId}_started`, 'true');
        sessionStorage.setItem(`interview_${sessionId}_index`, currentQIndex.toString());

        await initAudioAnalysis();

        // Resume AudioContext (requires user gesture)
        if (audioContextRef.current?.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        speakAndRecord(questions[currentQIndex]?.text);
    };

    const speakAndRecord = async (text) => {
        if (!text) return;

        // Try Backend TTS first
        setIsSpeaking(true);
        try {
            // Using backend endpoint that wraps Deepgram Aura SDK
            const response = await api.post('/interviews/speak/', { text }, {
                responseType: 'blob' // Important: Expect a blob response
            });

            if (response.status === 200) {
                const audioBlob = response.data;
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
            console.warn('[TTS] Backend TTS failed:', e);
            setIsSpeaking(false);
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
                const nextIndex = currentQIndex + 1;
                setCurrentQIndex(nextIndex);
                // Save progress to sessionStorage
                sessionStorage.setItem(`interview_${sessionId}_index`, nextIndex.toString());
            } else {
                // Clear sessionStorage on completion
                sessionStorage.removeItem(`interview_${sessionId}_index`);
                sessionStorage.removeItem(`interview_${sessionId}_started`);
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
            <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-red-500 gap-4 p-8 text-center">
                <h2 className="text-2xl font-bold">Error</h2>
                <p className="text-lg text-gray-300">{error}</p>
                <button onClick={() => window.location.reload()} className="px-6 py-2 bg-gray-800 rounded-lg text-white hover:bg-gray-700">
                    Refresh Page
                </button>
            </div>
        );
    }

    if (questions.length === 0) {
        return <Loading />;
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
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex relative overflow-hidden">
            {/* Ambient Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[150px]" />
                <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[120px]" />
            </div>

            {/* Recording Indicator - Top Left */}
            {isRecording && (
                <div className="absolute top-4 left-4 z-50 px-4 py-2 bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-full flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-red-400 font-mono font-bold text-sm">{formatTime(elapsedTime)}</span>
                </div>
            )}

            {/* Camera Background - Subtle */}
            <div className="absolute inset-0 z-0">
                <video
                    ref={videoRef}
                    className={`w-full h-full object-cover ${!hasStarted ? 'opacity-10 blur-lg' : 'opacity-15'} transition-all transform scale-x-[-1]`}
                    autoPlay muted playsInline
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-zinc-950/80" />
            </div>

            {/* Start Overlay */}
            <AnimatePresence>
                {!hasStarted && !needsResume && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md px-4"
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                            className="text-center mb-6 sm:mb-8"
                        >
                            <motion.div
                                animate={{ y: [0, -8, 0] }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-blue-500/30"
                            >
                                <span className="text-white font-bold text-2xl sm:text-3xl">AI</span>
                            </motion.div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Ready to Begin?</h1>
                            <p className="text-zinc-400 text-sm sm:text-base">Your AI interviewer is waiting</p>
                        </motion.div>
                        <motion.button
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleStartInterview}
                            className="group relative px-8 sm:px-10 py-4 sm:py-5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl font-bold text-lg sm:text-xl shadow-2xl shadow-blue-500/30 flex items-center gap-3"
                        >
                            <Play fill="currentColor" size={24} />
                            <span>Start Interview</span>
                        </motion.button>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            className="mt-4 sm:mt-6 text-zinc-500 text-xs sm:text-sm"
                        >
                            Click to enable audio & begin
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Resume Overlay - Shows when session was refreshed */}
            <AnimatePresence>
                {needsResume && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md px-4"
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                            className="text-center mb-6 sm:mb-8"
                        >
                            <motion.div
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                                className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-2xl shadow-amber-500/30"
                            >
                                <span className="text-white font-bold text-2xl sm:text-3xl">{currentQIndex + 1}</span>
                            </motion.div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Session Restored</h1>
                            <p className="text-zinc-400 text-sm sm:text-base">Continue from Question {currentQIndex + 1}</p>
                        </motion.div>
                        <motion.button
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                setNeedsResume(false);
                                handleStartInterview();
                            }}
                            className="group relative px-8 sm:px-10 py-4 sm:py-5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl font-bold text-lg sm:text-xl shadow-2xl shadow-amber-500/30 flex items-center gap-3"
                        >
                            <Play fill="currentColor" size={24} />
                            <span>Resume Interview</span>
                        </motion.button>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            className="mt-4 sm:mt-6 text-zinc-500 text-xs sm:text-sm"
                        >
                            Click to continue where you left off
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content Area */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
                {/* Question Counter - Pill Style */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 sm:mb-6 px-3 sm:px-4 py-1.5 sm:py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-full"
                >
                    <span className="text-zinc-400 text-xs sm:text-sm font-medium">
                        Question <span className="text-white font-bold">{currentQIndex + 1}</span> of {questions.length}
                    </span>
                </motion.div>

                {/* AI Avatar - Enhanced */}
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                    className="relative mb-6 sm:mb-8"
                >
                    <motion.div
                        animate={isSpeaking ? { scale: [1, 1.05, 1] } : {}}
                        transition={{ duration: 0.5, repeat: Infinity }}
                        className={`w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 ${isSpeaking
                            ? 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-blue-500/40'
                            : 'bg-zinc-800/80 border border-zinc-700/50'
                            }`}
                    >
                        {isSpeaking ? (
                            <Volume2 className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                        ) : (
                            <span className="text-2xl sm:text-3xl">🤖</span>
                        )}
                    </motion.div>
                    {isSpeaking && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: [0.5, 0], scale: 1.3 }}
                            transition={{ duration: 1, repeat: Infinity }}
                            className="absolute -inset-2 rounded-2xl bg-blue-500/30"
                        />
                    )}
                </motion.div>

                {/* Question Text - Glassmorphic Card */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentQIndex}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.3 }}
                        className="max-w-2xl w-full mb-6 sm:mb-8 p-4 sm:p-6 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/50 rounded-2xl"
                    >
                        <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-semibold text-white leading-relaxed text-center">
                            {currentQuestion?.text}
                        </h2>
                    </motion.div>
                </AnimatePresence>

                {/* Status & Wave Visualization */}
                <div className="mb-8 min-h-[80px] flex flex-col items-center justify-center">
                    {isSpeaking ? (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="w-1 bg-blue-400 rounded-full animate-pulse"
                                        style={{
                                            height: `${20 + Math.random() * 20}px`,
                                            animationDelay: `${i * 0.1}s`,
                                            animationDuration: '0.5s'
                                        }}
                                    />
                                ))}
                            </div>
                            <p className="text-blue-300 font-medium">AI is reading...</p>
                        </div>
                    ) : isRecording ? (
                        <div className="flex flex-col items-center gap-4">
                            <div className="flex items-center gap-1 h-12">
                                {[...Array(12)].map((_, i) => {
                                    const waveOffset = Math.sin((Date.now() / 200) + i * 0.5);
                                    const baseHeight = 4;
                                    const dynamicHeight = audioLevel > 10
                                        ? baseHeight + (audioLevel * 0.4) + (waveOffset * audioLevel * 0.15)
                                        : baseHeight;
                                    return (
                                        <div
                                            key={i}
                                            className={`w-1.5 rounded-full transition-all duration-75 ${audioLevel > 10
                                                ? 'bg-gradient-to-t from-green-500 to-emerald-400'
                                                : 'bg-zinc-600'
                                                }`}
                                            style={{ height: `${Math.max(4, dynamicHeight)}px` }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ) : isSubmitting ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-3 text-emerald-400 font-bold"
                        >
                            <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                            Processing your answer...
                        </motion.div>
                    ) : null}
                </div>

                {/* Submit Button - Enhanced */}
                <AnimatePresence>
                    {isRecording && (
                        <motion.button
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="group px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 disabled:from-zinc-600 disabled:to-zinc-700 text-white text-base sm:text-lg font-bold rounded-2xl shadow-2xl shadow-emerald-500/30 flex items-center gap-2 sm:gap-3"
                        >
                            <CheckCircle size={20} className="sm:w-6 sm:h-6" />
                            <span className="hidden sm:inline">Submit Answer</span>
                            <span className="sm:hidden">Submit</span>
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* Right Side Panel - Live Transcript (Hidden on mobile) */}
            {hasStarted && (
                <motion.div
                    initial={{ x: 100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3, type: 'spring', stiffness: 100 }}
                    className="hidden md:flex relative z-10 w-72 lg:w-80 xl:w-96 bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-800/50 flex-col h-screen"
                >
                    {/* Panel Header */}
                    <div className="p-5 border-b border-zinc-800/50 bg-gradient-to-r from-zinc-900 to-zinc-800/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                <Mic className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Your Response</h3>
                                <p className="text-xs text-zinc-500">Live transcription</p>
                            </div>
                        </div>
                        {deepgramError && (
                            <div className="mt-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <p className="text-xs text-red-400 font-medium flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                                    {deepgramError}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Transcript Content */}
                    <div className="flex-1 overflow-y-auto p-5">
                        {activeTranscript || activeInterim ? (
                            <div className="space-y-2">
                                <p className="text-white leading-relaxed text-lg">
                                    {activeTranscript}
                                    <span className="text-zinc-500 italic">{activeInterim}</span>
                                    {isRecording && <span className="inline-block w-0.5 h-5 bg-blue-400 ml-1 animate-pulse" />}
                                </p>
                            </div>
                        ) : isRecording ? (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4">
                                    <Mic className="w-8 h-8 text-zinc-600" />
                                </div>
                                <p className="text-zinc-500">Start speaking...</p>
                                <p className="text-zinc-600 text-sm mt-2">Your words will appear here</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <p className="text-zinc-600">Waiting for recording...</p>
                            </div>
                        )}
                    </div>

                    {/* Panel Footer - Stats */}
                    {activeTranscript && (
                        <div className="p-5 border-t border-zinc-800/50 bg-gradient-to-r from-zinc-900 to-zinc-800/50">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-zinc-800/30 rounded-xl text-center">
                                    <p className="text-xs text-zinc-500 mb-1">Words</p>
                                    <p className="text-xl font-bold text-white">
                                        {activeTranscript.split(/\s+/).filter(w => w).length}
                                    </p>
                                </div>
                                <div className="p-3 bg-zinc-800/30 rounded-xl text-center">
                                    <p className="text-xs text-zinc-500 mb-1">Time</p>
                                    <p className="text-xl font-bold text-white">{formatTime(elapsedTime)}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            )}

            {/* CSS for wave animation */}
            <style>{`
                @keyframes wave {
                    0%, 100% { transform: scaleY(0.5); }
                    50% { transform: scaleY(1.2); }
                }
            `}</style>
        </div>
    );
};

export default Interview;
