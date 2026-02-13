import { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import FABMenu from './components/FABMenu'
import LocationSheet from './components/LocationSheet'
import { DeviceRegistrationFlow } from './components/auth/DeviceRegistrationFlow'
import { useLocationStore } from './stores/locationStore'
import { useAuthStore } from './stores/authStore'
import { getDeviceInfo } from './utils/deviceInfo'
import { apiService } from './services/api'
import { Loader2 } from 'lucide-react'

function App() {
  const [showFAB, setShowFAB] = useState(false)
  const [showLocationSheet, setShowLocationSheet] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const { loadRestaurants, loadMetrics } = useLocationStore()
  const { isAuthenticated, deviceToken, setAuth } = useAuthStore()

  // Auto-login with device token on app start
  useEffect(() => {
    const attemptAutoLogin = async () => {
      // Check if we have a device token
      const storedDeviceToken = localStorage.getItem('deviceToken') || deviceToken

      if (!storedDeviceToken) {
        setIsCheckingAuth(false)
        return
      }

      try {
        // Get current device fingerprint
        const deviceInfo = await getDeviceInfo()

        // Attempt device login
        const response = await fetch('https://coorg-food-company-6163.handsfree.tech/api/auth/device/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceToken: storedDeviceToken,
            deviceFingerprint: deviceInfo.deviceFingerprint,
          }),
        })

        const data = await response.json()

        if (response.ok && data.success) {
          // Auto-login successful
          setAuth(data.sessionToken, storedDeviceToken, {
            id: data.user.userId,
            phone: '',
            email: '',
            role: data.user.role,
            tenantId: data.tenant.tenantId,
            tenantName: data.tenant.tenantName,
            subdomain: data.tenant.subdomain,
          }, {
            tenantId: data.tenant.tenantId,
            tenantName: data.tenant.tenantName,
            subdomain: data.tenant.subdomain,
            apiUrl: `https://${data.tenant.subdomain}.handsfree.tech`,
          })
        } else {
          // Device token invalid/expired - clear it
          localStorage.removeItem('deviceToken')
        }
      } catch (error) {
        console.error('Auto-login failed:', error)
        localStorage.removeItem('deviceToken')
      } finally {
        setIsCheckingAuth(false)
      }
    }

    attemptAutoLogin()
  }, [])

  useEffect(() => {
    // Only load data if authenticated
    if (isAuthenticated) {
      // Configure API service with tenant URL
      const { tenant } = useAuthStore.getState();
      if (tenant) {
        apiService.setApiUrl(tenant.apiUrl, tenant.tenantId);
        console.log('✅ API configured for:', tenant.tenantName);
      }

      loadRestaurants()
      loadMetrics('all')

      // Set up periodic refresh (every 30 seconds)
      const interval = setInterval(() => {
        loadMetrics(useLocationStore.getState().currentLocation)
      }, 30000)

      return () => clearInterval(interval)
    }
  }, [isAuthenticated, loadRestaurants, loadMetrics])

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Show device registration if not authenticated
  if (!isAuthenticated) {
    return <DeviceRegistrationFlow />
  }

  return (
    <div className="app">
      <Dashboard onLocationClick={() => setShowLocationSheet(true)} />

      <FABMenu
        isOpen={showFAB}
        onToggle={() => setShowFAB(!showFAB)}
      />

      <LocationSheet
        isOpen={showLocationSheet}
        onClose={() => setShowLocationSheet(false)}
      />
    </div>
  )
}

export default App
