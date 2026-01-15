/**
 * Attendance Management Component
 * View and manage attendance records with role-based access
 */

import { useState, useEffect } from 'react';
import { Download, Calendar, Clock, Filter, User } from 'lucide-react';
import { useAttendanceStore } from '../../stores/attendanceStore';
import { useStaffStore } from '../../stores/staffStore';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { UserRole } from '../../types/auth';
import { getCurrentTenantId } from '../../services/tauriAuth';

export function AttendanceManagement() {
  const { user, role } = useAuthStore();
  const { tenant } = useTenantStore();
  const { staff } = useStaffStore();
  const {
    records,
    isLoading,
    loadRecordsFromDatabase,
  } = useAttendanceStore();

  const [selectedStaffId, setSelectedStaffId] = useState(user?.id || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');

  const isManager = role === UserRole.MANAGER;

  // Get tenant ID and load records
  useEffect(() => {
    const loadData = async () => {
      const id = await getCurrentTenantId();
      const tenantId = id || tenant?.tenantId || '';

      if (tenantId) {
        // Load records with filters
        const filters: any = {};
        if (!isManager && user?.id) {
          filters.staffId = user.id;
        } else if (selectedStaffId && selectedStaffId !== 'all') {
          filters.staffId = selectedStaffId;
        }
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;
        if (statusFilter !== 'all') filters.status = statusFilter;

        await loadRecordsFromDatabase(tenantId, filters);
      }
    };

    loadData();
  }, [tenant, user, selectedStaffId, startDate, endDate, statusFilter, isManager, loadRecordsFromDatabase]);

  // Filter records based on current user role
  const filteredRecords = isManager
    ? records
    : records.filter(r => r.staffId === user?.id);

  // Calculate summary stats
  const totalHours = filteredRecords.reduce((sum, r) => sum + (r.totalHours || 0), 0);
  const regularHours = filteredRecords.reduce((sum, r) => sum + (r.regularHours || 0), 0);
  const overtimeHours = filteredRecords.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);
  const activeCount = filteredRecords.filter(r => r.status === 'active').length;

  // Get staff name for a record
  const getStaffName = (staffId: string) => {
    const staffMember = staff.find(s => s.id === staffId);
    return staffMember?.name || 'Unknown';
  };

  // Format duration
  const formatDuration = (hours?: number) => {
    if (!hours) return '-';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  // Format date and time
  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = isManager
      ? ['Date', 'Staff', 'Clock In', 'Clock Out', 'Total Hours', 'Regular Hours', 'Overtime', 'Status', 'Late (min)', 'Early (min)']
      : ['Date', 'Clock In', 'Clock Out', 'Total Hours', 'Regular Hours', 'Overtime', 'Status'];

    const rows = filteredRecords.map(r => {
      const clockIn = formatDateTime(r.clockInAt);
      const clockOut = r.clockOutAt ? formatDateTime(r.clockOutAt) : { date: '', time: '-' };

      const baseRow = [
        r.shiftDate,
        clockIn.time,
        clockOut.time,
        formatDuration(r.totalHours),
        formatDuration(r.regularHours),
        formatDuration(r.overtimeHours),
        r.status,
      ];

      if (isManager) {
        return [
          r.shiftDate,
          getStaffName(r.staffId),
          ...baseRow.slice(1),
          r.lateByMinutes,
          r.earlyDepartureMinutes,
        ];
      }

      return baseRow;
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance Tracking</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isManager ? 'View and manage all staff attendance' : 'Your attendance history'}
            </p>
          </div>
          <button
            onClick={exportToCSV}
            disabled={filteredRecords.length === 0}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Hours</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatDuration(totalHours)}
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Regular Hours</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatDuration(regularHours)}
            </div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Overtime</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatDuration(overtimeHours)}
            </div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active Shifts</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {activeCount}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Staff Filter (Manager only) */}
          {isManager && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                Staff
              </label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="all">All Staff</option>
                {staff.filter(s => s.isActive).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Filter className="w-4 h-4 inline mr-1" />
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading attendance records...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No attendance records found</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                  {isManager && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Staff</th>}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Clock In</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Clock Out</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Regular</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Overtime</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredRecords.map((record) => {
                  const clockIn = formatDateTime(record.clockInAt);
                  const clockOut = record.clockOutAt ? formatDateTime(record.clockOutAt) : null;

                  return (
                    <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{record.shiftDate}</td>
                      {isManager && <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{getStaffName(record.staffId)}</td>}
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{clockIn.time}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{clockOut?.time || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{formatDuration(record.totalHours)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{formatDuration(record.regularHours)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-orange-600 dark:text-orange-400">{formatDuration(record.overtimeHours)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          record.status === 'active'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
