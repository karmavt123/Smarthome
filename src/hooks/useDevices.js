import { useCallback } from 'react';
import { useAtom } from 'jotai';
import { devicesState } from '~/atoms/deviceAtoms';

// Single source of truth for device data — pages sync fetched devices in via
// setDevices/upsertDevice, everything that renders device state reads `devices`.
function useDevices() {
  const [devices, setDevices] = useAtom(devicesState);

  const upsertDevice = useCallback(
    (device) => {
      if (!device) return;
      setDevices((prev) => {
        const idx = prev.findIndex((d) => d.id === device.id);
        if (idx === -1) return [...prev, device];
        const next = [...prev];
        next[idx] = device;
        return next;
      });
    },
    [setDevices]
  );

  // Partial update for a device already in the store — used by the SSE stream,
  // which only ever sends a status delta, never the full device object.
  const patchDevice = useCallback(
    (id, patch) => {
      setDevices((prev) => {
        const idx = prev.findIndex((d) => d.id === id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        return next;
      });
    },
    [setDevices]
  );

  const removeDevice = useCallback(
    (id) => {
      setDevices((prev) => prev.filter((d) => d.id !== id));
    },
    [setDevices]
  );

  const getDeviceById = useCallback((id) => devices.find((d) => d.id === id), [devices]);

  return { devices, setDevices, upsertDevice, patchDevice, removeDevice, getDeviceById };
}

export default useDevices;
