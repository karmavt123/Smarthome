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

Create React App (react-scripts 5) + React 19. No state manager, no UI library yet. ESLint config comes from `react-app` preset (no separate config file).

**Routing:** React Router v7 (`react-router-dom`). `BrowserRouter` wraps `<App>` in `src/index.js`. Routes defined in `App.js` using nested `Routes` / `Route`. Layout routes use `<Outlet>`.

**Styling:**
- **Tailwind CSS v4** — `postcss.config.js` uses `@tailwindcss/postcss`. Directives loaded via `@import "tailwindcss"` at top of `src/index.css`. No `tailwind.config.js` — v4 is CSS-first.
- **SCSS** — use `.scss` / `.module.scss` extensions, CRA compiles automatically. Global variables in `src/styles/_variables.scss`.

## Folder Structure & Conventions

```
src/
├── assets/        # static files: images, fonts, icons
├── components/    # reusable UI components with no business logic (Button, Card, Modal...)
├── layouts/       # page shell components that wrap <Outlet> (MainLayout, AuthLayout...)
├── pages/         # one file per route — equivalent to Vue's views/ (HomePage, LoginPage...)
├── hooks/         # custom React hooks (useDevices, useAuth...)
├── services/      # API call functions, grouped by domain (deviceService.js, authService.js)
├── utils/         # pure helper functions with no React deps
├── styles/        # global SCSS: _variables.scss, _mixins.scss
├── App.js         # route tree only — no UI logic here
└── index.js       # ReactDOM.render + BrowserRouter only
```

**Naming rules:**
- Components, layouts, pages: `PascalCase.js`
- Hooks: `camelCase.js`, prefix `use` (e.g. `useDevices.js`)
- Services & utils: `camelCase.js` (e.g. `deviceService.js`)
- SCSS partials: `_camelCase.scss`

**Routing pattern** — add a new page:
1. Create `src/pages/FooPage.js`
2. Add `<Route path="/foo" element={<FooPage />} />` inside the layout route in `App.js`

**Component vs Page distinction:**
- `pages/` knows about routes and business data — calls hooks/services directly
- `components/` is pure UI — receives props only, no service/hook calls inside

**API layer:**
- `src/services/apiClient.js` — singleton `ApiClient` bọc axios. Tự gắn Bearer token từ `localStorage`. Auto redirect `/login` khi 401.
- Base URL lấy từ `REACT_APP_API_URL` trong `.env` (mặc định `http://localhost:8000/api`).
- Tạo service mới: copy pattern `deviceService.js` — object chứa các method gọi `apiClient.get/post/put/patch/delete`.
