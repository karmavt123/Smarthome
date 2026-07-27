import { useRef, useState, useCallback, useEffect } from 'react';

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

  useEffect(() => stop, [stop]);

  return { videoRef, isActive, error, start, stop, capture };
}

export default useCamera;
