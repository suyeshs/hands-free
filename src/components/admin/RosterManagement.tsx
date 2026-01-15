/**
 * Roster Management Component
 * Create and manage weekly staff schedules
 */

import { useState, useEffect } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
  Download,
  Send,
  Plus,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useRosteringStore } from '../../stores/rosteringStore';
import { useStaffStore } from '../../stores/staffStore';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { UserRole } from '../../types/auth';
import { getCurrentTenantId } from '../../services/tauriAuth';
import { RosterCalendarGrid } from '../attendance/RosterCalendarGrid';
import { ShiftAssignmentModal } from '../attendance/ShiftAssignmentModal';

export function RosterManagement() {
  const { user, role } = useAuthStore();
  const { tenant } = useTenantStore();
  const { staff } = useStaffStore();
  const {
    getRosterForWeek,
    getAssignmentsForRoster,
    createWeeklyRoster,
    publishRoster,
    isLoading,
  } = useRosteringStore();

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    // Get Monday of current week
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const [roster, setRoster] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [tenantId, setTenantId] = useState('');

  const isManager = role === UserRole.MANAGER;

  // Get tenant ID
  useEffect(() => {
    const getTenant = async () => {
      const id = await getCurrentTenantId();
      setTenantId(id || tenant?.tenantId || '');
    };
    getTenant();
  }, [tenant]);

  // Load roster for current week
  useEffect(() => {
    if (!tenantId) return;

    const loadRoster = async () => {
      const weekStart = currentWeekStart.toISOString().split('T')[0];
      let currentRoster = getRosterForWeek(weekStart);

      // If no roster exists for this week and user is manager, create one
      if (!currentRoster && isManager) {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 6);
        const weekName = `Week of ${weekStart}`;

        currentRoster = await createWeeklyRoster(
          tenantId,
          weekStart,
          weekName
        );
      }

      setRoster(currentRoster);

      // Load assignments for this roster
      if (currentRoster) {
        const rosterAssignments = getAssignmentsForRoster(currentRoster.id);
        setAssignments(rosterAssignments);
      } else {
        setAssignments([]);
      }
    };

    loadRoster();
  }, [currentWeekStart, tenantId, isManager, user, getRosterForWeek, getAssignmentsForRoster, createWeeklyRoster]);

  // Navigate to previous week
  const handlePreviousWeek = () => {
    const prevWeek = new Date(currentWeekStart);
    prevWeek.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(prevWeek);
  };

  // Navigate to next week
  const handleNextWeek = () => {
    const nextWeek = new Date(currentWeekStart);
    nextWeek.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(nextWeek);
  };

  // Go to current week
  const handleToday = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
  };

  // Handle publish roster
  const handlePublishRoster = async () => {
    if (!roster || !user) return;

    try {
      await publishRoster(roster.id, user.id);
      // Reload roster
      const weekStart = currentWeekStart.toISOString().split('T')[0];
      const updatedRoster = getRosterForWeek(weekStart);
      setRoster(updatedRoster);
    } catch (err: any) {
      console.error('[RosterManagement] Failed to publish roster:', err);
      alert(err.message || 'Failed to publish roster');
    }
  };

  // Handle add assignment
  const handleAddAssignment = (date: string, staffId?: string) => {
    setSelectedDate(date);
    setSelectedStaffId(staffId || '');
    setEditingAssignment(null);
    setShowAssignmentModal(true);
  };

  // Handle edit assignment
  const handleEditAssignment = (assignment: any) => {
    setEditingAssignment(assignment);
    setSelectedDate(assignment.shiftDate);
    setSelectedStaffId(assignment.staffId);
    setShowAssignmentModal(true);
  };

  // Handle assignment saved
  const handleAssignmentSaved = () => {
    setShowAssignmentModal(false);
    setEditingAssignment(null);
    // Reload assignments
    if (roster) {
      const rosterAssignments = getAssignmentsForRoster(roster.id);
      setAssignments(rosterAssignments);
    }
  };

  // Export roster to CSV
  const exportToCSV = () => {
    if (!roster || assignments.length === 0) return;

    const headers = ['Date', 'Day', 'Staff', 'Shift Start', 'Shift End', 'Type', 'Role', 'Status'];

    const rows = assignments.map(a => {
      const staffMember = staff.find(s => s.id === a.staffId);
      return [
        a.shiftDate,
        a.dayOfWeek,
        staffMember?.name || 'Unknown',
        a.shiftStart,
        a.shiftEnd,
        a.shiftType,
        a.role || '-',
        a.status,
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `roster-week-${currentWeekStart.toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Format week range
  const formatWeekRange = () => {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 6);

    const startStr = currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return `${startStr} - ${endStr}`;
  };

  // Calculate roster stats
  const totalAssignments = assignments.length;
  const activeStaffCount = new Set(assignments.map(a => a.staffId)).size;
  const confirmedCount = assignments.filter(a => a.status === 'confirmed').length;

  // Staff view - show only their schedule
  if (!isManager && user) {
    const myAssignments = assignments.filter(a => a.staffId === user.id);

    return (
      <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Schedule</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                View your shifts for the week
              </p>
            </div>
          </div>

          {/* Week Navigation */}
          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <button
              onClick={handlePreviousWeek}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4">
              <span className="text-lg font-medium text-gray-900 dark:text-white">
                {formatWeekRange()}
              </span>
              <button
                onClick={handleToday}
                className="px-3 py-1 text-sm bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors"
              >
                Today
              </button>
            </div>

            <button
              onClick={handleNextWeek}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Schedule List */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading schedule...</p>
            </div>
          ) : myAssignments.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No shifts scheduled for this week</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myAssignments.map(assignment => (
                <div
                  key={assignment.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-teal-500"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                          {assignment.dayOfWeek}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(assignment.shiftDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 dark:text-gray-400">Time:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {assignment.shiftStart} - {assignment.shiftEnd}
                          </span>
                        </div>
                        {assignment.role && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 dark:text-gray-400">Role:</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {assignment.role}
                            </span>
                          </div>
                        )}
                        {assignment.notes && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 dark:text-gray-400">Notes:</span>
                            <span className="text-gray-700 dark:text-gray-300">
                              {assignment.notes}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        assignment.status === 'confirmed'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : assignment.status === 'scheduled'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {assignment.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Manager view - full roster management
  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Weekly Roster</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Create and manage staff schedules
            </p>
          </div>

          <div className="flex items-center gap-2">
            {roster && roster.status === 'draft' && (
              <button
                onClick={handlePublishRoster}
                disabled={totalAssignments === 0}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                Publish Roster
              </button>
            )}
            <button
              onClick={exportToCSV}
              disabled={totalAssignments === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Week Navigation & Stats */}
        <div className="flex items-center justify-between gap-4">
          {/* Week Navigation */}
          <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-lg p-3 gap-4">
            <button
              onClick={handlePreviousWeek}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4">
              <span className="text-lg font-medium text-gray-900 dark:text-white">
                {formatWeekRange()}
              </span>
              <button
                onClick={handleToday}
                className="px-3 py-1 text-sm bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors"
              >
                Today
              </button>
            </div>

            <button
              onClick={handleNextWeek}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Roster Status & Stats */}
          <div className="flex items-center gap-4">
            {roster && (
              <div className="flex items-center gap-2">
                {roster.status === 'published' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-600">Published</span>
                  </>
                ) : roster.status === 'draft' ? (
                  <>
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                    <span className="text-sm font-medium text-orange-600">Draft</span>
                  </>
                ) : null}
              </div>
            )}

            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{activeStaffCount} staff</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{totalAssignments} shifts</span>
              </div>
              {totalAssignments > 0 && (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{confirmedCount} confirmed</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading roster...</p>
          </div>
        ) : !roster ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No roster found for this week</p>
            <button
              onClick={async () => {
                if (!tenantId || !user) return;
                const weekStart = currentWeekStart.toISOString().split('T')[0];
                const weekName = `Week of ${weekStart}`;
                await createWeeklyRoster(
                  tenantId,
                  weekStart,
                  weekName
                );
                const newRoster = getRosterForWeek(weekStart);
                setRoster(newRoster);
              }}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium flex items-center gap-2 mx-auto"
            >
              <Plus className="w-4 h-4" />
              Create Roster for This Week
            </button>
          </div>
        ) : (
          <RosterCalendarGrid
            weekStartDate={currentWeekStart}
            roster={roster}
            assignments={assignments}
            staff={staff.filter(s => s.isActive)}
            onAddAssignment={handleAddAssignment}
            onEditAssignment={handleEditAssignment}
            readOnly={roster.status === 'published'}
          />
        )}
      </div>

      {/* Shift Assignment Modal */}
      {showAssignmentModal && roster && (
        <ShiftAssignmentModal
          isOpen={showAssignmentModal}
          onClose={() => setShowAssignmentModal(false)}
          rosterId={roster.id}
          shiftDate={selectedDate}
          staffId={selectedStaffId}
          assignment={editingAssignment}
          onSaved={handleAssignmentSaved}
        />
      )}
    </div>
  );
}
