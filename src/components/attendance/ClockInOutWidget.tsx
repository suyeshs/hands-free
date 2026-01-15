import { useState, useEffect } from 'react';
import { Clock, Coffee, LogIn, LogOut, Pause, Play } from 'lucide-react';
import { useAttendanceStore } from '../../stores/attendanceStore';
import { useStaffStore } from '../../stores/staffStore';
import { useTenantStore } from '../../stores/tenantStore';
import { getCurrentTenantId } from '../../services/tauriAuth';

interface ClockInOutWidgetProps {
  staffId?: string; // If provided, show controls for this specific staff member
  compact?: boolean; // Compact mode for Hub card
  onSuccess?: () => void;
}

export function ClockInOutWidget({ staffId, compact = false, onSuccess }: ClockInOutWidgetProps) {
  const { tenant } = useTenantStore();
  const { staff } = useStaffStore();
  const {
    getActiveRecordForStaff,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
  } = useAttendanceStore();

  const [selectedStaffId, setSelectedStaffId] = useState(staffId || '');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [tenantId, setTenantId] = useState('');

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Get tenant ID
  useEffect(() => {
    const getTenant = async () => {
      const id = await getCurrentTenantId();
      setTenantId(id || tenant?.tenantId || '');
    };
    getTenant();
  }, [tenant]);

  const activeRecord = selectedStaffId ? getActiveRecordForStaff(selectedStaffId) : null;
  const activeBreak = activeRecord?.breaks.find(b => !b.endAt);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (start: string) => {
    const startTime = new Date(start).getTime();
    const now = currentTime.getTime();
    const duration = Math.floor((now - startTime) / 1000);
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const handlePinInput = (digit: string) => {
    if (pin.length < 6) {
      setPin(pin + digit);
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleClockIn = async () => {
    if (!selectedStaffId || pin.length < 4) {
      setError('Please select staff and enter PIN');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Verify PIN
      const { verifyStaffPinAsync } = useStaffStore.getState();
      const isValid = await verifyStaffPinAsync(selectedStaffId, pin);

      if (!isValid) {
        setError('Invalid PIN');
        setLoading(false);
        setPin('');
        return;
      }

      // Clock in
      await clockIn(selectedStaffId, tenantId);

      // Success
      setPin('');
      setError('');
      onSuccess?.();
    } catch (err: any) {
      console.error('[ClockInOut] Clock in failed:', err);
      setError(err.message || 'Failed to clock in');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!activeRecord) return;

    setLoading(true);
    setError('');

    try {
      await clockOut(activeRecord.id);
      setPin('');
      onSuccess?.();
    } catch (err: any) {
      console.error('[ClockInOut] Clock out failed:', err);
      setError(err.message || 'Failed to clock out');
    } finally {
      setLoading(false);
    }
  };

  const handleStartBreak = async (type: 'meal' | 'rest' | 'other') => {
    if (!activeRecord) return;

    setLoading(true);
    setError('');

    try {
      await startBreak(activeRecord.id, type);
    } catch (err: any) {
      console.error('[ClockInOut] Start break failed:', err);
      setError(err.message || 'Failed to start break');
    } finally {
      setLoading(false);
    }
  };

  const handleEndBreak = async () => {
    if (!activeRecord || !activeBreak) return;

    setLoading(true);
    setError('');

    try {
      await endBreak(activeRecord.id, activeBreak.id);
    } catch (err: any) {
      console.error('[ClockInOut] End break failed:', err);
      setError(err.message || 'Failed to end break');
    } finally {
      setLoading(false);
    }
  };

  if (compact && !staffId) {
    // Compact mode requires staffId
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Current Time Display */}
      <div className="text-center">
        <div className="text-3xl font-bold text-gray-900 dark:text-white">
          {formatTime(currentTime)}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {currentTime.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>

      {/* Staff Selector (if staffId not provided) */}
      {!staffId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Staff Member
          </label>
          <select
            value={selectedStaffId}
            onChange={(e) => {
              setSelectedStaffId(e.target.value);
              setPin('');
              setError('');
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="">Choose staff...</option>
            {staff
              .filter(s => s.isActive)
              .map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role})
                </option>
              ))}
          </select>
        </div>
      )}

      {/* Active Shift Display */}
      {activeRecord && (
        <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <span className="font-medium text-gray-900 dark:text-white">
                Currently Clocked In
              </span>
            </div>
            {activeBreak && (
              <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs rounded-full flex items-center gap-1">
                <Coffee className="w-3 h-3" />
                On Break
              </span>
            )}
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Clock In:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {new Date(activeRecord.clockInAt).toLocaleTimeString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Duration:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatDuration(activeRecord.clockInAt)}
              </span>
            </div>
            {activeRecord.breaks.length > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Break Time:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {activeRecord.breakDurationMinutes} min
                </span>
              </div>
            )}
          </div>

          {/* Break Controls */}
          <div className="mt-3 flex gap-2">
            {!activeBreak ? (
              <>
                <button
                  onClick={() => handleStartBreak('meal')}
                  disabled={loading}
                  className="flex-1 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Coffee className="w-4 h-4" />
                  Meal Break
                </button>
                <button
                  onClick={() => handleStartBreak('rest')}
                  disabled={loading}
                  className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Pause className="w-4 h-4" />
                  Rest Break
                </button>
              </>
            ) : (
              <button
                onClick={handleEndBreak}
                disabled={loading}
                className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                End Break ({formatDuration(activeBreak.startAt)})
              </button>
            )}
          </div>

          {/* Clock Out Button */}
          <button
            onClick={handleClockOut}
            disabled={loading || !!activeBreak}
            className="w-full mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Clock Out
          </button>
          {activeBreak && (
            <p className="text-xs text-orange-600 dark:text-orange-400 text-center mt-1">
              End your break before clocking out
            </p>
          )}
        </div>
      )}

      {/* Clock In Controls */}
      {!activeRecord && selectedStaffId && (
        <div className="space-y-3">
          {/* PIN Pad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Enter PIN
            </label>
            <div className="flex gap-1 mb-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`flex-1 h-3 rounded ${
                    i < pin.length
                      ? 'bg-teal-500'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>

            {/* Number Pad */}
            <div className="grid grid-cols-3 gap-2 mb-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handlePinInput(num.toString())}
                  className="px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium text-gray-900 dark:text-white"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={handleClear}
                className="px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium text-gray-900 dark:text-white"
              >
                Clear
              </button>
              <button
                onClick={() => handlePinInput('0')}
                className="px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium text-gray-900 dark:text-white"
              >
                0
              </button>
              <button
                onClick={handleBackspace}
                className="px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium text-gray-900 dark:text-white"
              >
                ←
              </button>
            </div>
          </div>

          {/* Clock In Button */}
          <button
            onClick={handleClockIn}
            disabled={loading || pin.length < 4}
            className="w-full px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <LogIn className="w-5 h-5" />
            Clock In
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Info Text */}
      {!selectedStaffId && !staffId && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Select a staff member to clock in
        </p>
      )}
    </div>
  );
}
