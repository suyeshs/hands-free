import { create } from 'zustand'
import { apiService, DashboardMetrics } from '../services/api'

export interface Location {
  id: string
  name: string
  icon: string
  count: string
  sales: number
  orders: number
  staff: number
  metrics?: DashboardMetrics
}

interface LocationState {
  currentLocation: string
  locations: Record<string, Location>
  isLoading: boolean
  setLocation: (locationId: string) => void
  loadRestaurants: () => Promise<void>
  loadMetrics: (locationId: string) => Promise<void>
}

export const useLocationStore = create<LocationState>((set, get) => ({
  currentLocation: 'all',
  isLoading: false,
  locations: {
    'all': {
      id: 'all',
      name: 'All Locations',
      icon: '🏢',
      count: '3 restaurants',
      sales: 83200,
      orders: 298,
      staff: 26
    }
  },
  setLocation: (locationId) => {
    set({ currentLocation: locationId })
    get().loadMetrics(locationId)
  },
  loadRestaurants: async () => {
    set({ isLoading: true })
    try {
      const restaurants = await apiService.getRestaurants()
      const locations: Record<string, Location> = {
        'all': {
          id: 'all',
          name: 'All Locations',
          icon: '🏢',
          count: `${restaurants.length} restaurants`,
          sales: 0,
          orders: 0,
          staff: 0
        }
      }

      for (const restaurant of restaurants) {
        locations[restaurant.id] = {
          id: restaurant.id,
          name: restaurant.name,
          icon: '📍',
          count: restaurant.location,
          sales: 0,
          orders: 0,
          staff: 0
        }
      }

      set({ locations })

      // Load metrics for current location
      get().loadMetrics(get().currentLocation)
    } catch (error) {
      console.error('Failed to load restaurants:', error)
    } finally {
      set({ isLoading: false })
    }
  },
  loadMetrics: async (locationId: string) => {
    try {
      const metrics = await apiService.getDashboardMetrics(locationId)
      const { locations } = get()

      if (locations[locationId]) {
        set({
          locations: {
            ...locations,
            [locationId]: {
              ...locations[locationId],
              sales: metrics.totalSales,
              orders: metrics.orders,
              staff: metrics.activeStaff,
              metrics
            }
          }
        })
      }
    } catch (error) {
      console.error('Failed to load metrics:', error)
    }
  }
}))
