import { useRef, useState, useCallback, useEffect } from 'react';

// verify-face now wants a 1-5 frame burst spanning ~1s (liveness check on
// the backend) instead of a single still frame — see docs/FACE-ID-USAGE.md.
const BURST_FRAME_COUNT = 5;
const BURST_FRAME_SPACING_MS = 200; // 5 frames * 200ms ≈ 1s burst window

// Shared getUserMedia + frame-capture primitive for the two Face ID flows
// (enrollment in AddFaceProfileForm, unlock in UnlockFaceId) — both need the
// same start/stop/capture-a-jpeg-blob behavior.
function useCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsActive(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsActive(true);
    } catch {
      setError('Không thể truy cập camera. Kiểm tra quyền truy cập trình duyệt.');
      setIsActive(false);
    }
  }, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return Promise.resolve(null);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  }, []);

  const captureBurst = useCallback(
    async (frameCount = BURST_FRAME_COUNT, spacingMs = BURST_FRAME_SPACING_MS) => {
      const frames = [];
      for (let i = 0; i < frameCount; i += 1) {
        const blob = await capture();
        if (blob) frames.push(blob);
        if (i < frameCount - 1) await new Promise((resolve) => setTimeout(resolve, spacingMs));
      }
      return frames;
    },
    [capture]
  );

  useEffect(() => stop, [stop]);

  return { videoRef, isActive, error, start, stop, capture, captureBurst };
}

export default useCamera;
