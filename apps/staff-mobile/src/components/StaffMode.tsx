import { Clock, TrendingUp, Users, Star, Calendar, DollarSign, Award } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useDeviceAuthStore } from '../stores/deviceAuthStore'
import { useAttendanceStore } from '../stores/attendanceStore'
import './StaffMode.css'

export default function StaffMode() {
  const { registeredStaffId, registeredTenantId } = useDeviceAuthStore()
  const {
    todayRecord,
    clockIn,
    clockOut,
    calculateDuration,
    getTodayStats,
    isLoading
  } = useAttendanceStore()

  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }))
  const [duration, setDuration] = useState('')

  // Update current time and duration every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }))
      if (todayRecord?.clock_in_at && !todayRecord?.clock_out_at) {
        setDuration(calculateDuration())
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [todayRecord, calculateDuration])

  const handleClockIn = async () => {
    if (!registeredStaffId || !registeredTenantId) return
    try {
      await clockIn(registeredStaffId, registeredTenantId, 'biometric')
    } catch (error) {
      console.error('[StaffMode] Clock in failed:', error)
    }
  }

  const handleClockOut = async () => {
    try {
      await clockOut()
    } catch (error) {
      console.error('[StaffMode] Clock out failed:', error)
    }
  }

  const todayStats = getTodayStats()
  const isClockedIn = todayRecord?.clock_in_at && !todayRecord?.clock_out_at

  const quickActions = [
    { icon: <DollarSign size={20} />, label: 'View Payroll', color: '#10b981' },
    { icon: <Calendar size={20} />, label: 'Request Advance', color: '#3b82f6' },
    { icon: <Award size={20} />, label: 'View Schedule', color: '#f59e0b' }
  ]

  return (
    <div className="staff-mode">
      <div className="page-section">
        <div className={`clock-card glass ${isClockedIn ? 'clocked-in' : 'clocked-out'}`}>
          <div className="clock-status">
            {isClockedIn ? 'Currently Clocked In' : 'Currently Clocked Out'}
          </div>
          <div className="clock-time">{currentTime}</div>
          <div className="clock-duration">
            {isClockedIn ? `Working for ${duration}` : 'Not working'}
          </div>
          <button
            className={`clock-btn tap-feedback ${isClockedIn ? 'out' : 'in'}`}
            onClick={isClockedIn ? handleClockOut : handleClockIn}
            disabled={isLoading}
          >
            <Clock size={20} />
            {isLoading ? 'Processing...' : (isClockedIn ? 'Clock Out' : 'Clock In')}
          </button>
        </div>
      </div>

      <div className="page-section">
        <h2 className="section-title">Today's Summary</h2>
        <div className="stats-grid">
          <div className="stat-card glass">
            <span className="stat-icon">⏱️</span>
            <div className="stat-value">{todayStats.hoursWorked || '0h 0m'}</div>
            <div className="stat-label">Hours Worked</div>
          </div>
          <div className="stat-card glass">
            <span className="stat-icon">✅</span>
            <div className="stat-value">{todayStats.isActive ? 'Active' : 'Inactive'}</div>
            <div className="stat-label">Status</div>
          </div>
          <div className="stat-card glass">
            <span className="stat-icon">📅</span>
            <div className="stat-value">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
            <div className="stat-label">Today</div>
          </div>
          <div className="stat-card glass">
            <span className="stat-icon">⏰</span>
            <div className="stat-value">
              {todayRecord?.clock_in_at
                ? new Date(todayRecord.clock_in_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                : '--:--'}
            </div>
            <div className="stat-label">Clock In Time</div>
          </div>
        </div>
      </div>

      <div className="page-section">
        <h2 className="section-title">Quick Actions</h2>
        <div className="quick-actions">
          {quickActions.map((action, index) => (
            <button key={index} className="action-btn glass tap-feedback">
              <div className="action-icon" style={{ color: action.color }}>
                {action.icon}
              </div>
              <span className="action-label">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
