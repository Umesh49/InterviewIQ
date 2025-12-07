import { useEffect, useRef, useState } from 'react';
import { Holistic } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';

const useMediaPipe = (videoRef, isRecording) => {
  const [metrics, setMetrics] = useState({
    eyeContact: 0,
    posture: 'Good',
    faceDetected: false,
    fidgetScore: 0,
    gazeDirection: 'Center',
    cameraActive: false,
    cameraActive: false,
    error: null
  });
  const [stream, setStream] = useState(null);

  const holisticRef = useRef(null);
  const cameraRef = useRef(null);
  const prevNoseRef = useRef(null);
  const movementBuffer = useRef([]);
  const initAttempted = useRef(false);

  // Issue Logging
  const issueLogRef = useRef([]);
  const startTimeRef = useRef(0);
  const lastLoggedRef = useRef({ posture: 0, eyeContact: 0 });

  useEffect(() => {
    if (isRecording) {
      issueLogRef.current = [];
      startTimeRef.current = Date.now();
      lastLoggedRef.current = { posture: 0, eyeContact: 0 };
    }
  }, [isRecording]);

  useEffect(() => {
    // Wait for videoRef to be available
    if (!videoRef?.current || initAttempted.current) return;
    initAttempted.current = true;

    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: true
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStream(stream);

        setMetrics(prev => ({ ...prev, cameraActive: true, error: null }));

        const holistic = new Holistic({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
        });

        holistic.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        holistic.onResults(onResults);
        holisticRef.current = holistic;

        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (holisticRef.current && videoRef.current) {
              try {
                await holisticRef.current.send({ image: videoRef.current });
              } catch (e) {
                console.warn('Frame processing error:', e);
              }
            }
          },
          width: 640,
          height: 480
        });

        camera.start();
        cameraRef.current = camera;
        console.log('Camera and MediaPipe initialized successfully');

      } catch (err) {
        console.error('Camera initialization error:', err);
        setMetrics(prev => ({
          ...prev,
          error: err.message || 'Camera access denied',
          cameraActive: false
        }));
      }
    };

    const onResults = (results) => {
      let eyeContactScore = 0;
      let postureStatus = 'Good';
      let isFaceDetected = false;
      let currentFidget = 0;
      let currentGaze = 'Center';

      if (results.faceLandmarks) {
        isFaceDetected = true;
        const nose = results.faceLandmarks[1];

        // Gaze Detection
        if (nose.x < 0.4) currentGaze = 'Right';
        else if (nose.x > 0.6) currentGaze = 'Left';
        else if (nose.y < 0.4) currentGaze = 'Up';
        else currentGaze = 'Center';

        if (currentGaze === 'Center') eyeContactScore = 1;
        else eyeContactScore = 0.3;

        // Fidget Detection
        if (prevNoseRef.current) {
          const dx = nose.x - prevNoseRef.current.x;
          const dy = nose.y - prevNoseRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          movementBuffer.current.push(dist);
          if (movementBuffer.current.length > 30) movementBuffer.current.shift();

          const avgMove = movementBuffer.current.reduce((a, b) => a + b, 0) / movementBuffer.current.length;
          currentFidget = Math.min(1, Math.max(0, (avgMove - 0.002) * 100));
        }
        prevNoseRef.current = nose;
      }

      if (results.poseLandmarks) {
        const leftShoulder = results.poseLandmarks[11];
        const rightShoulder = results.poseLandmarks[12];

        if (leftShoulder && rightShoulder) {
          const yDiff = Math.abs(leftShoulder.y - rightShoulder.y);
          if (yDiff > 0.05) postureStatus = 'Leaning';
        }
      }

      // Log Issues if Recording
      if (isRecording) {
        const now = Date.now();
        const timestamp = (now - startTimeRef.current) / 1000;

        // Log bad posture (throttle to once every 2 seconds)
        if (postureStatus !== 'Good' && (now - lastLoggedRef.current.posture > 2000)) {
          issueLogRef.current.push({
            time: timestamp,
            type: 'posture',
            msg: `Bad Posture detected (${postureStatus})`
          });
          lastLoggedRef.current.posture = now;
        }

        // Log bad eye contact (throttle to once every 3 seconds)
        if (eyeContactScore < 0.5 && (now - lastLoggedRef.current.eyeContact > 3000)) {
          issueLogRef.current.push({
            time: timestamp,
            type: 'eye_contact',
            msg: `Poor Eye Contact (Looking ${currentGaze})`
          });
          lastLoggedRef.current.eyeContact = now;
        }
      }

      setMetrics(prev => ({
        ...prev,
        eyeContact: eyeContactScore,
        posture: postureStatus,
        faceDetected: isFaceDetected,
        fidgetScore: currentFidget,
        gazeDirection: currentGaze
      }));
    };

    // Helper to start init
    const timer = setTimeout(initCamera, 100);

    return () => {
      clearTimeout(timer);
      if (cameraRef.current) cameraRef.current.stop();
      if (holisticRef.current) holisticRef.current.close();
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [videoRef]); // Note: isRecording is not in dependency to avoid re-init

  return { metrics, issueLog: issueLogRef.current, stream };
};

export default useMediaPipe;
