import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faCopy, faCheck } from '@fortawesome/free-solid-svg-icons';
import deviceService from '~/services/deviceService';
import Modal from '~/components/Modal';

function formatExpiry(expiresAt) {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function PairDeviceModal({ open, onClose, homeId }) {
  const [pairing, setPairing] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setError(null);
    setPairing(null);
    setCopied(false);

    deviceService
      .createPairingToken(homeId)
      .then((data) => {
        if (!cancelled) setPairing(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Không thể tạo mã kết nối, thử lại sau.');
      });

    return () => {
      cancelled = true;
    };
  }, [open, homeId]);

  const handleCopy = async () => {
    if (!pairing?.token) return;
    try {
      await navigator.clipboard.writeText(pairing.token);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const expiry = formatExpiry(pairing?.expiresAt);

  return (
    <Modal open={open} onClose={onClose} title="Kết nối thiết bị">
      {error && <p className="text-body-md text-error">{error}</p>}

      {!error && !pairing && (
        <div className="flex items-center justify-center py-8">
          <FontAwesomeIcon icon={faSpinner} className="w-6 h-6 text-secondary animate-spin" />
        </div>
      )}

      {!error && pairing && (
        <div className="flex flex-col gap-4">
          <p className="text-body-md text-on-surface-variant">
            Nhập mã này vào thiết bị (biến <code>PAIRING_TOKEN</code> trong chương trình nạp cho
            board) rồi khởi động lại thiết bị để nó tự đăng ký vào nhà này.
          </p>

          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface">
              {pairing.token}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Sao chép mã kết nối"
              className="shrink-0 rounded-lg border border-outline-variant/40 px-3 py-3 text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              <FontAwesomeIcon icon={copied ? faCheck : faCopy} className="w-4 h-4" />
            </button>
          </div>

          {expiry && <p className="text-label-md text-outline">Mã hết hạn lúc {expiry}.</p>}
        </div>
      )}
    </Modal>
  );
}

export default PairDeviceModal;
