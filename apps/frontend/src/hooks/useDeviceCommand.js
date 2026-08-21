import { useCallback, useRef, useEffect } from 'react';
import { useAtom } from 'jotai';
import deviceService from '~/services/deviceService';
import deviceActionService from '~/services/deviceActionService';
import { deviceOptimisticActionsState, deviceErrorsState } from '~/atoms/deviceAtoms';

const POLL_INTERVAL_MS = 1000;
// Backend's own expiry (device_commands.expiresAt, default 30s) is swept by a
// background job — cap client-side too so a stuck command can't poll forever
// regardless of what the server does.
const MAX_POLL_MS = 35000;
// Rapid repeat clicks (like a Facebook like button) shouldn't fire one command
// per click — only the last click within this window actually dispatches.
const DEBOUNCE_MS = 350;
const TERMINAL_STATUSES = ['executed', 'failed', 'expired'];

// Optimistic device toggle: UI flips instantly on click, the actual
// POST /devices/:id/commands + poll-until-terminal happens in the background.
// Each device tracks a "generation" counter — a new click bumps it, and any
// in-flight poll/dispatch for an older generation silently no-ops once it
// resolves, so only the most recent click's outcome can ever touch the UI.
function useDeviceCommand() {
  const [optimisticActions, setOptimisticActions] = useAtom(deviceOptimisticActionsState);
  const [errors, setErrors] = useAtom(deviceErrorsState);
  const generationRef = useRef({});
  const debounceTimersRef = useRef({});
  const pollTimersRef = useRef({});
  const onSettledRef = useRef({});

  useEffect(() => {
    const debounceTimers = debounceTimersRef.current;
    const pollTimers = pollTimersRef.current;
    return () => {
      Object.values(debounceTimers).forEach(clearTimeout);
      Object.values(pollTimers).forEach(clearTimeout);
    };
  }, []);

  const clearOptimistic = useCallback((deviceId) => {
    setOptimisticActions((prev) => {
      if (!(deviceId in prev)) return prev;
      const next = { ...prev };
      delete next[deviceId];
      return next;
    });
  }, [setOptimisticActions]);

  const setError = useCallback((deviceId, message) => {
    setErrors((prev) => {
      if (message === undefined && !(deviceId in prev)) return prev;
      if (message === undefined) {
        const next = { ...prev };
        delete next[deviceId];
        return next;
      }
      return { ...prev, [deviceId]: message };
    });
  }, [setErrors]);

  const settle = useCallback(
    (deviceId, generation, { ok, message }) => {
      if (generationRef.current[deviceId] !== generation) return; // superseded by a newer click

      // Always drop the optimistic value on settle — on success the next
      // dashboard refresh already reflects it; on failure the real (unchanged)
      // server value should win instead of the guess we showed eagerly.
      clearOptimistic(deviceId);
      setError(deviceId, ok ? undefined : message);
      onSettledRef.current[deviceId]?.(ok);
    },
    [clearOptimistic, setError]
  );

  const poll = useCallback(
    (deviceId, actionId, generation, deadline) => {
      if (generationRef.current[deviceId] !== generation) return;

      if (Date.now() > deadline) {
        settle(deviceId, generation, { ok: false, message: 'Hết thời gian chờ phản hồi từ máy chủ.' });
        return;
      }

      deviceActionService
        .getById(actionId)
        .then((result) => {
          if (generationRef.current[deviceId] !== generation) return;

          if (!TERMINAL_STATUSES.includes(result.status)) {
            pollTimersRef.current[deviceId] = setTimeout(
              () => poll(deviceId, actionId, generation, deadline),
              POLL_INTERVAL_MS
            );
            return;
          }

          if (result.status === 'executed') {
            settle(deviceId, generation, { ok: true });
          } else {
            settle(deviceId, generation, {
              ok: false,
              message:
                result.failureReason ||
                (result.status === 'expired' ? 'Thiết bị không phản hồi.' : 'Lệnh thất bại.'),
            });
          }
        })
        .catch(() => {
          if (generationRef.current[deviceId] !== generation) return;
          settle(deviceId, generation, { ok: false, message: 'Không thể kiểm tra trạng thái lệnh.' });
        });
    },
    [settle]
  );

  const dispatch = useCallback(
    (deviceId, action, generation) => {
      deviceService
        .sendCommand(deviceId, { action })
        .then(({ action: created }) => {
          if (generationRef.current[deviceId] !== generation) return;
          poll(deviceId, created.id, generation, Date.now() + MAX_POLL_MS);
        })
        .catch(() => settle(deviceId, generation, { ok: false, message: 'Không thể gửi lệnh.' }));
    },
    [poll, settle]
  );

  const toggle = useCallback(
    (deviceId, action, { onSettled } = {}) => {
      setOptimisticActions((prev) => ({ ...prev, [deviceId]: action }));
      setError(deviceId, undefined);
      onSettledRef.current[deviceId] = onSettled;

      const generation = (generationRef.current[deviceId] || 0) + 1;
      generationRef.current[deviceId] = generation;

      clearTimeout(debounceTimersRef.current[deviceId]);
      clearTimeout(pollTimersRef.current[deviceId]);
      debounceTimersRef.current[deviceId] = setTimeout(() => {
        dispatch(deviceId, action, generation);
      }, DEBOUNCE_MS);
    },
    [dispatch, setError, setOptimisticActions]
  );

  const getOptimisticAction = useCallback((deviceId) => optimisticActions[deviceId], [optimisticActions]);
  const errorFor = useCallback((deviceId) => errors[deviceId], [errors]);

  return { toggle, getOptimisticAction, errorFor };
}

export default useDeviceCommand;
