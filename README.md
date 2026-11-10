# CorridorPulse — Live Commute Traffic Jam Alerter & Bypass Advisor

**CorridorPulse** is a real-time commute telemetry, incident alerting, and route-comparison dashboard built for high-congestion urban corridors (defaulting to **Sompura Gate → Zetwerk Bellandur Office** in Bengaluru, with full support for custom origins and destinations).

---

## Key Features

- **Customizable Origin & Destination Picker**
  - Select from curated East/South-East Bengaluru tech-corridor presets or search any address using **Google Maps Places Autocomplete (New)** (`PlaceAutocompleteElement`).
  - Swap endpoints (`⇄`), use browser geolocation (`Use My GPS`), or reset to the default **Sompura Gate → Zetwerk Bellandur Office** corridor.

- **Interactive Google Maps Corridor & Traffic Layer**
  - Live route geometry fetched via the **Google Maps Routes API v2** (`computeRoutes`), with deterministic multi-route fallback when offline or without an API key.
  - Toggleable **Google Maps `TrafficLayer`** and **Route Congestion Heatmap** (`CLEAR`, `MODERATE`, `HEAVY`, `SEVERE` choke-point segments).
  - Interactive incident pins for accidents, construction zones, bottlenecks, and weather slowdowns.

- **Active Commute Live Tracker & Landmark Mini-Timeline**
  - **Start Commute** mode tracks trip completion (`0% – 100%`) with real-time GPS or 1x / 5x / 15x simulation speed controls.
  - **Live Travel Time Deviation** compares actual projected travel time against the initial baseline estimate (`+Xm slower`, `-Xm faster`, or `On schedule`).
  - **Landmark Mini-Timeline Visualizer** displays 5 major checkpoints along the selected route (`PASSED`, `NEXT`, `UPCOMING`) with predicted remaining minutes and arrival clock times (`HH:MM AM/PM`).
  - **One-Click Share (`Share`)** copies a formatted summary containing the shareable route URL, Google Maps navigation link, expected arrival time, and active incident alerts to the clipboard.

- **5-Column KPI Telemetry Strip**
  1. **Estimated Travel Time** (with baseline delta & threshold status)
  2. **Recommended Route** (fastest corridor & time savings vs. primary)
  3. **Active Corridor Jam / Incident Count** (severity breakdown)
  4. **Departure Window & Alert Threshold** (customizable target departure time & notification trigger)
  5. **Est. Fuel & Trip Cost** (calculated from route distance, congestion multiplier, and selectable **Car — Petrol**, **2-Wheeler**, or **EV** efficiency profiles)

- **Live Weather Conditions & Rain-Slowdown Overlay**
  - Fetches real-time temperature, precipitation, wind speed, visibility, and WMO weather codes via the **Open-Meteo API** for the corridor midpoint.
  - Includes scenario presets (**Live API**, **Dry & Clear**, **Moderate Rain**, **Heavy Downpour**) that dynamically apply rain-induced delay multipliers and inject weather slowdown alerts onto the map and incident feed.

- **Commute History Analytics (Recharts)**
  - Visualizes **Weekly Traffic Trends** (Mon–Sun actual vs. baseline travel times and delay minutes) and **Common Delay Times** across peak morning/evening departure windows.

- **Web Push / Desktop Notification Alerts**
  - Triggers an in-app and browser Notification API alert whenever the estimated travel time exceeds the user's configured threshold for their saved departure window, including a one-click **Switch to Fastest Bypass** action.

- **Global Dark Mode**
  - High-contrast light and dark theme toggle (`dark` class on `<html>`) persisted in `localStorage`, updating all telemetry cards, charts, and map overlays.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide React
- **Maps & Geospatial**: `@vis.gl/react-google-maps`, Google Maps JavaScript API, Places API (New), Routes API v2
- **Data Visualization**: Recharts
- **Weather Telemetry**: Open-Meteo Forecast API
- **Build & Tooling**: Vite, TypeScript (`tsc`), Node test runner (`node:test` via `tsx`)

---

## Getting Started

### 1. Prerequisites
- **Node.js** 20+ (or Bun / npm)
- A **Google Maps Platform API Key** with the following APIs enabled (optional — the app includes full deterministic corridor geometry and telemetry fallback if no key is configured):
  - Maps JavaScript API
  - Places API (New)
  - Routes API

### 2. Environment Variables
Copy `.env.example` to `.env` and configure your keys:

```bash
cp .env.example .env
```

```env
# Google Maps Platform API Key for Maps JS, Places (New), and Routes APIs
VITE_GOOGLE_MAPS_API_KEY="YOUR_GOOGLE_MAPS_API_KEY"
```

### 3. Install & Run Locally

```bash
# Install dependencies
npm install

# Start the development server on http://localhost:3000
npm run dev
```

---

## Verification & Testing

Run the unit test suite for corridor telemetry, route ranking, fuel/cost estimation, landmark ETA projection, and clipboard share formatting:

```bash
npx tsx --test src/utils/trafficLogic.test.ts
```

Type-check and build for production:

```bash
npm run lint
npm run build
```

---

## Project Structure

```text
├── src/
│   ├── components/
│   │   ├── ActiveCommuteTrackerBar.tsx      # Live commute progress, deviation, landmark timeline & Share action
│   │   ├── CommuteHistoryPanel.tsx          # Recharts weekly traffic trends & delay window analytics
│   │   ├── CorridorMap.tsx                  # Google Map, Routes API v2 polylines, TrafficLayer & incident pins
│   │   ├── DesktopPushNotificationPopup.tsx # Threshold breach notification banner & browser push mock
│   │   ├── RouteEndpointsPicker.tsx         # Origin/Destination preset selector & Google Places Autocomplete
│   │   └── WeatherConditionsWidget.tsx      # Open-Meteo live weather & rain slowdown simulator
│   ├── data/
│   │   └── corridorData.ts                  # Corridor presets, routes, segments, incidents & historical baselines
│   ├── types/
│   │   └── traffic.ts                       # TypeScript interfaces for routes, telemetry, weather & incidents
│   ├── utils/
│   │   ├── trafficLogic.ts                  # Pure calculation functions for ETAs, fuel cost, landmarks & sharing
│   │   └── trafficLogic.test.ts             # Unit tests (node:test)
│   ├── App.tsx                              # Main dashboard layout, KPI strip, state & theme management
│   ├── index.css                            # Tailwind CSS v4 styles & dark mode overrides
│   └── main.tsx                             # Application entry point & global GMP quota error handler
├── index.html
├── metadata.json
└── package.json
```
