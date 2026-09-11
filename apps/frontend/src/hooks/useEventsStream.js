import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '~/services/apiClient';
import useDevices from '~/hooks/useDevices';
import useEnvironment from '~/hooks/useEnvironment';
import useAlerts from '~/hooks/useAlerts';

// Single SSE connection for realtime push from the backend — `device_status`,
// `device_created`, `device_updated`, `device_deleted`, `devices_paired`,
// `sensor_reading` and `alert` events land on the same stream. Runs once at
// the authenticated shell (MainLayout) so it stays open across page navigation.
const MAX_RECONNECT_DELAY_MS = 30000;

function useEventsStream(enabled) {
  const { patchDevice, upsertDevice, removeDevice } = useDevices();
  const { patchSensorReading } = useEnvironment();
  const { upsertAlert } = useAlerts();

  // Bumping this re-runs the effect, which reads a *fresh* access token and opens a
  // new EventSource. The token cannot be a dependency directly: apiClient keeps it in
  // a plain field, so React never sees it change.
  const [reconnectKey, setReconnectKey] = useState(0);
  const attemptsRef = useRef(0);

  const scheduleReconnect = useCallback((isCancelled, setTimer) => {
    // Back off so a persistently failing stream cannot spin: every attempt spends a
    // single-use refresh token, and a tight loop would burn the session.
    const delay = Math.min(1000 * 2 ** attemptsRef.current, MAX_RECONNECT_DELAY_MS);
    attemptsRef.current += 1;

    setTimer(
      setTimeout(() => {
        if (isCancelled()) return;
        apiClient
          .refreshTokens()
          .then(() => {
            if (!isCancelled()) setReconnectKey((key) => key + 1);
          })
          .catch(() => {
            // Refresh token is dead too. Say nothing here — the next ordinary API call
            // will 401 and apiClient's handler drives the sign-out.
          });
      }, delay)
    );
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const token = apiClient.getAccessToken();
    if (!token) return undefined;

    let cancelled = false;
    let retryTimer = null;
    const isCancelled = () => cancelled;
    const setTimer = (timer) => {
      retryTimer = timer;
    };

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

    source.onopen = () => {
      attemptsRef.current = 0;
    };

    source.onerror = () => {
      // Two different failures arrive on the same handler:
      //   readyState === CONNECTING -> the socket dropped (wifi blip, server restart).
      //     The browser reconnects by itself with the same URL. Nothing to do.
      //   readyState === CLOSED     -> the response was not a 200 text/event-stream.
      //     Per spec that "fails the connection" permanently. Our backend answers 401
      //     once the access token in ?token= expires (~15 min), so the old code's
      //     "browser tự reconnect" comment was wrong: the stream died silently and
      //     realtime updates stopped for the rest of the session.
      if (cancelled || source.readyState !== EventSource.CLOSED) return;
      scheduleReconnect(isCancelled, setTimer);
    };

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      source.close();
    };
  }, [
    enabled,
    reconnectKey,
    scheduleReconnect,
    patchDevice,
    upsertDevice,
    removeDevice,
    patchSensorReading,
    upsertAlert,
  ]);
}

export default useEventsStream;
