import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, Mic, MicOff, CheckCircle, XCircle, AlertCircle, Play, Volume2, RefreshCw, Lightbulb, Sparkles } from 'lucide-react';

const InterviewSetup = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationRef = useRef(null);

    // Setup state
    const [cameraStatus, setCameraStatus] = useState('pending');
    const [micStatus, setMicStatus] = useState('pending');
    const [cameraError, setCameraError] = useState('');
    const [micError, setMicError] = useState('');
    const [audioLevel, setAudioLevel] = useState(0);
    const [isTesting, setIsTesting] = useState(false);
    const [speechTestResult, setSpeechTestResult] = useState('');
    const [allReady, setAllReady] = useState(false);
    const [cameraLabel, setCameraLabel] = useState('');
    const [micLabel, setMicLabel] = useState('');

    // Stream refs
    const videoStreamRef = useRef(null);
    const audioStreamRef = useRef(null);

    useEffect(() => {
        testDevices();
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (videoStreamRef.current) {
                videoStreamRef.current.getTracks().forEach(t => t.stop());
            }
            if (audioStreamRef.current) {
                audioStreamRef.current.getTracks().forEach(t => t.stop());
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
        };
    }, []);

    useEffect(() => {
        if (cameraStatus === 'success' && micStatus === 'success') {
            setAllReady(true);
        } else {
            setAllReady(false);
        }
    }, [cameraStatus, micStatus]);

    const testDevices = async () => {
        await testCamera();
        await testMicrophone();
    };

    const testCamera = async (retryMode = false) => {
        setCameraStatus('pending');
        setCameraError('');

        const constraints = retryMode ? { video: true } : { video: { width: 640, height: 480, facingMode: 'user' } };

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            videoStreamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                try {
                    await videoRef.current.play();
                } catch (e) {
                    if (e.name !== 'AbortError') console.error("Video play error:", e);
                }
            }

            const track = stream.getVideoTracks()[0];
            if (track) setCameraLabel(track.label);

            setCameraStatus('success');
        } catch (err) {
            console.error('Camera error:', err);

            if (!retryMode && (err.name === 'OverconstrainedError' || err.name === 'AbortError' || err.message.includes('Timeout'))) {
                console.log("Retrying camera with loose constraints...");
                testCamera(true);
                return;
            }

            setCameraStatus('error');
            if (err.name === 'NotAllowedError') {
                setCameraError('Camera access denied. Please allow camera access in your browser settings.');
            } else if (err.name === 'NotFoundError') {
                setCameraError('No camera found. Please connect a webcam.');
            } else {
                setCameraError(err.message || 'Failed to access camera');
            }
        }
    };

    const testMicrophone = async () => {
        setMicStatus('pending');
        setMicError('');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStreamRef.current = stream;

            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            source.connect(analyserRef.current);

            monitorAudioLevel();

            const track = stream.getAudioTracks()[0];
            if (track) setMicLabel(track.label);

            setMicStatus('success');
        } catch (err) {
            console.error('Microphone error:', err);
            setMicStatus('error');
            if (err.name === 'NotAllowedError') {
                setMicError('Microphone access denied. Please allow microphone access in your browser settings.');
            } else if (err.name === 'NotFoundError') {
                setMicError('No microphone found. Please connect a microphone.');
            } else {
                setMicError(err.message || 'Failed to access microphone');
            }
        }
    };

    const monitorAudioLevel = () => {
        if (!analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

        const updateLevel = () => {
            if (!analyserRef.current) return;

            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            setAudioLevel(Math.min(100, average * 1.5));

            animationRef.current = requestAnimationFrame(updateLevel);
        };

        updateLevel();
    };

    const testSpeechRecognition = async () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            setSpeechTestResult('⚠️ Speech recognition not supported. Please use Chrome browser.');
            return;
        }

        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }

        if (audioContextRef.current && audioContextRef.current.state === 'running') {
            await audioContextRef.current.suspend();
        }

        setIsTesting(true);
        setSpeechTestResult('🎤 Listening... Say "Hello testing" now!');

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        let hasResult = false;
        let interimTranscript = '';

        recognition.onresult = (event) => {
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                    hasResult = true;
                } else {
                    interimTranscript = transcript;
                    setSpeechTestResult(`🎤 Hearing: "${transcript}"...`);
                }
            }

            if (finalTranscript) {
                setSpeechTestResult(`✅ Speech works! Heard: "${finalTranscript}"`);
                recognition.stop();
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);

            if (event.error === 'no-speech') {
                setSpeechTestResult(`⚠️ No speech detected. Try speaking louder or check your microphone.`);
            } else if (event.error === 'audio-capture') {
                setSpeechTestResult('⚠️ No microphone found or mic in use by another app.');
            } else if (event.error === 'not-allowed') {
                setSpeechTestResult('⚠️ Microphone permission denied.');
            } else if (event.error === 'aborted') {
                // Silently ignore aborts
            } else {
                setSpeechTestResult(`❌ Error: ${event.error}`);
            }
        };

        recognition.onend = () => {
            setIsTesting(false);

            if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume().then(() => {
                    monitorAudioLevel();
                });
            }

            if (!hasResult && interimTranscript) {
                setSpeechTestResult(`⚠️ Partial: "${interimTranscript}" - Try speaking more clearly`);
            }
        };

        try {
            recognition.start();
            console.log('Speech recognition started');

            setTimeout(() => {
                recognition.stop();
            }, 15000);
        } catch (err) {
            console.error('Speech start error:', err);
            setSpeechTestResult('❌ Failed to start. Refresh page and try again.');
            setIsTesting(false);

            if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume().then(() => monitorAudioLevel());
            }
        }
    };

    const proceedToInterview = () => {
        if (videoStreamRef.current) {
            videoStreamRef.current.getTracks().forEach(t => t.stop());
        }
        if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach(t => t.stop());
        }
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }

        navigate(`/interview-session/${sessionId}`);
    };

    const StatusIcon = ({ status }) => {
        if (status === 'success') return <CheckCircle className="text-green-400" size={24} />;
        if (status === 'error') return <XCircle className="text-red-400" size={24} />;
        return <AlertCircle className="text-amber-400 animate-pulse" size={24} />;
    };

    return (
        <div className="min-h-screen px-6 py-8 max-w-5xl mx-auto">
            {/* Header */}
            <div className="text-center mb-10">
                <h1 className="text-3xl font-bold mb-2">
                    Interview <span className="gradient-text">Setup</span>
                </h1>
                <p className="text-gray-400">Let's make sure your camera and microphone are working</p>
            </div>

            {/* Progress Steps */}
            <div className="flex justify-center gap-4 mb-10">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${cameraStatus === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                    <Camera size={16} />
                    Camera
                    {cameraStatus === 'success' && <CheckCircle size={14} />}
                </div>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${micStatus === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                    <Mic size={16} />
                    Microphone
                    {micStatus === 'success' && <CheckCircle size={14} />}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Camera Preview */}
                <div className="glass-panel p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                <Camera className="text-blue-400" size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">Camera</h2>
                                {cameraLabel && <p className="text-xs text-blue-300 truncate max-w-[200px]">{cameraLabel}</p>}
                            </div>
                        </div>
                        <StatusIcon status={cameraStatus} />
                    </div>

                    <div className="relative aspect-video bg-zinc-950 rounded-xl overflow-hidden mb-4 border border-white/10">
                        <video
                            ref={videoRef}
                            className="w-full h-full object-cover transform scale-x-[-1]"
                            autoPlay
                            muted
                            playsInline
                        />
                        {cameraStatus === 'pending' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-gray-400 text-sm">Requesting camera access...</p>
                                </div>
                            </div>
                        )}
                        {cameraStatus === 'error' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-sm p-6">
                                <XCircle className="text-red-400 mb-3" size={48} />
                                <p className="text-red-300 text-center mb-4 text-sm">{cameraError}</p>
                                <button
                                    onClick={() => testCamera(true)}
                                    className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                                >
                                    <RefreshCw size={16} /> Retry
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => testCamera(true)}
                        className="w-full py-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 text-blue-400 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <RefreshCw size={16} /> Retry Camera
                    </button>
                </div>

                {/* Microphone Test */}
                <div className="glass-panel p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                                <Mic className="text-green-400" size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">Microphone</h2>
                                {micLabel && <p className="text-xs text-green-300 truncate max-w-[200px]">{micLabel}</p>}
                            </div>
                        </div>
                        <StatusIcon status={micStatus} />
                    </div>

                    {/* Audio Level Meter */}
                    <div className="mb-6">
                        <p className="text-sm text-gray-400 mb-2">Audio Level</p>
                        <div className="h-3 bg-zinc-900 rounded-full overflow-hidden">
                            <div
                                className="h-full transition-all duration-100"
                                style={{
                                    width: `${audioLevel}%`,
                                    background: audioLevel > 70
                                        ? 'linear-gradient(90deg, #10b981, #eab308, #ef4444)'
                                        : audioLevel > 30
                                            ? 'linear-gradient(90deg, #10b981, #eab308)'
                                            : '#10b981'
                                }}
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            {audioLevel > 50 ? '🎤 Good audio level!' : audioLevel > 10 ? '🎤 Speak louder' : '🔇 No audio detected'}
                        </p>
                    </div>

                    {micStatus === 'error' && (
                        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4">
                            <p className="text-red-300 text-sm">{micError}</p>
                        </div>
                    )}

                    <button
                        onClick={testMicrophone}
                        className="w-full py-2.5 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 text-green-400 rounded-lg transition-colors mb-4 flex items-center justify-center gap-2"
                    >
                        <RefreshCw size={16} /> Retry Microphone
                    </button>

                    {/* Speech Recognition Test */}
                    <div className="border-t border-white/10 pt-4">
                        <p className="text-sm text-gray-400 mb-3">Test Speech Recognition</p>
                        <button
                            onClick={testSpeechRecognition}
                            disabled={isTesting || micStatus !== 'success'}
                            className={`w-full py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 ${isTesting
                                ? 'bg-red-600 text-white animate-pulse'
                                : 'bg-accent-600/20 hover:bg-accent-600/30 border border-accent-600/30 text-accent-400'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {isTesting ? <MicOff size={18} /> : <Volume2 size={18} />}
                            {isTesting ? 'Listening...' : 'Test Speech'}
                        </button>
                        {speechTestResult && (
                            <p className="text-sm mt-3 text-center p-3 bg-zinc-900/50 rounded-lg">{speechTestResult}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Proceed Button */}
            <div className="mt-10 text-center">
                {allReady ? (
                    <>
                        <button
                            onClick={proceedToInterview}
                            className="px-10 py-4 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 rounded-xl text-xl font-semibold transition-all flex items-center gap-3 mx-auto shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:scale-105"
                        >
                            <Play size={24} fill="currentColor" />
                            Start Interview
                        </button>
                        {audioLevel < 10 && (
                            <p className="text-amber-400 text-sm mt-4 flex items-center justify-center gap-2">
                                <AlertCircle size={16} />
                                No audio detected - speak into your microphone to verify
                            </p>
                        )}
                        <p className="text-gray-500 text-sm mt-3 flex items-center justify-center gap-2">
                            <Sparkles size={14} />
                            Speech test is optional. If your audio level meter moves, you're good!
                        </p>
                    </>
                ) : (
                    <div className="glass-panel-subtle inline-flex items-center gap-3 px-6 py-4 text-amber-400">
                        <AlertCircle size={20} />
                        Please ensure camera and microphone are working before proceeding
                    </div>
                )}
            </div>

            {/* Tips */}
            <div className="mt-10 glass-panel p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Lightbulb className="text-amber-400" size={20} />
                    Tips for Best Results
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TipItem text="Use Google Chrome for best speech recognition support" />
                    <TipItem text="Ensure good lighting on your face" />
                    <TipItem text="Use a quiet environment to avoid background noise" />
                    <TipItem text="Position yourself so your face is clearly visible" />
                    <TipItem text="Speak clearly and at a moderate pace" />
                    <TipItem text="Look at the camera to maintain eye contact" />
                </div>
            </div>
        </div>
    );
};

const TipItem = ({ text }) => (
    <div className="flex items-start gap-3 text-gray-400 text-sm">
        <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />
        <span>{text}</span>
    </div>
);

export default InterviewSetup;
