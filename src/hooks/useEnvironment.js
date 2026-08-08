import { useCallback } from 'react';
import { useAtom } from 'jotai';
import { environmentState } from '~/atoms/sensorAtoms';

// Sparkline/trend only needs a short recent window, not the full reading log.
const MAX_HISTORY = 20;

// Single source of truth for current sensor readings — pages sync fetched
// environment data in via setEnvironment, everything that renders it reads `environment`.
function useEnvironment() {
  const [environment, setEnvironment] = useAtom(environmentState);

  // Partial update for a sensor type already in the store — used by the SSE
  // stream, which only ever sends one new reading, never the full history.
  const patchSensorReading = useCallback(
    (sensorType, { value, capturedAt }) => {
      setEnvironment((prev) => {
        const sensor = prev[sensorType];
        if (!sensor) return prev;
        const history = [...(sensor.history || []), { value, capturedAt }].slice(-MAX_HISTORY);
        return { ...prev, [sensorType]: { ...sensor, value, history } };
      });
    },
    [setEnvironment]
  );

  return { environment, setEnvironment, patchSensorReading };
}

export default useEnvironment;
