# HandsFree Owner Mobile App

Restaurant analytics and multi-location management app for restaurant owners.

## Features

- **Real-time Analytics Dashboard**
  - Interactive sales charts with Chart.js
  - Period selection (Day/Week/Month/Year)
  - Historical comparisons
  - Key performance metrics

- **Multi-location Management**
  - Switch between locations
  - Aggregated statistics
  - Individual location insights

- **Modern UI**
  - Dark theme with glassmorphism
  - FAB navigation
  - Smooth animations
  - Touch-optimized

## Quick Start

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Build for Android
bun run android:build
```

## Development

### Available Scripts

- `bun run dev` - Start Vite dev server
- `bun run build` - Build for production
- `bun run preview` - Preview production build
- `bun run tauri:dev` - Run Tauri desktop app
- `bun run android:dev` - Run on Android device/emulator
- `bun run android:build` - Build Android APK

### Project Structure

```
src/
├── components/          # React components
│   ├── Dashboard.tsx   # Main dashboard
│   ├── Header.tsx      # App header
│   ├── MetricsGrid.tsx # KPI cards
│   ├── SalesChart.tsx  # Sales chart
│   └── ...
├── stores/             # Zustand stores
│   ├── locationStore.ts
│   └── dashboardStore.ts
├── styles/             # CSS files
└── App.tsx            # Root component
```

## Configuration

### Environment Variables

Create a `.env` file:

```env
VITE_API_URL=https://your-restaurant.workers.dev
VITE_TENANT_ID=your-tenant-id
```

### Tauri Config

See `src-tauri/tauri.conf.json` for app configuration.

## Building for Production

### Android

```bash
# Build APK
bun run android:build

# Output: src-tauri/gen/android/app/build/outputs/apk/
```

### Signing the APK

1. Generate keystore
2. Configure in `src-tauri/gen/android/app/build.gradle.kts`
3. Build signed APK

## Tech Stack

- React 19
- TypeScript
- Zustand (state management)
- Chart.js (charts)
- Lucide React (icons)
- Framer Motion (animations)
- Vite (build tool)
- Tauri v2 (mobile framework)

## License

Copyright © 2026 StonePot Tech
