import { atom } from 'jotai';

// Canonical device list — pages sync into this on fetch, everything that
// renders device data reads from here instead of keeping its own copy.
export const devicesState = atom([]);

// Optimistic action per device id while a command is in flight (e.g. 'turn_on').
export const deviceOptimisticActionsState = atom({});

// Last command error message per device id.
export const deviceErrorsState = atom({});
