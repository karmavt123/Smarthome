import { atom } from 'jotai';

// Current environment readings (temperature/humidity/light), keyed by sensor
// type — { value, unit, history }. Synced in from the dashboard fetch so any
// page can read live sensor data instead of keeping its own copy.
export const environmentState = atom({});
