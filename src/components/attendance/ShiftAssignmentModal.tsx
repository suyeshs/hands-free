/**
 * Shift Assignment Modal Component
 * Modal for adding/editing shift assignments in the weekly roster
 */

import { useState, useEffect } from 'react';
import { X, Save, Trash2, AlertCircle } from 'lucide-react';
import { useRosteringStore } from '../../stores/rosteringStore';
import { useStaffStore } from '../../stores/staffStore';
import { useTenantStore } from '../../stores/tenantStore';
import { getCurrentTenantId } from '../../services/tauriAuth';

interface ShiftAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  rosterId: string;
  shiftDate: string;
  staffId?: string;
  assignment?: any; // Existing assignment for editing
  onSaved?: () => void;
}

export function ShiftAssignmentModal({
  isOpen,
  onClose,
  rosterId,
  shiftDate,
  staffId: initialStaffId = '',
  assignment,
  onSaved,
}: ShiftAssignmentModalProps) {
  const { tenant } = useTenantStore();
  const { staff } = useStaffStore();
  const {
    addAssignment,
    updateAssignment,
    deleteAssignment,
    detectConflicts,
  } = useRosteringStore();

  const [tenantId, setTenantId] = useState('');
  const [staffId, setStaffId] = useState(initialStaffId);
  const [shiftStart, setShiftStart] = useState('09:00');
  const [shiftEnd, setShiftEnd] = useState('17:00');
  const [shiftType, setShiftType] = useState<'regular' | 'split' | 'overnight' | 'on-call'>('regular');
  const [role, setRole] = useState('');
  const [position, setPosition] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const isEditing = !!assignment;

  // Get tenant ID
  useEffect(() => {
    const getTenant = async () => {
      const id = await getCurrentTenantId();
      setTenantId(id || tenant?.tenantId || '');
    };
    getTenant();
  }, [tenant]);

  // Load assignment data when editing
  useEffect(() => {
    if (assignment) {
      setStaffId(assignment.staffId);
      setShiftStart(assignment.shiftStart);
      setShiftEnd(assignment.shiftEnd);
      setShiftType(assignment.shiftType);
      setRole(assignment.role || '');
      setPosition(assignment.position || '');
      setNotes(assignment.notes || '');
    }
  }, [assignment]);

  // Check for conflicts when staff or date changes
  useEffect(() => {
    if (!staffId || !shiftDate) return;

    // Create temp assignment to check conflicts
    const tempAssignment = {
      id: assignment?.id || 'temp',
      tenantId,
      rosterId,
      staffId,
      shiftDate,
      dayOfWeek: new Date(shiftDate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
      shiftStart,
      shiftEnd,
      shiftType,
      role,
      position,
      status: 'scheduled' as const,
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const conflictResult = detectConflicts(tempAssignment);

    // Filter out self when editing
    if (isEditing && conflictResult.conflicts.length > 0) {
      const filteredConflicts = conflictResult.conflicts.filter(c => c.id !== assignment.id);
      setConflict(filteredConflicts.length > 0 ? { hasConflict: true, conflicts: filteredConflicts } : null);
    } else {
      setConflict(conflictResult.hasConflict ? conflictResult : null);
    }
  }, [staffId, shiftDate, tenantId, rosterId, isEditing, assignment, shiftStart, shiftEnd, shiftType, role, position, notes, detectConflicts]);

  // Handle save
  const handleSave = async () => {
    // Validate
    if (!staffId) {
      setError('Please select a staff member');
      return;
    }
    if (!shiftStart || !shiftEnd) {
      setError('Please enter shift start and end times');
      return;
    }

    // Warn about conflicts but allow override
    if (conflict && conflict.hasConflict) {
      const confirmOverride = window.confirm(
        `Warning: ${conflict.conflicts[0]?.staffName || 'This staff member'} already has a shift on this date. Do you want to continue anyway?`
      );
      if (!confirmOverride) return;
    }

    setError('');
    setLoading(true);

    try {
      const dayOfWeek = new Date(shiftDate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

      if (isEditing) {
        // Update existing assignment
        await updateAssignment(assignment.id, {
          shiftStart,
          shiftEnd,
          shiftType,
          role: role || undefined,
          position: position || undefined,
          notes: notes || undefined,
        });
      } else {
        // Create new assignment
        await addAssignment({
          tenantId,
          rosterId,
          staffId,
          shiftDate,
          dayOfWeek,
          shiftStart,
          shiftEnd,
          shiftType,
          role: role || undefined,
          position: position || undefined,
          status: 'scheduled',
          notes: notes || undefined,
        });
      }

      onSaved?.();
      onClose();
    } catch (err: any) {
      console.error('[ShiftAssignmentModal] Failed to save assignment:', err);
      setError(err.message || 'Failed to save assignment');
    } finally {
      setLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!assignment) return;

    const confirmDelete = window.confirm('Are you sure you want to delete this shift assignment?');
    if (!confirmDelete) return;

    setLoading(true);

    try {
      await deleteAssignment(assignment.id);
      onSaved?.();
      onClose();
    } catch (err: any) {
      console.error('[ShiftAssignmentModal] Failed to delete assignment:', err);
      setError(err.message || 'Failed to delete assignment');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedStaff = staff.find(s => s.id === staffId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Shift Assignment' : 'Add Shift Assignment'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Date Display */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
            <div className="text-sm text-gray-600 dark:text-gray-400">Date</div>
            <div className="text-lg font-medium text-gray-900 dark:text-white">
              {new Date(shiftDate).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          </div>

          {/* Staff Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Staff Member *
            </label>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              disabled={isEditing} // Can't change staff when editing
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select staff member...</option>
              {staff
                .filter(s => s.isActive)
                .map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
            </select>
          </div>

          {/* Conflict Warning */}
          {conflict && conflict.hasConflict && (
            <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg text-sm text-orange-700 dark:text-orange-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Scheduling Conflict</div>
                <div className="text-xs mt-1">
                  {selectedStaff?.name} already has {conflict.conflicts.length} shift(s) on this date
                </div>
              </div>
            </div>
          )}

          {/* Shift Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Time *
              </label>
              <input
                type="time"
                value={shiftStart}
                onChange={(e) => setShiftStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Time *
              </label>
              <input
                type="time"
                value={shiftEnd}
                onChange={(e) => setShiftEnd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {/* Shift Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Shift Type
            </label>
            <select
              value={shiftType}
              onChange={(e) => setShiftType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="regular">Regular</option>
              <option value="split">Split Shift</option>
              <option value="overnight">Overnight</option>
              <option value="on-call">On-Call</option>
            </select>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role/Position
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g., Server, Chef, Host"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Position/Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Section/Area
            </label>
            <input
              type="text"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g., Bar, Dining Room, Kitchen"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white resize-none"
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div>
            {isEditing && (
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !staffId}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : isEditing ? 'Update' : 'Add Shift'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
