import { create } from 'zustand'

export type ChartPeriod = 'day' | 'week' | 'month' | 'year'

export interface ChartOverlay {
  yesterday: boolean
  lastWeek: boolean
  lastMonth: boolean
  lastYear: boolean
}

interface DashboardState {
  currentPeriod: ChartPeriod
  overlays: ChartOverlay
  setPeriod: (period: ChartPeriod) => void
  toggleOverlay: (overlay: keyof ChartOverlay) => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  currentPeriod: 'day',
  overlays: {
    yesterday: false,
    lastWeek: false,
    lastMonth: false,
    lastYear: false,
  },
  setPeriod: (period) => set({ currentPeriod: period }),
  toggleOverlay: (overlay) =>
    set((state) => ({
      overlays: {
        ...state.overlays,
        [overlay]: !state.overlays[overlay],
      },
    })),
}))
