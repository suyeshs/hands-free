import { ShoppingBag, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'
import './ActivityFeed.css'

export default function ActivityFeed() {
  const activities = [
    {
      icon: <ShoppingBag size={20} />,
      title: 'New order received',
      description: 'Table 12 - ₹1,240',
      time: '2 min ago',
      color: '#667eea'
    },
    {
      icon: <TrendingUp size={20} />,
      title: 'Sales milestone reached',
      description: 'Crossed ₹80,000 today',
      time: '15 min ago',
      color: '#43e97b'
    },
    {
      icon: <AlertCircle size={20} />,
      title: 'Low stock alert',
      description: 'Paneer needs restock',
      time: '1 hour ago',
      color: '#f59e0b'
    },
    {
      icon: <CheckCircle size={20} />,
      title: 'Staff clocked in',
      description: 'Rajesh Kumar started shift',
      time: '2 hours ago',
      color: '#4facfe'
    }
  ]

  return (
    <div className="page-section">
      <h2 className="section-title">Recent Activity</h2>
      <div className="activity-feed">
        {activities.map((activity, index) => (
          <div key={index} className="activity-item glass tap-feedback">
            <div className="activity-icon" style={{ color: activity.color }}>
              {activity.icon}
            </div>
            <div className="activity-content">
              <div className="activity-title">{activity.title}</div>
              <div className="activity-description">{activity.description}</div>
            </div>
            <div className="activity-time">{activity.time}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
