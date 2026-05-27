import './ModeSelector.css'

type AppMode = 'staff' | 'manager' | 'orders'

interface ModeSelectorProps {
  currentMode: AppMode
  onModeChange: (mode: AppMode) => void
}

export default function ModeSelector({ currentMode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="mode-selector-container">
      <div className="mode-selector glass">
        <button
          className={`mode-btn tap-feedback ${currentMode === 'staff' ? 'active' : ''}`}
          onClick={() => onModeChange('staff')}
        >
          Staff
        </button>
        <button
          className={`mode-btn tap-feedback ${currentMode === 'orders' ? 'active' : ''}`}
          onClick={() => onModeChange('orders')}
        >
          Orders
        </button>
        <button
          className={`mode-btn tap-feedback ${currentMode === 'manager' ? 'active' : ''}`}
          onClick={() => onModeChange('manager')}
        >
          Manager
        </button>
      </div>
    </div>
  )
}
