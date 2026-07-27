import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFaceSmile, faCircleCheck, faLock, faSpinner } from '@fortawesome/free-solid-svg-icons';
import useCamera from '~/hooks/useCamera';
import useFaceDetector from '~/hooks/useFaceDetector';
import doorAccessService from '~/services/doorAccessService';

function formatTime(isoDate) {
  return new Date(isoDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function UnlockFaceId({ doorDeviceId, onSuccess, onCancel, onSwitchToPin }) {
  const { videoRef, isActive, error: cameraError, start, stop, capture } = useCamera();
  const [isCheckingLock, setIsCheckingLock] = useState(true);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [message, setMessage] = useState(null);

  const handleVerify = useCallback(async () => {
    const blob = await capture();
    if (!blob) return;

    setIsVerifying(true);
    setMessage(null);
    stop();

    const formData = new FormData();
    formData.append('doorDeviceId', doorDeviceId);
    formData.append('image', blob, 'capture.jpg');

    try {
      const result = await doorAccessService.verifyFace(formData);
      if (result.result === 'success') {
        onSuccess();
        return;
      }
      setMessage('Không nhận diện được khuôn mặt. Thử lại hoặc dùng PIN.');
      start();
    } catch (err) {
      if (err?.status === 423) {
        setLockedUntil(err.details?.lockedUntil || null);
      } else {
        setMessage(err?.message || 'Không thể xác thực, thử lại sau.');
        start();
      }
    } finally {
      setIsVerifying(false);
    }
  }, [capture, stop, start, doorDeviceId, onSuccess]);

  const {
    canvasRef,
    isModelReady,
    modelError,
    isFaceDetected,
    start: startDetector,
    stop: stopDetector,
  } = useFaceDetector(videoRef, { onStableFace: handleVerify });

  useEffect(() => {
    let cancelled = false;
    doorAccessService
      .getFaceLockStatus(doorDeviceId)
      .then((status) => {
        if (cancelled) return;
        if (status.locked) {
          setLockedUntil(status.lockedUntil);
        } else {
          start();
        }
      })
      .catch(() => {
        if (!cancelled) start();
      })
      .finally(() => {
        if (!cancelled) setIsCheckingLock(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doorDeviceId]);

  useEffect(() => {
    if (isActive && isModelReady && !isVerifying) startDetector();
    return stopDetector;
  }, [isActive, isModelReady, isVerifying, startDetector, stopDetector]);

  if (isCheckingLock) {
    return (
      <div className="flex flex-col items-center text-center py-6">
        <FontAwesomeIcon icon={faSpinner} className="w-6 h-6 text-secondary animate-spin" />
      </div>
    );
  }

  if (lockedUntil) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-11 h-11 rounded-full bg-error/15 flex items-center justify-center text-error">
          <FontAwesomeIcon icon={faLock} className="w-5 h-5" />
        </div>
        <h2 className="text-body-lg font-semibold text-on-surface mt-3">Face ID đang bị khóa</h2>
        <p className="text-body-md text-outline mt-2">
          Do sai quá nhiều lần, Face ID tạm khóa tới {formatTime(lockedUntil)}. Dùng mã PIN để mở cửa.
        </p>

        {onSwitchToPin && (
          <button
            type="button"
            onClick={onSwitchToPin}
            className="w-full rounded-lg bg-secondary text-on-secondary font-medium py-3 text-body-md mt-5 hover:opacity-90 transition-opacity"
          >
            Dùng mã PIN
          </button>
        )}
        <button type="button" onClick={onCancel} className="text-body-md text-on-surface-variant underline mt-3">
          Hủy
        </button>
      </div>
    );
  }

  const statusText = !isModelReady
    ? 'Đang tải model nhận diện...'
    : isFaceDetected
      ? 'Giữ yên, đang xác thực...'
      : 'Đưa mặt vào khung hình';

  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-11 h-11 rounded-full bg-tertiary/15 flex items-center justify-center text-tertiary">
        <FontAwesomeIcon icon={faFaceSmile} className="w-5 h-5" />
      </div>

      <h2 className="text-body-lg font-semibold text-on-surface mt-1">Quét khuôn mặt để mở khóa</h2>

      <div className="relative w-56 aspect-video mt-6 rounded-lg overflow-hidden bg-surface-container-low">
        <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
      </div>

      {(cameraError || modelError) && <p className="text-body-md text-error mt-3">{cameraError || modelError}</p>}
      {message && <p className="text-body-md text-error mt-3">{message}</p>}

      <p className="text-label-md text-tertiary font-medium mt-3">
        {isVerifying ? 'Đang xác thực... (có thể mất vài giây)' : statusText}
      </p>

      <button
        type="button"
        onClick={handleVerify}
        disabled={!isActive || isVerifying}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-secondary text-on-secondary font-medium py-3 text-body-md mt-6 hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {isVerifying ? (
          <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" />
        ) : (
          <FontAwesomeIcon icon={faCircleCheck} className="w-4 h-4" />
        )}
        Xác nhận thủ công
      </button>

      {onSwitchToPin && (
        <button type="button" onClick={onSwitchToPin} className="text-body-md text-secondary underline mt-3">
          Dùng mã PIN thay thế
        </button>
      )}

      <button type="button" onClick={onCancel} className="text-body-md text-on-surface-variant underline mt-3">
        Hủy
      </button>
    </div>
  );
}

export default UnlockFaceId;
