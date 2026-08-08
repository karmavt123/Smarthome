import { useEffect } from 'react';
import apiClient from '~/services/apiClient';
import useDevices from '~/hooks/useDevices';

// Push channel for device status — server sends `device_status` events as
// devices change instead of the app having to poll for it. Runs once at the
// authenticated shell (MainLayout) so it stays open across page navigation.
function useDeviceStatusStream(enabled) {
  const { patchDevice } = useDevices();

  useEffect(() => {
    if (!enabled) return undefined;

    const token = apiClient.getAccessToken();
    if (!token) return undefined;

    const source = new EventSource(
      `${apiClient.getBaseUrl()}/events/stream?token=${encodeURIComponent(token)}`
    );

    source.addEventListener('device_status', (e) => {
      const data = JSON.parse(e.data);
      patchDevice(data.deviceId, {
        status: data.status,
        connectionStatus: data.connectionStatus,
        lastSeenAt: data.lastSeenAt,
      });
    });

    source.onerror = (err) => {
      // EventSource tự reconnect (cùng URL/token) — không tự viết lại logic retry.
      console.warn('SSE lỗi, browser tự reconnect', err);
    };

    return () => source.close();
  }, [enabled, patchDevice]);
}

export default useDeviceStatusStream;
