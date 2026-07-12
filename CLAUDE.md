# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # dev server at http://localhost:3000
npm test           # Jest in watch mode
npm test -- --watchAll=false  # single run, no watch
npm test -- -t "test name"    # run one test by name
npm run build      # production build to /build
```

## Stack

Create React App (react-scripts 5) + React 19. No router, no state manager, no UI library yet — this is a fresh scaffold. ESLint config comes from `react-app` preset (no separate config file).

## Current State

`src/App.js` is the default CRA placeholder. The smarthome domain logic has not been added yet. When building features, start from `src/App.js` and add components under `src/`.
