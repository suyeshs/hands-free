import { X, Check } from 'lucide-react'
import { useLocationStore } from '../stores/locationStore'
import './LocationSheet.css'

interface LocationSheetProps {
  isOpen: boolean
  onClose: () => void
}

export default function LocationSheet({ isOpen, onClose }: LocationSheetProps) {
  const { currentLocation, locations, setLocation } = useLocationStore()

  const handleLocationSelect = (locationId: string) => {
    setLocation(locationId)
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      <div className="sheet-overlay" onClick={onClose}></div>
      <div className={`location-sheet ${isOpen ? 'open' : ''}`}>
        <div className="sheet-handle"></div>
        <div className="sheet-header">
          <h2 className="sheet-title">Select Location</h2>
          <button className="sheet-close tap-feedback" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        <div className="location-list">
          {Object.values(locations).map((location) => (
            <button
              key={location.id}
              className={`location-option glass tap-feedback ${
                currentLocation === location.id ? 'active' : ''
              }`}
              onClick={() => handleLocationSelect(location.id)}
            >
              <span className="location-option-icon">{location.icon}</span>
              <div className="location-option-info">
                <div className="location-option-name">{location.name}</div>
                <div className="location-option-count">{location.count}</div>
              </div>
              <div className="location-option-stats">
                <div className="location-stat">
                  <span className="stat-value">₹{location.sales.toLocaleString()}</span>
                  <span className="stat-label">Sales</span>
                </div>
                <div className="location-stat">
                  <span className="stat-value">{location.orders}</span>
                  <span className="stat-label">Orders</span>
                </div>
              </div>
              {currentLocation === location.id && (
                <div className="location-check">
                  <Check size={20} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
