// API Service for Owner Mobile App

export interface Restaurant {
  id: string
  name: string
  location: string
  address?: string
}

export interface DashboardMetrics {
  totalSales: number
  orders: number
  activeStaff: number
  avgWaitTime: number
  salesChange: number
  ordersChange: number
  staffChange: number
  waitTimeChange: number
}

export interface SalesDataPoint {
  time: string
  value: number
}

export interface Activity {
  id: string
  type: 'sale' | 'order' | 'staff' | 'alert'
  message: string
  timestamp: string
  location?: string
}

class APIService {
  private apiUrl: string | null = null;
  private tenantId: string | null = null;

  // Set API URL from auth store
  setApiUrl(url: string, tenantId: string) {
    this.apiUrl = url;
    this.tenantId = tenantId;
    console.log('API Service configured:', { apiUrl: url, tenantId: this.tenantId });
  }

  // Fetch restaurants/locations
  async getRestaurants(): Promise<Restaurant[]> {
    if (!this.apiUrl) {
      console.warn('API URL not set, using mock data');
      return this.getMockRestaurants();
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/locations`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.locations || this.getMockRestaurants();
    } catch (error) {
      console.warn('Failed to fetch restaurants from API:', error);
      return this.getMockRestaurants();
    }
  }

  // Fetch dashboard metrics for a specific location
  async getDashboardMetrics(locationId: string = 'all'): Promise<DashboardMetrics> {
    if (!this.apiUrl) {
      console.warn('API URL not set, using mock data');
      return this.getMockMetrics(locationId);
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/analytics/dashboard?location=${locationId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.metrics || this.getMockMetrics(locationId);
    } catch (error) {
      console.warn('Failed to fetch metrics from API:', error);
      return this.getMockMetrics(locationId);
    }
  }

  // Fetch sales data for charts
  async getSalesData(
    locationId: string = 'all',
    period: 'day' | 'week' | 'month' | 'year' = 'day'
  ): Promise<SalesDataPoint[]> {
    if (!this.apiUrl) {
      console.warn('API URL not set, using mock data');
      return this.getMockSalesData(period);
    }

    try {
      const response = await fetch(
        `${this.apiUrl}/api/analytics/sales?location=${locationId}&period=${period}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.salesData || this.getMockSalesData(period);
    } catch (error) {
      console.warn('Failed to fetch sales data from API:', error);
      return this.getMockSalesData(period);
    }
  }

  // Fetch recent activities
  async getActivities(locationId: string = 'all', limit: number = 10): Promise<Activity[]> {
    if (!this.apiUrl) {
      console.warn('API URL not set, using mock data');
      return this.getMockActivities();
    }

    try {
      const response = await fetch(
        `${this.apiUrl}/api/analytics/activities?location=${locationId}&limit=${limit}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.activities || this.getMockActivities();
    } catch (error) {
      console.warn('Failed to fetch activities from API:', error);
      return this.getMockActivities();
    }
  }

  // Fallback/Mock Data Methods
  private getMockRestaurants(): Restaurant[] {
    return [
      { id: 'mg-road', name: 'MG Road', location: 'Bangalore' },
      { id: 'indiranagar', name: 'Indiranagar', location: 'Bangalore' },
      { id: 'koramangala', name: 'Koramangala', location: 'Bangalore' }
    ]
  }

  private getMockMetrics(locationId: string): DashboardMetrics {
    const metricsData: Record<string, DashboardMetrics> = {
      all: {
        totalSales: 83200,
        orders: 298,
        activeStaff: 26,
        avgWaitTime: 12,
        salesChange: 12.5,
        ordersChange: 8.2,
        staffChange: 2,
        waitTimeChange: -15
      },
      'mg-road': {
        totalSales: 45800,
        orders: 142,
        activeStaff: 12,
        avgWaitTime: 10,
        salesChange: 15.3,
        ordersChange: 10.1,
        staffChange: 1,
        waitTimeChange: -12
      },
      indiranagar: {
        totalSales: 28400,
        orders: 98,
        activeStaff: 8,
        avgWaitTime: 14,
        salesChange: 8.7,
        ordersChange: 5.3,
        staffChange: 0,
        waitTimeChange: -18
      },
      koramangala: {
        totalSales: 9000,
        orders: 58,
        activeStaff: 6,
        avgWaitTime: 13,
        salesChange: 11.2,
        ordersChange: 9.8,
        staffChange: 1,
        waitTimeChange: -16
      }
    }
    return metricsData[locationId] || metricsData.all
  }

  private getMockSalesData(_period: string): SalesDataPoint[] {
    const hours = 24
    const data: SalesDataPoint[] = []

    for (let i = 0; i < hours; i++) {
      const hour = i.toString().padStart(2, '0') + ':00'
      const baseValue = 3200 + Math.random() * 1000
      const timeMultiplier = i >= 11 && i <= 14 ? 1.3 : i >= 18 && i <= 21 ? 1.5 : 0.8
      data.push({
        time: hour,
        value: Math.round(baseValue * timeMultiplier)
      })
    }

    return data
  }

  private getMockActivities(): Activity[] {
    return [
      {
        id: '1',
        type: 'sale',
        message: 'New order #1847 - ₹1,240',
        timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
        location: 'MG Road'
      },
      {
        id: '2',
        type: 'order',
        message: 'Order #1846 completed',
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        location: 'Indiranagar'
      },
      {
        id: '3',
        type: 'staff',
        message: 'Rajesh Kumar clocked in',
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        location: 'Koramangala'
      },
      {
        id: '4',
        type: 'sale',
        message: 'New order #1845 - ₹890',
        timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
        location: 'MG Road'
      },
      {
        id: '5',
        type: 'alert',
        message: 'Low inventory alert: Tomatoes',
        timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
        location: 'Indiranagar'
      }
    ]
  }
}

export const apiService = new APIService()
