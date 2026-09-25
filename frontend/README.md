<div align="center">

# OBSIDIAN

**High-Performance Digital Commerce Engine & Editorial Showcase**

[![Next.js](https://img.shields.io/badge/Next.js-16.0-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-222222?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-222222?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-222222?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-222222?style=flat-square)](LICENSE)

<br />

OBSIDIAN is a full-stack e-commerce architecture pairing an editorial front-of-house with an executive glassmorphic merchant operations hub. Engineered for speed, responsive single-screen oversight, and instant buyer storefront generation.

</div>

---

## Overview

OBSIDIAN delivers a complete commerce workflow across three distinct surfaces:

1. **Merchant Command Center (`/dashboard`)** — A single-screen glassmorphic interface featuring real-time SVG sales analytics, multi-state order handling, inventory telemetry, and quick-action toolkits.
2. **Autonomous Storefronts (`/store/[slug]`)** — Dynamic buyer-facing stores with persistent catalog synchronization, live bag management, and streamlined modal checkout.
3. **Editorial Brand Layer (`/`)** — High-fashion landing experience utilizing Lenis momentum physics, kinetic pointer tracking, and modern typography.

---

## Key Capabilities

### Executive Merchant Operations
* **Viewport-Optimized Layout**: Symmetrical two-column grid engineered to fit standard displays without vertical scroll fatigue.
* **Interactive SVG Analytics**: Pure SVG area charts with dynamic timeframe projections (`Daily`, `Weekly`, `Monthly`, `Yearly`) and inline volume metrics.
* **Order Management**: Inline status toggling (`Pending`, `Processing`, `Completed`, `Shipped`), order deletion, and customer telemetry.
* **Inventory Alerts**: Automatic low-stock detection with one-click quick restocking (`+10 units`).
* **Storefront Hub**: Real-time link generator, clipboard integration, QR code launcher, and sample catalog simulators.

### Dynamic Buyer Experience
* **Automated Routing**: Instant storefront generation via dynamic route parameters (`/store/[slug]`).
* **Cart & Checkout**: Interactive side-drawer cart, real-time total calculations, and integrated customer receipt generation.
* **Responsive Architecture**: Fluid adaptation across desktop, tablet, and mobile displays.

### Performance & Motion
* **Kinetic Interaction**: Physics-based reticle pointer with velocity and directional tracking.
* **Inertial Scrolling**: Integrated Lenis engine providing momentum-based page interpolation.
* **Turbopack Build Pipeline**: Sub-millisecond compilation and fast refresh.

---

## Technology Stack

| Component | Technology | Specification |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 | App Router, Server & Client Components, Turbopack |
| **Language** | TypeScript 5 | Strict type checking and interface contracts |
| **UI Library** | React 19 | Concurrent features and optimized DOM reconciler |
| **Styling** | Vanilla CSS + Tailwind CSS v4 | Glassmorphism, CSS variables, utility tokens |
| **Motion** | Lenis, Framer Motion, GSAP | Inertial scroll physics and kinetic choreography |
| **State Persistence** | LocalStorage API | Synchronous cross-surface state management |

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx             # Root document shell, typography, and metadata
│   ├── page.tsx               # Editorial landing showcase
│   ├── globals.css            # Global design tokens and kinetic cursor styles
│   ├── dashboard/
│   │   ├── page.tsx           # Merchant operations hub (Overview, Orders, Products, Settings)
│   │   └── dashboard.css      # Viewport-fit grid rules and glassmorphic tokens
│   ├── store/[slug]/
│   │   └── page.tsx           # Dynamic customer-facing storefront and checkout
│   └── home/
│       └── page.tsx           # Store onboarding and setup workflow
└── components/
    ├── CustomCursor.tsx       # Kinetic reticle tracking engine
    ├── SmoothScroll.tsx       # Lenis momentum physics provider
    ├── SiteHeader.tsx         # Navigation masthead
    ├── HeroSection.tsx        # Hero presentation layer
    └── SiteFooter.tsx         # Editorial footer
```

---

## Getting Started

### Prerequisites
* Node.js `18.17.0` or later
* npm `9.0.0` or later

### Installation

```bash
# Clone the repository
git clone https://github.com/duttaranit135-cmyk/OBSIDIAN.git

# Enter project directory
cd OBSIDIAN

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be accessible at `http://localhost:3000`.

---

## Application Routes

| Path | Purpose |
| :--- | :--- |
| `/` | Editorial landing showcase |
| `/dashboard` | Merchant operations & analytics center |
| `/store/[slug]` | Customer storefront and checkout flow |
| `/home` | Store creation and onboarding |

---

## Verification & Build

```bash
# Run TypeScript type-checking
npx tsc --noEmit

# Compile production build
npm run build
```

---

## License

This project is licensed under the [MIT License](LICENSE).
