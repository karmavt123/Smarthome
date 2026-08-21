import { useEffect } from 'react';
import apiClient from '~/services/apiClient';
import useDevices from '~/hooks/useDevices';
import useEnvironment from '~/hooks/useEnvironment';
import useAlerts from '~/hooks/useAlerts';

// Single SSE connection for realtime push from the backend — `device_status`,
// `device_created`, `device_updated`, `device_deleted`, `devices_paired`,
// `sensor_reading` and `alert` events land on the same stream. Runs once at
// the authenticated shell (MainLayout) so it stays open across page navigation.
function useEventsStream(enabled) {
  const { patchDevice, upsertDevice, removeDevice } = useDevices();
  const { patchSensorReading } = useEnvironment();
  const { upsertAlert } = useAlerts();

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

    source.addEventListener('device_created', (e) => {
      const data = JSON.parse(e.data);
      upsertDevice(data);
    });

    source.addEventListener('device_updated', (e) => {
      const data = JSON.parse(e.data);
      upsertDevice(data);
    });

    source.addEventListener('device_deleted', (e) => {
      const data = JSON.parse(e.data);
      removeDevice(data.deviceId ?? data.id);
    });

    source.addEventListener('devices_paired', (e) => {
      const data = JSON.parse(e.data);
      const devicesList = Array.isArray(data) ? data : [];
      devicesList.forEach(upsertDevice);
    });

    source.addEventListener('sensor_reading', (e) => {
      const data = JSON.parse(e.data);
      patchSensorReading(data.sensorType, {
        value: data.value,
        capturedAt: data.capturedAt,
      });
    });

    source.addEventListener('alert', (e) => {
      const data = JSON.parse(e.data);
      upsertAlert(data);
    });

    source.onerror = (err) => {
      // EventSource tự reconnect (cùng URL/token) — không tự viết lại logic retry.
      console.warn('SSE lỗi, browser tự reconnect', err);
    };

    return () => source.close();
  }, [enabled, patchDevice, upsertDevice, removeDevice, patchSensorReading, upsertAlert]);
}

export default useEventsStream;
