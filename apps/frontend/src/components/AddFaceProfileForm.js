import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera, faRotateLeft, faSpinner } from '@fortawesome/free-solid-svg-icons';
import useCamera from '~/hooks/useCamera';
import useFaceDetector from '~/hooks/useFaceDetector';

function AddFaceProfileForm({ onSubmit, onCancel, isSubmitting, error }) {
  const [name, setName] = useState('');
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const { videoRef, isActive, error: cameraError, start, stop, capture } = useCamera();

  const handleCapture = useCallback(async () => {
    const blob = await capture();
    if (!blob) return;
    setCapturedBlob(blob);
    setPreviewUrl(URL.createObjectURL(blob));
    stop();
  }, [capture, stop]);

  const {
    canvasRef,
    isModelReady,
    modelError,
    isFaceDetected,
    start: startDetector,
    stop: stopDetector,
  } = useFaceDetector(videoRef, { onStableFace: handleCapture });

  useEffect(() => {
    start();
  }, [start]);

  useEffect(() => {
    if (isActive && isModelReady) startDetector();
    return stopDetector;
  }, [isActive, isModelReady, startDetector, stopDetector]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleRetake = () => {
    setCapturedBlob(null);
    setPreviewUrl(null);
    start();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !capturedBlob) return;
    onSubmit({ name: name.trim(), imageBlob: capturedBlob });
  };

  const statusText = !isModelReady
    ? 'Đang tải model nhận diện...'
    : isFaceDetected
      ? 'Giữ yên, đang chụp...'
      : 'Đưa mặt vào khung hình';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="profileName" className="text-label-md text-on-surface-variant">
          Tên hồ sơ
        </label>
        <input
          id="profileName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="VD: Member C"
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary"
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-label-md text-on-surface-variant">Ảnh khuôn mặt</p>

        <div className="relative aspect-video w-full rounded-lg bg-surface-container-low overflow-hidden">
          {previewUrl ? (
            <img src={previewUrl} alt="Ảnh đã chụp" className="w-full h-full object-cover" />
          ) : (
            <>
              <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
            </>
          )}
        </div>

        {!capturedBlob && <p className="text-label-sm text-tertiary">{statusText}</p>}
        {(cameraError || modelError) && <p className="text-body-md text-error">{cameraError || modelError}</p>}

        {!capturedBlob ? (
          <button
            type="button"
            onClick={handleCapture}
            disabled={!isActive}
            className="flex items-center justify-center gap-2 rounded-lg border border-outline-variant/40 text-on-surface-variant font-medium py-2.5 text-body-md hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faCamera} className="w-4 h-4" />
            Chụp thủ công
          </button>
        ) : (
          <button
            type="button"
            onClick={handleRetake}
            className="flex items-center justify-center gap-2 rounded-lg border border-outline-variant/40 text-on-surface-variant font-medium py-2.5 text-body-md hover:bg-surface-container-high transition-colors"
          >
            <FontAwesomeIcon icon={faRotateLeft} className="w-4 h-4" />
            Chụp lại
          </button>
        )}
      </div>

      <p className="text-label-sm text-outline">
        Chỉ chụp 1 khuôn mặt trong khung hình, đủ sáng. Ảnh có nhiều hơn 1 khuôn mặt hoặc không nhận ra khuôn mặt sẽ bị từ chối.
      </p>

      {error && <p className="text-body-md text-error">{error}</p>}

      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 rounded-lg border border-outline-variant/40 text-on-surface-variant font-medium py-3 text-body-md hover:bg-surface-container-high transition-colors disabled:opacity-50"
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !name.trim() || !capturedBlob}
          className="flex-1 rounded-lg bg-secondary text-on-secondary font-medium py-3 text-body-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting && <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" />}
          Tạo hồ sơ
        </button>
      </div>
    </form>
  );
}

export default AddFaceProfileForm;
