import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import deviceService from '~/services/deviceService';
import Modal from '~/components/Modal';
import apiClient from '~/services/apiClient';

function PairDeviceModal({ open, onClose, homeId }) {
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);

    deviceService
      .createPairingToken(homeId)
      .catch((err) => setError(err?.message || 'Không thể tạo mã kết nối, thử lại sau.'));
  }, [open, homeId]);

  useEffect(() => {
    if (!open) return;

    const response = fetch('http://192.168.4.1/pair', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pairingToken: 'test-token-123',
        ssid: 'Pink Home',
        password: '68686868',
      }),
    })
      .then(async (res) => {
        const data = await res.json();

        console.log('data from device', data);
      })
      .catch((err) => {
        console.log('err', err);
      });
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Kết nối thiết bị">
      {error ? (
        <p className="text-body-md text-error">{error}</p>
      ) : (
        <div className="flex items-center justify-center py-8">
          <FontAwesomeIcon icon={faSpinner} className="w-6 h-6 text-secondary animate-spin" />
        </div>
      )}
    </Modal>
  );
}

export default PairDeviceModal;
