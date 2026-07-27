import { useState, useRef, useCallback, useEffect } from 'react';
import * as faceapi from 'face-api.js';

const MODEL_URL = '/models';
const DETECT_INTERVAL_MS = 200;
// ~1.2s of continuous detection before auto-capture fires — long enough to
// filter out a passing glance or a blurry single frame, short enough to feel
// instant once the user actually holds still.
const STABLE_FRAMES_REQUIRED = 6;

// Models are loaded once per page load and shared across every component
// instance (AddFaceProfileForm + UnlockFaceId both mount this hook).
let modelsPromise = null;
function loadModels() {
  if (!modelsPromise) {
    modelsPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    ]);
  }
  return modelsPromise;
}

// Draws live landmark dots on a canvas overlaid on `videoRef`, and calls
// `onStableFace` once a face has been detected for STABLE_FRAMES_REQUIRED
// consecutive frames in a row — the "hold still, auto-capture" UX.
function useFaceDetector(videoRef, { onStableFace } = {}) {
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const stableCountRef = useRef(0);
  const firedRef = useRef(false);
  const onStableFaceRef = useRef(onStableFace);
  onStableFaceRef.current = onStableFace;

  const [isModelReady, setIsModelReady] = useState(false);
  const [modelError, setModelError] = useState(null);
  const [isFaceDetected, setIsFaceDetected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadModels()
      .then(() => {
        if (!cancelled) setIsModelReady(true);
      })
      .catch(() => {
        if (!cancelled) setModelError('Không thể tải model nhận diện khuôn mặt.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stop = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const reset = useCallback(() => {
    firedRef.current = false;
    stableCountRef.current = 0;
    setIsFaceDetected(false);
  }, []);

  const start = useCallback(() => {
    if (!isModelReady || intervalRef.current) return;
    reset();

    intervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks(true);

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (detection) faceapi.draw.drawFaceLandmarks(canvas, detection);
      }

      if (detection) {
        setIsFaceDetected(true);
        stableCountRef.current += 1;
        if (stableCountRef.current >= STABLE_FRAMES_REQUIRED && !firedRef.current) {
          firedRef.current = true;
          onStableFaceRef.current?.();
        }
      } else {
        setIsFaceDetected(false);
        stableCountRef.current = 0;
      }
    }, DETECT_INTERVAL_MS);
  }, [isModelReady, videoRef, reset]);

  useEffect(() => stop, [stop]);

  return { canvasRef, isModelReady, modelError, isFaceDetected, start, stop, reset };
}

export default useFaceDetector;
