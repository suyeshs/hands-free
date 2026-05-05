import { TrendingUp, ShoppingBag, Users, Clock } from 'lucide-react'
import { useLocationStore } from '../stores/locationStore'
import './MetricsGrid.css'

export default function MetricsGrid() {
  const { currentLocation, locations } = useLocationStore()
  const location = locations[currentLocation]
  const metrics = location?.metrics

  const metricCards = [
    {
      icon: <TrendingUp size={24} />,
      label: 'Total Sales',
      value: `₹${location?.sales?.toLocaleString() || '0'}`,
      change: metrics?.salesChange ? `${metrics.salesChange > 0 ? '+' : ''}${metrics.salesChange}%` : '+0%',
      isPositive: (metrics?.salesChange || 0) >= 0,
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    {
      icon: <ShoppingBag size={24} />,
      label: 'Orders',
      value: location?.orders?.toString() || '0',
      change: metrics?.ordersChange ? `${metrics.ordersChange > 0 ? '+' : ''}${metrics.ordersChange}%` : '+0%',
      isPositive: (metrics?.ordersChange || 0) >= 0,
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    },
    {
      icon: <Users size={24} />,
      label: 'Active Staff',
      value: location?.staff?.toString() || '0',
      change: metrics?.staffChange ? `${metrics.staffChange > 0 ? '+' : ''}${metrics.staffChange}` : '+0',
      isPositive: (metrics?.staffChange || 0) >= 0,
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
    },
    {
      icon: <Clock size={24} />,
      label: 'Avg Wait Time',
      value: `${metrics?.avgWaitTime || 0} min`,
      change: metrics?.waitTimeChange ? `${metrics.waitTimeChange > 0 ? '+' : ''}${metrics.waitTimeChange}%` : '0%',
      isPositive: (metrics?.waitTimeChange || 0) <= 0, // Lower wait time is positive
      gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
    }
  ]

  return (
    <div className="page-section">
      <div className="metrics-grid">
        {metricCards.map((metric, index) => (
          <div key={index} className="metric-card glass tap-feedback">
            <div className="metric-icon" style={{ background: metric.gradient }}>
              {metric.icon}
            </div>
            <div className="metric-content">
              <div className="metric-label">{metric.label}</div>
              <div className="metric-value">{metric.value}</div>
              <div className={`metric-change ${metric.isPositive ? 'positive' : 'negative'}`}>
                {metric.change}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
