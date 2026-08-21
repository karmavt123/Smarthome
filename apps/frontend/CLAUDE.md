# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Start of session:** read `DATABASE.md` before writing any form, service, or data-shaped UI, and `AUTH.md` before touching anything auth-related (login/register/logout, tokens, protected routes). These are the source of truth for what data/endpoints actually exist — cross-check any form field, mock data field, or API payload assumption against them before building.

## Commands

Requires Node.js >= 20 (`.nvmrc` pins `20`) — run `nvm use` before anything else. Older Node (e.g. 16/18) fails `npm run build` with `crypto$2.getRandomValues is not a function` since Vite 6 needs `Node`'s Web Crypto API.

```bash
nvm use             # switch to the pinned Node version first
npm start          # dev server at http://localhost:8000
npm test           # Vitest in watch mode
npm test -- run    # single run, no watch
npm test -- -t "test name"    # run one test by name
npm run build      # production build to /dist
npm run preview    # preview production build locally
```

## Stack

Vite 6 + React 19. No state manager, no UI library yet. ESLint config lives in `.eslintrc.js` (plain `eslint:recommended` + React/React Hooks plugins — no `react-app` preset). Entry HTML is `index.html` at repo root (not `public/`), which loads `src/index.js` as a module. Vite config (aliases, dev server port, Vitest settings) lives in `vite.config.js`. Env vars exposed to client code must be prefixed `VITE_` (not `REACT_APP_`) and read via `import.meta.env.VITE_*` (not `process.env`).

**Routing:** React Router v7 (`react-router-dom`). `BrowserRouter` wraps `<App>` in `src/index.js`. Routes defined in `App.js` using nested `Routes` / `Route`. Layout routes use `<Outlet>`.

**Always use `src/hooks/useRouter.js` instead of raw `react-router-dom` hooks.** Never call `useNavigate`, `useLocation`, `useParams`, or `useSearchParams` directly outside of `useRouter.js` itself. `useRouter()` returns `{ navigate, path, params, queryParams, searchParams, setSearchParams, location, goBack, goForward }` — one hook, one import, for both pages and layouts.

**Styling:**
- **Tailwind CSS v4** — `postcss.config.js` uses `@tailwindcss/postcss`. Directives loaded via `@import "tailwindcss"` at top of `src/index.css`. No `tailwind.config.js` — v4 is CSS-first.
- **SCSS** — use `.scss` / `.module.scss` extensions, CRA compiles automatically. Global variables in `src/styles/_variables.scss`.

## Folder Structure & Conventions

```
src/
├── assets/        # static files: images, fonts, icons
├── components/    # reusable UI components with no business logic (Button, Card, Modal...)
├── contexts/      # React Context providers (AuthContext...) — components that hold app-wide state
├── layouts/       # page shell components that wrap <Outlet> (MainLayout, AuthLayout...)
├── pages/         # one file per route — equivalent to Vue's views/ (HomePage, LoginPage...)
├── hooks/         # custom React hooks (useDevices, useAuth, useRouter...)
├── services/      # API call functions, grouped by domain (deviceService.js, authService.js)
├── utils/         # pure helper functions with no React deps
├── styles/        # global SCSS: _variables.scss, _mixins.scss
├── App.js         # route tree only — no UI logic here
└── index.js       # ReactDOM.render + BrowserRouter + AuthProvider
```

**Naming rules:**
- Components, layouts, pages: `PascalCase.js`
- Hooks: `camelCase.js`, prefix `use` (e.g. `useDevices.js`)
- Services & utils: `camelCase.js` (e.g. `deviceService.js`)
- SCSS partials: `_camelCase.scss`

**One component per file:**
- Every file exports exactly one component. No inline sub-components defined inside a page/layout file, even small presentational ones used only once.
- If a page needs a sub-component (a card, a form, a list item), extract it to `src/components/SubComponentName.js` and import it.
- Exception: tiny local helpers that render no markup of their own (pure data/formatting functions) can stay in the same file.

**Routing pattern** — add a new page:
1. Create `src/pages/FooPage.js`
2. Add `<Route path="/foo" element={<FooPage />} />` inside the layout route in `App.js`

**Component vs Page distinction:**
- `pages/` knows about routes and business data — calls hooks/services directly
- `components/` is pure UI — receives props only, no service/hook calls inside

**API layer:**
- `src/services/apiClient.js` — singleton `ApiClient` bọc axios. Access token giữ in-memory (`this.accessToken`, không lưu localStorage — tránh XSS theo `AUTH.md`), tự gắn `Authorization: Bearer`. Refresh token lưu `localStorage` (key `refreshToken`), tự động refresh-and-retry một lần khi gặp 401 (bỏ qua request tới chính `/auth/*` để tránh loop); nếu refresh thất bại thì `clearTokens()` + gọi `onUnauthorized` callback (do `AuthContext` set) để dọn state phía app.
- Base URL lấy từ `VITE_API_URL` trong `.env` (mặc định `http://localhost:8000/api`).
- Tạo service mới: copy pattern `deviceService.js` — object chứa các method gọi `apiClient.get/post/put/patch/delete`.
- **Case convention:** backend tự xử lý convert `snake_case` ⟷ `camelCase` ở middleware — FE gửi/nhận thuần `camelCase`, không cần (và không được) tự convert case ở đâu cả. Không dùng `humps` hay bất kỳ lib convert case nào ở frontend.

**Auth flow** (xem chi tiết endpoint ở `AUTH.md`):
- `src/contexts/AuthContext.js` (`AuthProvider`) + `src/hooks/useAuth.js` — nguồn sự thật duy nhất cho `user`, `isAuthenticated`, `isLoading` (đang bootstrap session lúc reload), và `login`/`signUp`/`logout`. Luôn dùng `useAuth()`, không tự đọc token/localStorage ở nơi khác.
- Bootstrap lúc reload: nếu có `refreshToken` trong `localStorage` → gọi `/auth/refresh-token` để lấy `accessToken` mới, khôi phục `user` đã cache ở `localStorage` (key `authUser`, chỉ cache profile không nhạy cảm — không phải token). Effect này có guard `useRef` chống chạy 2 lần do React StrictMode (refresh token dùng 1 lần, chạy 2 lần sẽ tự xóa mất session vừa tạo) — không được bỏ guard này.
- **Route guard nằm ngay trong layout, không phải component riêng:** `MainLayout` — nếu `isAuthenticated === false` thì `<Navigate to="/dang-nhap?next=<path hiện tại>" replace />`; `AuthLayout` (`/dang-nhap`, `/dang-ky`, `/quen-mat-khau`) — nếu `isAuthenticated === true` thì đọc `next` từ `useRouter().queryParams.next` và `<Navigate to={next || '/'} replace />`. Cả hai chờ `isLoading` xong trước khi quyết định, tránh redirect nhầm lúc đang bootstrap.
- **Không tự gọi `navigate()` sau khi `login`/`signUp` thành công ở page** — `AuthLayout` là nơi DUY NHẤT quyết định điều hướng sau khi `isAuthenticated` đổi. Gọi thêm `navigate()` ở page sẽ đua với guard này và có thể ghi đè `next` (đã từng là bug thật, xem git history `LoginPage.js`).
