import { useState, useEffect } from 'react'
import StaffMode from './components/StaffMode'
import ManagerMode from './components/ManagerMode'
import FABMenu from './components/FABMenu'
import ModeSelector from './components/ModeSelector'
import DeviceRegistration from './components/DeviceRegistration'
import BiometricLogin from './components/BiometricLogin'
import { useDeviceAuthStore } from './stores/deviceAuthStore'
import { useAttendanceStore } from './stores/attendanceStore'
import { initializeDatabase, isDatabaseInitialized } from './lib/database'
import './App.css'

type AppMode = 'staff' | 'manager'

function App() {
  const [showFAB, setShowFAB] = useState(false)
  const [currentMode, setCurrentMode] = useState<AppMode>('staff')
  const [dbInitialized, setDbInitialized] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)

  const {
    isAuthenticated,
    isDeviceRegistered,
    registeredStaffId,
    registeredTenantId,
    checkDeviceRegistration
  } = useDeviceAuthStore()
  const { loadTodayAttendance } = useAttendanceStore()

  // Initialize database and check device registration on startup
  useEffect(() => {
    async function init() {
      try {
        console.log('[App] Initializing database...')

        // Check if already initialized
        const isInit = await isDatabaseInitialized()

        if (!isInit) {
          console.log('[App] Database not initialized, creating schema...')
          await initializeDatabase()
        } else {
          console.log('[App] Database already initialized')
        }

        setDbInitialized(true)

        // Check device registration after DB is ready
        await checkDeviceRegistration()
      } catch (error) {
        console.error('[App] Database initialization failed:', error)
        setDbError(error instanceof Error ? error.message : 'Database initialization failed')
      }
    }

    init()
  }, [checkDeviceRegistration])

  // Load today's attendance when user authenticates
  useEffect(() => {
    if (isAuthenticated && registeredStaffId && registeredTenantId && dbInitialized) {
      console.log('[App] Loading today attendance for staff:', registeredStaffId)
      loadTodayAttendance(registeredStaffId, registeredTenantId).catch((error) => {
        console.error('[App] Failed to load today attendance:', error)
      })
    }
  }, [isAuthenticated, registeredStaffId, registeredTenantId, dbInitialized, loadTodayAttendance])

  // Show error if database initialization failed
  if (dbError) {
    return (
      <div className="app error-screen">
        <div className="error-container">
          <h1>Database Error</h1>
          <p>{dbError}</p>
          <button onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Show loading while database initializes
  if (!dbInitialized) {
    return (
      <div className="app loading-screen">
        <div className="loading-spinner"></div>
        <p>Initializing...</p>
      </div>
    )
  }

  // Show device registration if device is not registered
  if (!isDeviceRegistered) {
    return <DeviceRegistration />
  }

  // Show biometric login if registered but not authenticated
  if (!isAuthenticated) {
    return <BiometricLogin />
  }

  // Show main app
  return (
    <div className="app">
      <ModeSelector onModeChange={setCurrentMode} currentMode={currentMode} />

      {currentMode === 'staff' ? <StaffMode /> : <ManagerMode />}

      <FABMenu
        isOpen={showFAB}
        onToggle={() => setShowFAB(!showFAB)}
      />
    </div>
  )
}

export default App
