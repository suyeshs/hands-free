import './ModeSelector.css'

interface ModeSelectorProps {
  currentMode: 'staff' | 'manager'
  onModeChange: (mode: 'staff' | 'manager') => void
}

export default function ModeSelector({ currentMode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="mode-selector-container">
      <div className="mode-selector glass">
        <button
          className={`mode-btn tap-feedback ${currentMode === 'staff' ? 'active' : ''}`}
          onClick={() => onModeChange('staff')}
        >
          Staff Mode
        </button>
        <button
          className={`mode-btn tap-feedback ${currentMode === 'manager' ? 'active' : ''}`}
          onClick={() => onModeChange('manager')}
        >
          Manager Mode
        </button>
      </div>
    </div>
  )
}
