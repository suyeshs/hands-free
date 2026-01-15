/**
 * Roster Calendar Grid Component
 * 7-day calendar view for weekly staff schedules
 */

import { Plus, Edit2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface RosterCalendarGridProps {
  weekStartDate: Date;
  roster: any;
  assignments: any[];
  staff: any[];
  onAddAssignment: (date: string, staffId?: string) => void;
  onEditAssignment: (assignment: any) => void;
  readOnly?: boolean;
}

export function RosterCalendarGrid({
  weekStartDate,
  assignments,
  staff,
  onAddAssignment,
  onEditAssignment,
  readOnly = false,
}: RosterCalendarGridProps) {
  // Generate 7 days array (Monday to Sunday)
  const getDaysOfWeek = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStartDate);
      date.setDate(weekStartDate.getDate() + i);
      days.push({
        date,
        dateStr: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: date.getDate(),
        isToday: date.toDateString() === new Date().toDateString(),
      });
    }
    return days;
  };

  const daysOfWeek = getDaysOfWeek();

  // Get assignments for a specific staff member and date
  const getAssignmentsForStaffAndDate = (staffId: string, dateStr: string) => {
    return assignments.filter(
      a => a.staffId === staffId && a.shiftDate === dateStr && a.status !== 'cancelled'
    );
  };

  // Get all assignments for a specific date
  const getAssignmentsForDate = (dateStr: string) => {
    return assignments.filter(
      a => a.shiftDate === dateStr && a.status !== 'cancelled'
    );
  };

  // Detect conflicts (same staff, same date)
  const hasConflict = (staffId: string, dateStr: string) => {
    const staffAssignments = getAssignmentsForStaffAndDate(staffId, dateStr);
    return staffAssignments.length > 1;
  };

  // Format shift time display
  const formatShiftTime = (assignment: any) => {
    return `${assignment.shiftStart}-${assignment.shiftEnd}`;
  };

  // Get shift type color
  const getShiftTypeColor = (shiftType: string) => {
    switch (shiftType) {
      case 'regular':
        return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
      case 'split':
        return 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800';
      case 'overnight':
        return 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800';
      case 'on-call':
        return 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700">
              <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-600 min-w-[150px]">
                Staff
              </th>
              {daysOfWeek.map(day => (
                <th
                  key={day.dateStr}
                  className={cn(
                    'px-3 py-3 text-center text-xs font-medium uppercase border-r border-gray-200 dark:border-gray-600 min-w-[140px]',
                    day.isToday
                      ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                      : 'text-gray-500 dark:text-gray-400'
                  )}
                >
                  <div className="flex flex-col">
                    <span>{day.dayName}</span>
                    <span
                      className={cn(
                        'text-lg font-bold',
                        day.isToday
                          ? 'text-teal-600 dark:text-teal-400'
                          : 'text-gray-900 dark:text-white'
                      )}
                    >
                      {day.dayNum}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {staff.map(staffMember => (
              <tr key={staffMember.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                {/* Staff Name Column */}
                <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 px-4 py-3 border-r border-gray-200 dark:border-gray-600">
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {staffMember.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {staffMember.role}
                    </span>
                  </div>
                </td>

                {/* Day Cells */}
                {daysOfWeek.map(day => {
                  const dayAssignments = getAssignmentsForStaffAndDate(
                    staffMember.id,
                    day.dateStr
                  );
                  const conflict = hasConflict(staffMember.id, day.dateStr);

                  return (
                    <td
                      key={day.dateStr}
                      className={cn(
                        'px-2 py-2 border-r border-gray-200 dark:border-gray-600 align-top',
                        day.isToday && 'bg-teal-50/30 dark:bg-teal-900/10'
                      )}
                    >
                      <div className="min-h-[80px] space-y-1">
                        {/* Existing Assignments */}
                        {dayAssignments.map(assignment => (
                          <div
                            key={assignment.id}
                            onClick={() => !readOnly && onEditAssignment(assignment)}
                            className={cn(
                              'relative p-2 rounded border text-xs cursor-pointer transition-all',
                              getShiftTypeColor(assignment.shiftType),
                              !readOnly && 'hover:shadow-md'
                            )}
                          >
                            {conflict && (
                              <div className="absolute -top-1 -right-1">
                                <AlertCircle className="w-4 h-4 text-red-500 bg-white rounded-full" />
                              </div>
                            )}
                            <div className="font-medium truncate">
                              {formatShiftTime(assignment)}
                            </div>
                            {assignment.role && (
                              <div className="text-xs opacity-75 truncate">
                                {assignment.role}
                              </div>
                            )}
                            {assignment.status === 'confirmed' && (
                              <div className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
                                ✓ Confirmed
                              </div>
                            )}
                            {!readOnly && (
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/5 rounded transition-opacity">
                                <Edit2 className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Add Assignment Button */}
                        {!readOnly && dayAssignments.length === 0 && (
                          <button
                            onClick={() => onAddAssignment(day.dateStr, staffMember.id)}
                            className="w-full h-full min-h-[40px] flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded hover:border-teal-500 dark:hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-all group"
                          >
                            <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Summary Row */}
            <tr className="bg-gray-50 dark:bg-gray-700 font-medium">
              <td className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600">
                Total Shifts
              </td>
              {daysOfWeek.map(day => {
                const dayShifts = getAssignmentsForDate(day.dateStr);
                return (
                  <td
                    key={day.dateStr}
                    className={cn(
                      'px-3 py-3 text-center text-sm border-r border-gray-200 dark:border-gray-600',
                      day.isToday
                        ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-900 dark:text-teal-300'
                        : 'text-gray-700 dark:text-gray-300'
                    )}
                  >
                    {dayShifts.length}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend */}
      {!readOnly && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-800">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="text-gray-600 dark:text-gray-400 font-medium">Shift Types:</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-blue-500"></div>
              <span className="text-gray-700 dark:text-gray-300">Regular</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-purple-500"></div>
              <span className="text-gray-700 dark:text-gray-300">Split</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-indigo-500"></div>
              <span className="text-gray-700 dark:text-gray-300">Overnight</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-orange-500"></div>
              <span className="text-gray-700 dark:text-gray-300">On-Call</span>
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-gray-700 dark:text-gray-300">Conflict Detected</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
