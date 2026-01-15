/**
 * Leave Request Card Component
 * Display individual leave request with approval/rejection actions
 */

import { useState } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { useStaffStore } from '../../stores/staffStore';
import { cn } from '../../lib/utils';

interface LeaveRequestCardProps {
  request: any;
  isManager: boolean;
  onApprove?: (requestId: string, notes?: string) => Promise<void>;
  onReject?: (requestId: string, notes: string) => Promise<void>;
}

export function LeaveRequestCard({
  request,
  isManager,
  onApprove,
  onReject,
}: LeaveRequestCardProps) {
  const { staff } = useStaffStore();
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewNotes, setReviewNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const staffMember = staff.find(s => s.id === request.staffId);

  // Handle review submission
  const handleSubmitReview = async () => {
    if (reviewAction === 'reject' && !reviewNotes.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setLoading(true);

    try {
      if (reviewAction === 'approve' && onApprove) {
        await onApprove(request.id, reviewNotes || undefined);
      } else if (reviewAction === 'reject' && onReject) {
        await onReject(request.id, reviewNotes);
      }

      setShowReviewForm(false);
      setReviewNotes('');
    } catch (err: any) {
      console.error('[LeaveRequestCard] Review failed:', err);
      alert(err.message || 'Failed to process review');
    } finally {
      setLoading(false);
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
      case 'approved':
        return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
    }
  };

  // Get leave type color
  const getLeaveTypeColor = (type: string) => {
    switch (type) {
      case 'vacation':
        return 'text-blue-600 dark:text-blue-400';
      case 'sick':
        return 'text-red-600 dark:text-red-400';
      case 'personal':
        return 'text-purple-600 dark:text-purple-400';
      case 'emergency':
        return 'text-orange-600 dark:text-orange-400';
      case 'unpaid':
        return 'text-gray-600 dark:text-gray-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  // Format date range
  const formatDateRange = () => {
    const start = new Date(request.startDate);
    const end = new Date(request.endDate);

    if (request.startDate === request.endDate) {
      return `${start.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}${request.isHalfDay ? ' (Half Day)' : ''}`;
    }

    return `${start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })} - ${end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  };

  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-800 rounded-lg shadow border-l-4',
        request.status === 'pending'
          ? 'border-orange-500'
          : request.status === 'approved'
          ? 'border-green-500'
          : request.status === 'rejected'
          ? 'border-red-500'
          : 'border-gray-300 dark:border-gray-600'
      )}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            {isManager && (
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-gray-900 dark:text-white">
                  {staffMember?.name || 'Unknown Staff'}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({staffMember?.role})
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-gray-900 dark:text-white font-medium">
                {formatDateRange()}
              </span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <span className={cn('font-medium capitalize', getLeaveTypeColor(request.leaveType))}>
                {request.leaveType} Leave
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                {request.totalDays} day{request.totalDays !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Status Badge */}
          <span
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-full border',
              getStatusColor(request.status)
            )}
          >
            {request.status}
          </span>
        </div>

        {/* Reason */}
        {request.reason && (
          <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Reason:</div>
            <div className="text-sm text-gray-900 dark:text-white">{request.reason}</div>
          </div>
        )}

        {/* Request Metadata */}
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Requested {new Date(request.requestedAt).toLocaleDateString()}</span>
          </div>
          {request.reviewedAt && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Reviewed {new Date(request.reviewedAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Review Notes (if reviewed) */}
        {request.reviewNotes && (
          <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400 mb-1">
              <MessageSquare className="w-4 h-4" />
              <span className="font-medium">Review Notes</span>
            </div>
            <div className="text-sm text-gray-900 dark:text-white">{request.reviewNotes}</div>
          </div>
        )}

        {/* Manager Actions */}
        {isManager && request.status === 'pending' && !showReviewForm && (
          <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                setReviewAction('approve');
                setShowReviewForm(true);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve
            </button>
            <button
              onClick={() => {
                setReviewAction('reject');
                setShowReviewForm(true);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Reject
            </button>
          </div>
        )}

        {/* Review Form */}
        {isManager && showReviewForm && (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
            <div
              className={cn(
                'p-3 rounded-lg border',
                reviewAction === 'approve'
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                {reviewAction === 'approve' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                )}
                <span
                  className={cn(
                    'font-medium',
                    reviewAction === 'approve'
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-red-700 dark:text-red-400'
                  )}
                >
                  {reviewAction === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
                </span>
              </div>

              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder={
                  reviewAction === 'approve'
                    ? 'Optional notes...'
                    : 'Please provide a reason for rejection...'
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white resize-none text-sm"
              />

              {reviewAction === 'reject' && !reviewNotes.trim() && (
                <div className="flex items-center gap-2 mt-2 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>Rejection reason is required</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowReviewForm(false);
                  setReviewNotes('');
                }}
                disabled={loading}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={loading || (reviewAction === 'reject' && !reviewNotes.trim())}
                className={cn(
                  'flex-1 px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
                  reviewAction === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                )}
              >
                {loading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
