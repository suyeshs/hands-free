import { ChevronDown, LogOut } from 'lucide-react'
import { useLocationStore } from '../stores/locationStore'
import { useAuthStore } from '../stores/authStore'
import './Header.css'

interface HeaderProps {
  onLocationClick: () => void
}

export default function Header({ onLocationClick }: HeaderProps) {
  const { currentLocation, locations } = useLocationStore()
  const { tenant, logout } = useAuthStore()
  const location = locations[currentLocation]

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good Morning'
    if (hour < 18) return 'Good Afternoon'
    return 'Good Evening'
  }

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-greeting">
          <h1 className="header-title">{getGreeting()}</h1>
          <p className="header-subtitle">
            {tenant?.tenantName || "Here's what's happening today"}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="location-selector tap-feedback"
            onClick={onLocationClick}
          >
            <span className="location-icon">{location.icon}</span>
            <div className="location-info">
              <span className="location-name">{location.name}</span>
              <span className="location-count">{location.count}</span>
            </div>
            <ChevronDown size={20} className="location-chevron" />
          </button>
          <button
            onClick={logout}
            className="tap-feedback"
            style={{
              padding: '8px',
              background: 'rgba(255, 255, 255, 0.9)',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
            }}
            title="Logout"
          >
            <LogOut size={20} color="#ef4444" />
          </button>
        </div>
      </div>
    </header>
  )
}
