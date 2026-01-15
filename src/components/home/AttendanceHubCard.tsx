/**
 * Attendance Hub Card
 * Interactive card for clock in/out and today's roster view
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, Coffee, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { cardVariants } from '../../lib/motion/variants';
import { useAttendanceStore } from '../../stores/attendanceStore';
import { useStaffStore } from '../../stores/staffStore';
import { useAuthStore } from '../../stores/authStore';
import { UserRole } from '../../types/auth';
import { ClockInOutWidget } from '../attendance/ClockInOutWidget';

const accentColors = {
  teal: {
    gradient: 'from-teal-400 to-teal-600',
    shadow: 'shadow-teal-500/30',
    bg: 'bg-teal-50',
    text: 'text-teal-600',
    border: 'border-teal-200',
  },
};

export function AttendanceHubCard() {
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const { getTodayAttendance } = useAttendanceStore();
  const { staff } = useStaffStore();
  const [showWidget, setShowWidget] = useState(false);
  const [todayRecords, setTodayRecords] = useState<any[]>([]);

  const colors = accentColors.teal;
  const isManager = role === UserRole.MANAGER;

  // Load today's attendance
  useEffect(() => {
    const records = getTodayAttendance();
    setTodayRecords(records);
  }, [getTodayAttendance]);

  // Calculate stats
  const clockedInCount = todayRecords.filter(r => r.status === 'active').length;
  const onBreakCount = todayRecords.filter(r =>
    r.status === 'active' && r.breaks.some((b: any) => !b.endAt)
  ).length;
  const totalStaff = staff.filter(s => s.isActive).length;

  const handleManageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/settings/attendance-rostering/attendance-tracking');
  };

  if (showWidget) {
    // Widget mode - show clock in/out interface
    return (
      <motion.div
        className={cn(
          'relative bg-white/80 backdrop-blur-sm rounded-2xl',
          'border border-white/60',
          'shadow-lg shadow-black/5',
          'p-5'
        )}
        variants={cardVariants}
        initial="initial"
        animate="animate"
        layout
      >
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                'bg-gradient-to-br',
                colors.gradient,
                'shadow-lg',
                colors.shadow
              )}
            >
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Attendance</h3>
              <p className="text-sm text-gray-500">Clock in/out</p>
            </div>
          </div>
          <button
            onClick={() => setShowWidget(false)}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
        </div>

        {/* Clock In/Out Widget */}
        <ClockInOutWidget
          staffId={!isManager ? user?.id : undefined}
          compact={false}
          onSuccess={() => {
            // Refresh today's attendance
            setTodayRecords(getTodayAttendance());
          }}
        />
      </motion.div>
    );
  }

  // Default mode - show overview and quick actions
  return (
    <motion.div
      className={cn(
        'relative bg-white/80 backdrop-blur-sm rounded-2xl',
        'border border-white/60',
        'shadow-lg shadow-black/5',
        'p-5 flex flex-col gap-4'
      )}
      variants={cardVariants}
      initial="initial"
      animate="animate"
      layout
    >
      {/* Icon & Title */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-14 h-14 rounded-xl flex items-center justify-center',
              'bg-gradient-to-br',
              colors.gradient,
              'shadow-lg',
              colors.shadow
            )}
          >
            <Clock className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Attendance</h3>
            <p className="text-sm text-gray-500">Track time & shifts</p>
          </div>
        </div>
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className={cn('p-3 rounded-lg', colors.bg)}>
          <div className="flex items-center gap-2 mb-1">
            <Users className={cn('w-4 h-4', colors.text)} />
            <span className="text-xs font-medium text-gray-600">Clocked In</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {clockedInCount}/{totalStaff}
          </div>
        </div>

        <div className={cn('p-3 rounded-lg', colors.bg)}>
          <div className="flex items-center gap-2 mb-1">
            <Coffee className={cn('w-4 h-4', colors.text)} />
            <span className="text-xs font-medium text-gray-600">On Break</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {onBreakCount}
          </div>
        </div>
      </div>

      {/* Today's Roster Preview (if manager) */}
      {isManager && todayRecords.length > 0 && (
        <div className="border-t border-gray-200 pt-3">
          <div className="text-xs font-medium text-gray-500 mb-2">Today's Activity</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {todayRecords.slice(0, 5).map((record) => {
              const staffMember = staff.find(s => s.id === record.staffId);
              const onBreak = record.status === 'active' && record.breaks.some((b: any) => !b.endAt);

              return (
                <div key={record.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{staffMember?.name || 'Unknown'}</span>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    record.status === 'active'
                      ? onBreak
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  )}>
                    {record.status === 'active' ? (onBreak ? 'On Break' : 'Active') : 'Completed'}
                  </span>
                </div>
              );
            })}
          </div>
          {todayRecords.length > 5 && (
            <div className="text-xs text-gray-500 mt-2">
              +{todayRecords.length - 5} more...
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <button
          onClick={() => setShowWidget(true)}
          className={cn(
            'flex-1 px-4 py-2.5 rounded-lg font-medium text-white',
            'bg-gradient-to-br',
            colors.gradient,
            'hover:shadow-lg transition-shadow'
          )}
        >
          Clock In/Out
        </button>

        {isManager && (
          <button
            onClick={handleManageClick}
            className="px-4 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 flex items-center gap-2 text-gray-700 font-medium"
          >
            Manage
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
