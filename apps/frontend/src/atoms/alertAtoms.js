import { atom } from 'jotai';

// Canonical alert list for the current home — pages sync into this on fetch,
// everything that renders alert data reads from here instead of keeping its
// own copy.
export const alertsState = atom([]);
