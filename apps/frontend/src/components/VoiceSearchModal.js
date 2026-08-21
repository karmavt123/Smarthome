import { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMicrophone,
  faSpinner,
  faKeyboard,
  faFaceSmile,
} from '@fortawesome/free-solid-svg-icons';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import Modal from '~/components/Modal';
import UnlockPinPad from '~/components/UnlockPinPad';
import UnlockFaceId from '~/components/UnlockFaceId';
import useHome from '~/hooks/useHome';
import voiceCommandService from '~/services/voiceCommandService';

// phase: 'listening' | 'idle' | 'processing' | 'success' | 'unknown' | 'error'
function VoiceSearchModal({ open, onClose }) {
  const { currentHomeId } = useHome();
  const { transcript, resetTranscript, browserSupportsSpeechRecognition } =
    useSpeechRecognition();

  const [phase, setPhase] = useState('idle');
  const [errorMessage, setErrorMessage] = useState(null);
  const [resultMessage, setResultMessage] = useState(null);
  const silenceTimerRef = useRef(null);

  const [verifyDevice, setVerifyDevice] = useState(null);
  const [verifyStep, setVerifyStep] = useState('choice'); // 'choice' | 'pin' | 'face'

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    clearSilenceTimer();
    resetTranscript();
    setErrorMessage(null);
    setResultMessage(null);
    setVerifyDevice(null);
    setVerifyStep('choice');
    setPhase('listening');
    SpeechRecognition.startListening({ continuous: true, language: 'vi-VN' });
  }, [clearSilenceTimer, resetTranscript]);

  useEffect(() => {
    if (open && browserSupportsSpeechRecognition) {
      startListening();
    }
    if (!open) {
      SpeechRecognition.stopListening();
      clearSilenceTimer();
      setVerifyDevice(null);
      setVerifyStep('choice');
    }
    return () => {
      SpeechRecognition.stopListening();
      clearSilenceTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, browserSupportsSpeechRecognition]);

  useEffect(() => {
    if (transcript) {
      console.log('[VoiceSearch] transcript:', transcript);
    }
  }, [transcript]);

  const sendCommand = async (text) => {
    setPhase('processing');
    try {
      const res = await voiceCommandService.send(text, currentHomeId);
      if (res?.voiceCommand?.executionStatus === 'unknown_command') {
        setErrorMessage('Không nhận diện được lệnh. Vui lòng thử nói lại.');
        setPhase('unknown');
        return;
      }

      const device = res?.device;
      const isDoorOpenNeedsVerify =
        res?.requiresVerification &&
        device?.deviceType === 'door' &&
        res?.voiceCommand?.intent === 'open:door' &&
        device?.status !== 'open';

      if (isDoorOpenNeedsVerify) {
        setResultMessage(`Cần xác thực để mở cửa "${device.name}".`);
        setVerifyDevice(device);
        setVerifyStep('choice');
        setPhase('success');
        return;
      }

      const deviceName = device?.name;
      const action = res?.action?.action;
      setResultMessage(
        deviceName && action ? `Đã thực hiện: ${action} — ${deviceName}` : 'Đã thực hiện lệnh.'
      );
      setPhase('success');
    } catch (err) {
      setErrorMessage(
        err?.details?.voiceIntentUnavailable
          ? err.message
          : err?.message || 'Có lỗi xảy ra, vui lòng thử lại.'
      );
      setPhase('error');
    }
  };

  const stopAndSend = useCallback(() => {
    clearSilenceTimer();
    SpeechRecognition.stopListening();
    const text = transcript.trim();
    if (text) {
      sendCommand(text);
    } else {
      setPhase('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSilenceTimer, transcript]);

  // Auto stop-and-send once the recognized phrase stays unchanged for a beat,
  // same UX as Google Translate's voice popup — no need to click again.
  useEffect(() => {
    if (phase !== 'listening' || !transcript.trim()) {
      clearSilenceTimer();
      return undefined;
    }
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(stopAndSend, 1500);
    return clearSilenceTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, phase]);

  const handleMicClick = () => {
    if (phase === 'listening') {
      stopAndSend();
      return;
    }
    if (phase === 'processing') return;
    startListening();
  };

  const handleVerifySuccess = () => {
    setVerifyDevice(null);
    setVerifyStep('choice');
    setResultMessage('Đã xác thực và mở cửa.');
  };

  const closeVerify = () => {
    setVerifyDevice(null);
    setVerifyStep('choice');
  };

  const isError = phase === 'unknown' || phase === 'error';

  const statusText = {
    listening: 'Đang nghe... hãy nói tiếng Việt.',
    processing: 'Đang xử lý lệnh...',
    success: resultMessage,
    unknown: errorMessage,
    error: errorMessage,
    idle: 'Nhấn micro để bắt đầu nói.',
  }[phase];

  return (
    <Modal open={open} onClose={onClose} title="Tìm kiếm bằng giọng nói">
      {!browserSupportsSpeechRecognition ? (
        <p className="text-body-md text-error text-center py-6">
          Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.
        </p>
      ) : (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative flex items-center justify-center">
            {phase === 'listening' && (
              <span className="absolute inline-flex h-20 w-20 rounded-full bg-secondary/30 animate-ping" />
            )}
            <button
              type="button"
              onClick={handleMicClick}
              disabled={phase === 'processing'}
              aria-label={phase === 'listening' ? 'Dừng và gửi lệnh' : 'Bắt đầu nói'}
              className={`relative w-20 h-20 rounded-full flex items-center justify-center border transition-colors ${
                isError
                  ? 'bg-error/10 border-error text-error'
                  : phase === 'listening'
                    ? 'bg-secondary/15 border-secondary text-secondary'
                    : 'bg-surface-container-low border-outline-variant/30 text-on-surface-variant'
              }`}
            >
              <FontAwesomeIcon
                icon={phase === 'processing' ? faSpinner : faMicrophone}
                className={`w-6 h-6 ${phase === 'processing' ? 'animate-spin' : ''}`}
              />
            </button>
          </div>

          <p className={`text-body-md text-center ${isError ? 'text-error' : 'text-on-surface-variant'}`}>
            {statusText}
          </p>

          <div
            className={`w-full min-h-[3rem] rounded-xl bg-surface-container-low border px-4 py-3 text-body-md text-on-surface transition-shadow ${
              isError
                ? 'border-error shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
                : 'border-outline-variant/30'
            }`}
          >
            {transcript || <span className="text-outline">Nội dung nói sẽ hiện ở đây...</span>}
          </div>
        </div>
      )}

      {verifyDevice && (
        <Modal
          open={!!verifyDevice}
          onClose={closeVerify}
          title={verifyStep === 'choice' ? `Xác thực để mở "${verifyDevice.name}"` : undefined}
        >
          {verifyStep === 'choice' && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setVerifyStep('pin')}
                className="flex items-center justify-center gap-2 rounded-lg bg-secondary text-on-secondary font-medium px-4 py-2.5 text-body-md hover:opacity-90 transition-opacity"
              >
                <FontAwesomeIcon icon={faKeyboard} className="w-4 h-4" />
                Mở bằng mã PIN
              </button>
              <button
                type="button"
                onClick={() => setVerifyStep('face')}
                className="flex items-center justify-center gap-2 rounded-lg border border-secondary/50 text-secondary font-medium px-4 py-2.5 text-body-md hover:bg-secondary/10 transition-colors"
              >
                <FontAwesomeIcon icon={faFaceSmile} className="w-4 h-4" />
                Mở bằng Face ID
              </button>
            </div>
          )}

          {verifyStep === 'pin' && (
            <UnlockPinPad
              doorDeviceId={verifyDevice.id}
              onSuccess={handleVerifySuccess}
              onCancel={closeVerify}
            />
          )}

          {verifyStep === 'face' && (
            <UnlockFaceId
              doorDeviceId={verifyDevice.id}
              onSuccess={handleVerifySuccess}
              onCancel={closeVerify}
              onSwitchToPin={() => setVerifyStep('pin')}
            />
          )}
        </Modal>
      )}
    </Modal>
  );
}

export default VoiceSearchModal;
