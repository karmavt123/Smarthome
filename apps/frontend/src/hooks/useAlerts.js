import { useCallback } from 'react';
import { useAtom } from 'jotai';
import { alertsState } from '~/atoms/alertAtoms';

// Single source of truth for alert data — pages sync fetched alerts in via
// setAlerts, everything that renders alert data reads `alerts`.
function useAlerts() {
  const [alerts, setAlerts] = useAtom(alertsState);

  // Insert a new alert or merge an update into an existing one by id — used
  // by the SSE stream (new alert fired / status changed) and by optimistic
  // updates after resolving an incident.
  const upsertAlert = useCallback(
    (alert) => {
      if (!alert) return;
      setAlerts((prev) => {
        const idx = prev.findIndex((a) => a.id === alert.id);
        if (idx === -1) return [alert, ...prev];
        const next = [...prev];
        next[idx] = { ...next[idx], ...alert };
        return next;
      });
    },
    [setAlerts]
  );

  return { alerts, setAlerts, upsertAlert };
}

export default useAlerts;
