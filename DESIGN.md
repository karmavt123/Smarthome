---
name: Lumina Home Logic
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#c6c6cd'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#909097'
  outline-variant: '#45464d'
  surface-tint: '#bec6e0'
  primary: '#bec6e0'
  on-primary: '#283044'
  primary-container: '#0f172a'
  on-primary-container: '#798098'
  inverse-primary: '#565e74'
  secondary: '#7bd0ff'
  on-secondary: '#00354a'
  secondary-container: '#00a6e0'
  on-secondary-container: '#00374d'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#001c10'
  on-tertiary-container: '#009365'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#c4e7ff'
  secondary-fixed-dim: '#7bd0ff'
  on-secondary-fixed: '#001e2c'
  on-secondary-fixed-variant: '#004c69'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  gutter: 20px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style
The design system is engineered for the modern smart home—a space where high technology meets domestic tranquility. The brand personality is **Reliable, Futuristic, and Intuitive**, positioning the interface as a silent, high-performance steward of the home environment.

The visual style employs **Glassmorphism** and **Modern Corporate** influences. It utilizes deep, nocturnal backgrounds to reduce eye strain during evening use, paired with vibrant, luminous accents that mimic the physical LEDs of smart hardware. Every interaction should feel responsive and high-fidelity, evoking an emotional response of total control and safety.

Key stylistic pillars:
- **Luminosity:** Elements representing "active" or "powered" states should emit a soft glow.
- **Transparency:** Use frosted glass layers to maintain context of the background while focusing on foreground tasks.
- **Clarity:** Elimination of visual noise to ensure critical data (temperature, security, energy) is readable at a glance.

## Colors
The palette is optimized for a dark-mode-first experience, ensuring the interface recedes into the home environment rather than competing with it.

- **Primary (#0F172A):** The foundation. Used for global backgrounds to provide deep contrast for interactive elements.
- **Secondary/Accent (#38BDF8):** The "Energy" color. Used for active states, toggles, and focus indicators.
- **Success (#10B981):** Indicates active devices, "safe" security status, and optimal energy efficiency.
- **Surface Tiers:** 
  - `Surface-01`: #1E293B (Primary cards/containers)
  - `Surface-02`: #334155 (Hover states/inner nested elements)
- **Alerts:** Use Amber (#F59E0B) for non-critical warnings (e.g., air filter replacement) and Rose (#E11D48) for critical security or safety breaches.

## Typography
This design system utilizes **Inter** for its exceptional legibility and modern, neutral tone. The typographic scale is built to prioritize data visualization and quick-scanning.

- **Headlines:** Use Bold weights with slight negative letter-spacing for a "tight" high-tech feel.
- **Body:** Standard weight is 400. Use 500 for secondary emphasis within paragraphs.
- **Labels:** Small labels use uppercase and slightly increased letter-spacing to distinguish them from interactive data points.
- **Numeric Data:** For temperature or energy readouts, use `display` or `headline-lg` to ensure they dominate the visual hierarchy.

## Layout & Spacing
The layout follows a **Fluid Grid** model to accommodate various device types (wall-mounted tablets, mobile phones, and desktop dashboards).

- **Grid:** A 12-column grid for desktop, 8-column for tablet, and 4-column for mobile.
- **Spacing Philosophy:** Generous padding is applied to all interactive containers to prevent accidental taps on touch screens.
- **Safe Areas:** Ensure a minimum 16px margin on mobile devices to prevent UI elements from touching the bezel.
- **Rhythm:** Use a 4px/8px baseline rhythm for consistent vertical alignment across disparate device cards.

## Elevation & Depth
Depth is created through a mix of **Tonal Layers** and **Glassmorphism** rather than traditional drop shadows.

- **Base Layer:** Deepest blue (#0F172A).
- **Surface Level:** Cards use #1E293B with a subtle 1px border (#334155) to define edges.
- **Glass Effect:** For overlays (modals, dropdowns, navigation bars), use a backdrop-filter blur of `20px` with a semi-transparent background (`#1E293B` at 70% opacity).
- **Active Glow:** Active status elements (like a light being "ON") should use a soft, colored outer glow (`box-shadow`) matching the accent color, with a blur of 12px-20px and 0.3 opacity.

## Shapes
The shape language is modern and friendly, using significant rounding to soften the "high-tech" feel.

- **Primary Cards:** Use `rounded-lg` (16px) for all main device and data containers.
- **Buttons & Inputs:** Use `rounded-md` (8px) for standard controls, but utilize `rounded-full` (pill) for status chips and toggle switches.
- **Icons:** Use line icons with a consistent 2px stroke weight and slightly rounded caps/corners to match the UI's roundedness.

## Components
Consistent styling across components ensures the home feels unified.

- **Device Cards:** The core component. Features a large icon, a primary title (e.g., "Living Room Light"), and a secondary status label (e.g., "70% Brightness"). On hover/active, the border transitions to Cyan and a soft glow appears.
- **Glass Modals:** Used for adjusting granular settings (e.g., RGB color pickers). Must feature a heavy backdrop blur to keep the user oriented within the home dashboard.
- **Buttons:** 
  - *Primary:* Solid Cyan (#38BDF8) with dark text.
  - *Secondary:* Ghost style with Cyan border and text.
- **Toggles:** Use a fluid, pill-shaped track. The "thumb" should animate smoothly, changing the track color from Slate to Cyan upon activation.
- **Status Chips:** Small, high-contrast pills (e.g., "Motion Detected") used at the top of cards or lists.
- **Visual Gauges:** Circular progress bars for temperature and energy usage, utilizing a 4px stroke and gradient transitions from Blue to Green.