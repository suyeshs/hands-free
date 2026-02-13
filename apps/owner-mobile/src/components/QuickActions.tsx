import { BarChart3, Menu, Users, Settings } from 'lucide-react'
import './QuickActions.css'

export default function QuickActions() {
  const actions = [
    { icon: <BarChart3 size={24} />, label: 'Analytics', color: '#667eea' },
    { icon: <Menu size={24} />, label: 'Menu', color: '#f093fb' },
    { icon: <Users size={24} />, label: 'Staff', color: '#4facfe' },
    { icon: <Settings size={24} />, label: 'Settings', color: '#43e97b' }
  ]

  return (
    <div className="page-section">
      <h2 className="section-title">Quick Actions</h2>
      <div className="quick-actions">
        {actions.map((action, index) => (
          <button key={index} className="action-card glass tap-feedback">
            <div className="action-icon" style={{ color: action.color }}>
              {action.icon}
            </div>
            <span className="action-label">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
