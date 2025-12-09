import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * usePhotoCapture - Captures periodic photos during interview for body language analysis.
 */
const usePhotoCapture = (videoRef, isRecording, captureIntervalMs = 5000) => {
    const [cameraActive, setCameraActive] = useState(false);
    const [error, setError] = useState(null);
    const [stream, setStream] = useState(null);
    const [photoCount, setPhotoCount] = useState(0);

    const canvasRef = useRef(null);
    const intervalRef = useRef(null);
    const startTimeRef = useRef(0);
    const initStartedRef = useRef(false);
    const photosRef = useRef([]);  // Use ref to avoid dependency issues

    // Create canvas
    useEffect(() => {
        canvasRef.current = document.createElement('canvas');
        canvasRef.current.width = 320;
        canvasRef.current.height = 240;
    }, []);

    // Initialize camera with retry logic
    useEffect(() => {
        if (initStartedRef.current) return;

        let retryTimeout;
        let retryCount = 0;
        const maxRetries = 10;

        const initCamera = async () => {
            const video = videoRef?.current;
            if (!video) {
                console.log('[PhotoCapture] Waiting for video element...');
                return false;
            }

            if (video.srcObject && video.readyState >= 2) {
                console.log('[PhotoCapture] Video stream already exists');
                setCameraActive(true);
                setStream(video.srcObject);
                return true;
            }

            try {
                console.log('[PhotoCapture] Requesting camera access...');
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
                    audio: false
                });

                video.srcObject = mediaStream;
                video.muted = true;

                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Video load timeout')), 10000);
                    video.onloadedmetadata = async () => {
                        clearTimeout(timeout);
                        try {
                            await video.play();
                        } catch (e) {
                            console.warn('[PhotoCapture] Autoplay blocked');
                        }
                        resolve();
                    };
                    video.onerror = () => { clearTimeout(timeout); reject(new Error('Video error')); };
                });

                setStream(mediaStream);
                setCameraActive(true);
                setError(null);
                console.log('[PhotoCapture] Camera initialized successfully! readyState:', video.readyState);
                return true;

            } catch (err) {
                console.error('[PhotoCapture] Camera init error:', err);
                setError(err.message || 'Camera access denied');
                setCameraActive(false);
                return false;
            }
        };

        const tryInit = async () => {
            initStartedRef.current = true;
            const success = await initCamera();
            if (!success && retryCount < maxRetries) {
                retryCount++;
                console.log(`[PhotoCapture] Retry ${retryCount}/${maxRetries}...`);
                retryTimeout = setTimeout(tryInit, 500);
            }
        };

        const timer = setTimeout(tryInit, 300);
        return () => { clearTimeout(timer); clearTimeout(retryTimeout); };
    }, [videoRef]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    // Capture function - uses refs to avoid recreating
    const capturePhoto = () => {
        const video = videoRef?.current;
        const canvas = canvasRef.current;

        if (!video || !canvas || !video.srcObject || video.readyState < 2) {
            return null;
        }
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            return null;
        }

        try {
            const ctx = canvas.getContext('2d');
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
            ctx.restore();

            const base64 = canvas.toDataURL('image/jpeg', 0.7);
            const photo = {
                base64,
                timestamp: Date.now() - startTimeRef.current,
                capturedAt: new Date().toISOString()
            };

            console.log(`[PhotoCapture] ✓ Captured photo at ${photo.timestamp}ms`);
            return photo;
        } catch (err) {
            console.error('[PhotoCapture] Capture error:', err);
            return null;
        }
    };

    // Recording effect - uses isRecording ONLY as dependency
    useEffect(() => {
        if (isRecording) {
            // Reset
            photosRef.current = [];
            startTimeRef.current = Date.now();
            setPhotoCount(0);

            console.log(`[PhotoCapture] Recording started, capturing every ${captureIntervalMs}ms`);

            // First capture after delay
            const firstTimer = setTimeout(() => {
                const photo = capturePhoto();
                if (photo) {
                    photosRef.current = [photo];
                    setPhotoCount(1);
                }
            }, 2000);

            // Interval captures
            intervalRef.current = setInterval(() => {
                const photo = capturePhoto();
                if (photo) {
                    photosRef.current = [...photosRef.current, photo].slice(-12);
                    setPhotoCount(photosRef.current.length);
                }
            }, captureIntervalMs);

            return () => {
                clearTimeout(firstTimer);
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            };
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            if (photosRef.current.length > 0) {
                console.log(`[PhotoCapture] Stopped. Total photos: ${photosRef.current.length}`);
            }
        }
    }, [isRecording, captureIntervalMs]);  // Removed capturePhoto from deps

    // Get photos for submission - reads from ref
    const getPhotosForSubmission = useCallback(() => {
        const photos = photosRef.current;
        console.log(`[PhotoCapture] Sending ${photos.length} photos for analysis`);
        return photos.map(p => p.base64);
    }, []);

    // Get issue log
    const getIssueLog = useCallback(() => {
        return photosRef.current.map(p => ({
            time: p.timestamp / 1000,
            type: 'photo_capture',
            msg: 'Photo captured for body language analysis'
        }));
    }, []);

    return {
        photos: photosRef.current,
        metrics: {
            photosCaptured: photoCount,
            latestCapture: null,
            cameraActive,
            error,
            eyeContact: 0,
            posture: 'Needs Improvement',
            fidgetScore: 0,
            gazeDirection: 'Center',
            faceDetected: cameraActive
        },
        stream,
        getPhotosForSubmission,
        getIssueLog
    };
};

export default usePhotoCapture;
