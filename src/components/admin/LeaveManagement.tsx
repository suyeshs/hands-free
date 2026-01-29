/**
 * Leave Management Component
 * Manage leave requests, approvals, and balances
 */

import { useState, useEffect } from 'react';
import {
  Plus,
  Filter,
  Clock,
  User,
  Briefcase,
} from 'lucide-react';
import { useLeaveStore } from '../../stores/leaveStore';
import { useStaffStore } from '../../stores/staffStore';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { UserRole } from '../../types/auth';
import { getCurrentTenantId } from '../../services/tauriAuth';
import { LeaveRequestCard } from '../attendance/LeaveRequestCard';

export function LeaveManagement() {
  const { user, role } = useAuthStore();
  const { tenant } = useTenantStore();
  const { staff } = useStaffStore();
  const {
    requests,
    isLoading,
    loadRequestsFromDatabase,
    loadBalances,
    createLeaveRequest,
    approveLeaveRequest,
    rejectLeaveRequest,
    getRequestsByStaff,
    getPendingRequests,
    getBalanceForStaff,
  } = useLeaveStore();

  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [tenantId, setTenantId] = useState('');

  // Form state for new leave request
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState<'vacation' | 'sick' | 'personal' | 'emergency' | 'unpaid'>('vacation');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');

  const isManager = role === UserRole.MANAGER;

  // Get tenant ID and load data
  useEffect(() => {
    const loadData = async () => {
      const id = await getCurrentTenantId();
      const currentTenantId = id || tenant?.tenantId || '';
      setTenantId(currentTenantId);

      if (currentTenantId) {
        await loadRequestsFromDatabase(currentTenantId);
        await loadBalances(currentTenantId);
      }
    };

    loadData();
  }, [tenant, loadRequestsFromDatabase, loadBalances]);

  // Get filtered requests based on role and filters
  const getFilteredRequests = () => {
    let filtered = isManager ? requests : getRequestsByStaff(user?.id || '');

    // Apply staff filter (manager only)
    if (isManager && selectedStaffId && selectedStaffId !== 'all') {
      filtered = filtered.filter(r => r.staffId === selectedStaffId);
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    // Sort by request date (newest first)
    return filtered.sort((a, b) =>
      new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );
  };

  const filteredRequests = getFilteredRequests();
  const pendingRequests = getPendingRequests();

  // Get current user's balance
  const myBalance = user ? getBalanceForStaff(user.id, new Date().getFullYear()) : null;

  // Calculate total days for leave request
  const calculateTotalDays = (start: string, end: string, halfDay: boolean) => {
    if (!start || !end) return 0;

    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end

    return halfDay ? 0.5 : diffDays;
  };

  // Handle submit leave request
  const handleSubmitRequest = async () => {
    // Validate
    if (!startDate || !endDate) {
      setFormError('Please select start and end dates');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setFormError('End date must be after start date');
      return;
    }

    const totalDays = calculateTotalDays(startDate, endDate, isHalfDay);

    // Check balance
    if (myBalance) {
      let availableDays = 0;
      let usedDays = 0;

      switch (leaveType) {
        case 'vacation':
          availableDays = myBalance.vacationDaysTotal;
          usedDays = myBalance.vacationDaysUsed;
          break;
        case 'sick':
          availableDays = myBalance.sickDaysTotal;
          usedDays = myBalance.sickDaysUsed;
          break;
        case 'personal':
          availableDays = myBalance.personalDaysTotal;
          usedDays = myBalance.personalDaysUsed;
          break;
      }

      if (leaveType !== 'emergency' && leaveType !== 'unpaid') {
        const remaining = availableDays - usedDays;
        if (totalDays > remaining) {
          setFormError(`Insufficient ${leaveType} days. You have ${remaining} days available.`);
          return;
        }
      }
    }

    setFormError('');

    try {
      await createLeaveRequest({
        tenantId,
        staffId: user?.id || '',
        startDate,
        endDate,
        leaveType,
        totalDays,
        isHalfDay,
        reason: reason || undefined,
        status: 'pending',
      });

      // Reset form
      setStartDate('');
      setEndDate('');
      setLeaveType('vacation');
      setIsHalfDay(false);
      setReason('');
      setShowRequestForm(false);

      alert('Leave request submitted successfully');
    } catch (err: any) {
      console.error('[LeaveManagement] Failed to submit request:', err);
      setFormError(err.message || 'Failed to submit request');
    }
  };

  // Handle approve request
  const handleApprove = async (requestId: string, notes?: string) => {
    if (!user) return;

    try {
      await approveLeaveRequest(requestId, user.id, notes);
      // Reload balances to reflect the change
      await loadBalances(tenantId);
    } catch (err: any) {
      console.error('[LeaveManagement] Failed to approve request:', err);
      alert(err.message || 'Failed to approve request');
    }
  };

  // Handle reject request
  const handleReject = async (requestId: string, notes: string) => {
    if (!user) return;

    try {
      await rejectLeaveRequest(requestId, user.id, notes);
    } catch (err: any) {
      console.error('[LeaveManagement] Failed to reject request:', err);
      alert(err.message || 'Failed to reject request');
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface-2">
      {/* Header */}
      <div className="bg-card border-b border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Leave Management</h2>
            <p className="text-sm text-muted-foreground">
              {isManager ? 'Manage staff leave requests and balances' : 'Request time off and view your leave balance'}
            </p>
          </div>

          {!isManager && (
            <button
              onClick={() => setShowRequestForm(!showRequestForm)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {showRequestForm ? 'Cancel' : 'Request Leave'}
            </button>
          )}
        </div>

        {/* My Balance (Staff View) */}
        {!isManager && myBalance && (
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-blue-50 p-4">
              <div className="text-sm text-muted-foreground mb-1">Vacation Days</div>
              <div className="text-2xl font-bold text-foreground">
                {myBalance.vacationDaysTotal - myBalance.vacationDaysUsed} / {myBalance.vacationDaysTotal}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {myBalance.vacationDaysUsed} used
              </div>
            </div>
            <div className="bg-green-50 p-4">
              <div className="text-sm text-muted-foreground mb-1">Sick Days</div>
              <div className="text-2xl font-bold text-foreground">
                {myBalance.sickDaysTotal - myBalance.sickDaysUsed} / {myBalance.sickDaysTotal}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {myBalance.sickDaysUsed} used
              </div>
            </div>
            <div className="bg-purple-50 p-4">
              <div className="text-sm text-muted-foreground mb-1">Personal Days</div>
              <div className="text-2xl font-bold text-foreground">
                {myBalance.personalDaysTotal - myBalance.personalDaysUsed} / {myBalance.personalDaysTotal}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {myBalance.personalDaysUsed} used
              </div>
            </div>
          </div>
        )}

        {/* Pending Requests Summary (Manager View) */}
        {isManager && pendingRequests.length > 0 && (
          <div className="mt-4 p-4 bg-orange-50 border border-orange-200-orange-800">
            <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <Clock className="w-5 h-5" />
              <span className="font-medium">
                {pendingRequests.length} pending request{pendingRequests.length !== 1 ? 's' : ''} awaiting review
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Leave Request Form (Staff View) */}
      {!isManager && showRequestForm && (
        <div className="bg-card border-b border p-6">
          <div className="max-w-2xl">
            <h3 className="text-lg font-bold text-foreground mb-4">New Leave Request</h3>

            <div className="space-y-4">
              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Leave Type */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Leave Type *
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as any)}
                  className="w-full px-3 py-2 border border focus:ring-2 focus:ring-teal-500"
                >
                  <option value="vacation">Vacation</option>
                  <option value="sick">Sick Leave</option>
                  <option value="personal">Personal</option>
                  <option value="emergency">Emergency</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>

              {/* Half Day Checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="halfDay"
                  checked={isHalfDay}
                  onChange={(e) => setIsHalfDay(e.target.checked)}
                  className="w-4 h-4 text-teal-600 border rounded focus:ring-teal-500"
                />
                <label htmlFor="halfDay" className="text-sm text-foreground">
                  Half day (applies only to single day requests)
                </label>
              </div>

              {/* Total Days Display */}
              {startDate && endDate && (
                <div className="p-3 bg-surface-2">
                  <span className="text-sm text-muted-foreground">Total Days: </span>
                  <span className="text-lg font-bold text-foreground">
                    {calculateTotalDays(startDate, endDate, isHalfDay)} day{calculateTotalDays(startDate, endDate, isHalfDay) !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Reason (Optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Brief explanation..."
                  rows={3}
                  className="w-full px-3 py-2 border border focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>

              {/* Error Display */}
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200-red-800 text-sm text-red-600 dark:text-red-400">
                  {formError}
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSubmitRequest}
                disabled={!startDate || !endDate}
                className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters (Manager View) */}
      {isManager && (
        <div className="bg-card border-b border p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Staff Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                <User className="w-4 h-4 inline mr-1" />
                Staff
              </label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full px-3 py-2 border border focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Staff</option>
                {staff.filter(s => s.isActive).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                <Filter className="w-4 h-4 inline mr-1" />
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 border border focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Requests List */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
            <p className="text-muted-foreground mt-4">Loading leave requests...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No leave requests found</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl mx-auto">
            {filteredRequests.map(request => (
              <LeaveRequestCard
                key={request.id}
                request={request}
                isManager={isManager}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
