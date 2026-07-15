# AI Rules & Tech Stack Guidelines

This document outlines the tech stack, architectural patterns, and library usage rules for the **Aplikasi Manajemen Kelas** (GuruAsisten Pro) application.

## Tech Stack Overview

*   **Frontend Framework:** React 19 (Functional components with Hooks).
*   **Build Tool & Server:** Vite 6+ with TypeScript for fast development and type safety.
*   **Styling:** Tailwind CSS v4 (using `@tailwindcss/vite` integration) for modern, responsive utility-first styling.
*   **Icons:** `lucide-react` for clean, consistent, and lightweight vector icons.
*   **Authentication & Google Integration:** Firebase Auth for Google Sign-In and OAuth token management.
*   **Cloud Storage & Sheets Sync:** Direct REST API integrations with Google Drive and Google Sheets (via `fetch` requests with Bearer tokens) to avoid heavy SDK overhead.
*   **Data Visualization:** Custom, lightweight SVG-based charts (Line and Bar charts) to maintain high performance and avoid heavy external charting libraries.
*   **State Management:** React state hooks (`useState`, `useMemo`, `useEffect`) combined with local storage persistence for offline-first capabilities.

---

## Library & Implementation Rules

### 1. Styling & UI Components
*   **Rule:** Always use Tailwind CSS utility classes for styling. Do not write custom CSS files or inline style objects unless absolutely necessary (e.g., dynamic background colors from user profiles).
*   **Responsive Design:** All components must be fully responsive, supporting mobile drawer menus and scrollable tables on smaller screens.
*   **Icons:** Use `lucide-react` exclusively. Do not install other icon libraries.

### 2. Data Visualization & Charts
*   **Rule:** Do not install heavy charting libraries like Chart.js, Recharts, or ApexCharts.
*   **Implementation:** Always build charts using native SVG elements (`<svg>`, `<rect>`, `<circle>`, `<path>`, `<line>`) styled with Tailwind. This keeps the bundle size small and allows for highly customized, pixel-perfect designs.

### 3. Google Workspace & Cloud Integration
*   **Rule:** Do not use the official Google API Client Library (`gapi` or `gapi-client`).
*   **Implementation:** Use the lightweight REST endpoints via standard `fetch` calls with the OAuth access token obtained from Firebase Google Sign-In. This is implemented in `src/googleDrive.ts`.

### 4. State & Persistence
*   **Rule:** Keep the application offline-first.
*   **Implementation:** Persist all teacher-specific databases (students, attendance, grades, journals, schedules, discipline records) in `localStorage` prefixed with `ga_[teacherId]_`. Sync to Google Drive silently in the background when automatic backup is enabled.

### 5. Component Structure
*   **Rule:** Keep components modular, focused, and under 150 lines of code where possible.
*   **Implementation:** Put pages in `src/pages/` and reusable tab/UI components in `src/components/`.