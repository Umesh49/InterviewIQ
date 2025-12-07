import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, Mic, MicOff, CheckCircle, XCircle, AlertCircle, Play, Volume2 } from 'lucide-react';

const InterviewSetup = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationRef = useRef(null);

    // Setup state
    const [cameraStatus, setCameraStatus] = useState('pending'); // pending, success, error
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
        // Auto-start device tests
        testDevices();

        return () => {
            // Cleanup
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
        // Check if all devices are ready
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

        // Try loose constraints on retry, or specific on first attempt
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

            // Auto-retry once with loose constraints if it was a constraint/timeout issue
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
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true
            });

            audioStreamRef.current = stream;

            // Setup audio analyzer for level meter
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            source.connect(analyserRef.current);

            // Start level monitoring
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

        // Stop audio level monitoring temporarily to avoid conflicts
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }

        // Suspend audio context to free up mic
        if (audioContextRef.current && audioContextRef.current.state === 'running') {
            await audioContextRef.current.suspend();
        }

        setIsTesting(true);
        setSpeechTestResult('🎤 Listening... Say "Hello testing" now!');

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        // Enable continuous mode and interim results for better detection
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
                    // Show interim results
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

            // Handle specific errors
            if (event.error === 'no-speech') {
                setSpeechTestResult(`⚠️ No speech detected.

Try these fixes:
1. Go to chrome://settings/content/microphone and select your correct mic
2. Speak VERY LOUD into the microphone  
3. Close other apps using your mic
4. Refresh the page and try again`);
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

            // Resume audio level monitoring
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

            // Auto-stop after 15 seconds
            setTimeout(() => {
                recognition.stop();
            }, 15000);
        } catch (err) {
            console.error('Speech start error:', err);
            setSpeechTestResult('❌ Failed to start. Refresh page and try again.');
            setIsTesting(false);

            // Resume audio monitoring
            if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume().then(() => monitorAudioLevel());
            }
        }
    };

    const proceedToInterview = () => {
        // Stop the test streams (interview will request its own)
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

        // Navigate to interview
        navigate(`/interview-session/${sessionId}`);
    };

    const StatusIcon = ({ status }) => {
        if (status === 'success') return <CheckCircle className="text-green-500" size={24} />;
        if (status === 'error') return <XCircle className="text-red-500" size={24} />;
        return <AlertCircle className="text-yellow-500 animate-pulse" size={24} />;
    };

    return (
        <div className="min-h-screen p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-2 text-center">Interview Setup</h1>
            <p className="text-gray-400 text-center mb-8">Let's make sure your camera and microphone are working</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Camera Preview */}
                <div className="glass-panel p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Camera className="text-blue-400" />
                        <div>
                            <h2 className="text-xl font-semibold">Camera</h2>
                            {cameraLabel && <p className="text-xs text-blue-300">{cameraLabel}</p>}
                        </div>
                        <StatusIcon status={cameraStatus} />
                    </div>

                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4">
                        <video
                            ref={videoRef}
                            className="w-full h-full object-cover"
                            autoPlay
                            muted
                            playsInline
                        />
                        {cameraStatus === 'pending' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                <p className="text-white">Requesting camera access...</p>
                            </div>
                        )}
                        {cameraStatus === 'error' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                                <div className="text-center p-4">
                                    <XCircle className="text-red-500 mx-auto mb-2" size={48} />
                                    <p className="text-red-400 mb-4">{cameraError}</p>
                                    <button
                                        onClick={() => testCamera(true)}
                                        className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors font-semibold"
                                    >
                                        Retry Connection
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => testCamera(true)}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                    >
                        Retry Camera manually
                    </button>
                </div>

                {/* Microphone Test */}
                <div className="glass-panel p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Mic className="text-green-400" />
                        <div>
                            <h2 className="text-xl font-semibold">Microphone</h2>
                            {micLabel && <p className="text-xs text-green-300">{micLabel}</p>}
                        </div>
                        <StatusIcon status={micStatus} />
                    </div>

                    {/* Audio Level Meter */}
                    <div className="mb-4">
                        <p className="text-sm text-gray-400 mb-2">Audio Level:</p>
                        <div className="h-4 bg-dark-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-100"
                                style={{ width: `${audioLevel}%` }}
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            {audioLevel > 50 ? '🎤 Good audio level!' : audioLevel > 10 ? '🎤 Speak louder' : '🔇 No audio detected'}
                        </p>
                    </div>

                    {micStatus === 'error' && (
                        <div className="bg-red-900/30 border border-red-500 rounded-lg p-3 mb-4">
                            <p className="text-red-400 text-sm">{micError}</p>
                        </div>
                    )}

                    <button
                        onClick={testMicrophone}
                        className="w-full py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors mb-4"
                    >
                        Retry Microphone
                    </button>

                    {/* Speech Recognition Test */}
                    <div className="border-t border-gray-700 pt-4">
                        <p className="text-sm text-gray-400 mb-2">Test Speech Recognition:</p>
                        <button
                            onClick={testSpeechRecognition}
                            disabled={isTesting || micStatus !== 'success'}
                            className={`w-full py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${isTesting
                                ? 'bg-red-600 animate-pulse'
                                : 'bg-purple-600 hover:bg-purple-500'
                                } disabled:opacity-50`}
                        >
                            {isTesting ? <MicOff size={18} /> : <Volume2 size={18} />}
                            {isTesting ? 'Listening...' : 'Test Speech'}
                        </button>
                        {speechTestResult && (
                            <p className="text-sm mt-2 text-center">{speechTestResult}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Proceed Button */}
            <div className="mt-8 text-center">
                {allReady ? (
                    <>
                        <button
                            onClick={proceedToInterview}
                            className="px-8 py-4 bg-green-600 hover:bg-green-500 rounded-xl text-xl font-semibold transition-all flex items-center gap-3 mx-auto"
                        >
                            <Play size={24} />
                            Start Interview
                        </button>
                        {audioLevel < 10 && (
                            <p className="text-yellow-400 text-sm mt-3">
                                ⚠️ No audio detected - speak into your microphone to verify it works
                            </p>
                        )}
                        <p className="text-gray-500 text-sm mt-3">
                            💡 Speech test is optional. If your audio level meter moves when you speak, your mic is working!
                        </p>
                    </>
                ) : (
                    <div className="text-yellow-400">
                        <AlertCircle className="inline mr-2" />
                        Please ensure camera and microphone are working before proceeding
                    </div>
                )}
            </div>

            {/* Tips */}
            <div className="mt-8 glass-panel p-6">
                <h3 className="text-lg font-semibold mb-3">💡 Tips for Best Results</h3>
                <ul className="space-y-2 text-gray-400 text-sm">
                    <li>• Use Google Chrome for best speech recognition support</li>
                    <li>• Ensure good lighting on your face</li>
                    <li>• Use a quiet environment to avoid background noise</li>
                    <li>• Position yourself so your face is clearly visible in the camera</li>
                    <li>• Speak clearly and at a moderate pace</li>
                </ul>
            </div>
        </div>
    );
};

export default InterviewSetup;
