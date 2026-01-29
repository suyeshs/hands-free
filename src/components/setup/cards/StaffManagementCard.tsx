/**
 * StaffManagementCard Component
 * REQUIRED: Add staff members for authentication and service tracking
 */

import { useNavigate } from 'react-router-dom';
import { Users, ArrowRight, Plus } from 'lucide-react';
import { SetupCardBase } from '../SetupCardBase';
import { useStaffStore } from '../../../stores/staffStore';
import { cn } from '../../../lib/utils';

export function StaffManagementCard() {
  const navigate = useNavigate();
  const { staff } = useStaffStore();

  // Require at least 2 active staff members
  const activeStaff = staff.filter(s => s.isActive);
  const completed = activeStaff.length >= 2;

  const staffCount = activeStaff.length;
  const staffNeeded = Math.max(0, 2 - staffCount);

  return (
    <SetupCardBase
      id="staff-management"
      title="Add Staff Members"
      description="Add staff for authentication and role-based access"
      icon={Users}
      completed={completed}
      required={true}
      completionMessage={`${staffCount} staff member${staffCount !== 1 ? 's' : ''} added ✓`}
    >
      <div className="space-y-6">
        {/* Help Text */}
        <p className="text-sm text-gray-400">
          💡 Add your team members so they can log in and use the POS system with their assigned roles and PINs.
        </p>

        {/* Current Status */}
        <div className="p-6 rounded-xl bg-gradient-to-br from-surface-2 to-surface border border-border">
          <div className="text-center">
            <div className={cn(
              "text-5xl font-bold mb-2",
              staffCount >= 2 ? "text-green-400" : "text-amber-400"
            )}>
              {staffCount}
            </div>
            <div className="text-sm text-gray-400 mb-1">Active Staff Members</div>
            {staffCount < 2 && (
              <div className="text-xs text-amber-500">
                Add {staffNeeded} more to continue
              </div>
            )}
            {staffCount >= 2 && (
              <div className="text-xs text-green-500">
                Ready for team operations! ✓
              </div>
            )}
          </div>

          {/* Staff List Preview */}
          {staffCount > 0 && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="text-xs font-semibold text-gray-400 mb-3">Current Team:</div>
              <div className="space-y-2">
                {activeStaff.slice(0, 3).map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-paprika to-saffron flex items-center justify-center text-white font-bold text-sm">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-warm-white truncate">{member.name}</div>
                      <div className="text-xs text-gray-400 capitalize">{member.role}</div>
                    </div>
                  </div>
                ))}
                {activeStaff.length > 3 && (
                  <div className="text-xs text-gray-500 text-center">
                    +{activeStaff.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )}

          {!completed && staffCount > 0 && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                <p className="text-sm text-center text-amber-400 font-semibold">
                  Add {staffNeeded} more staff member{staffNeeded !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Progress Indicator */}
        {!completed && staffCount > 0 && (
          <div>
            <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
              <span>Staff Progress</span>
              <span>{Math.round((staffCount / 2) * 100)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-500"
                style={{ width: `${Math.min((staffCount / 2) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={() => navigate('/settings', {
            state: { openCategory: 'operations', openSetting: 'staff' }
          })}
          className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span>Manage Staff</span>
          <ArrowRight className="w-5 h-5" />
        </button>

        {/* Roles Information */}
        <div className="space-y-3 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <div className="font-bold text-sm text-indigo-300 mb-2">Available Roles:</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-400 mt-1 flex-shrink-0"></div>
              <div>
                <div className="font-semibold text-orange-300">Manager</div>
                <div className="text-gray-400">Full access to all features</div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400 mt-1 flex-shrink-0"></div>
              <div>
                <div className="font-semibold text-blue-300">Server</div>
                <div className="text-gray-400">Take orders, manage tables</div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 mt-1 flex-shrink-0"></div>
              <div>
                <div className="font-semibold text-green-300">Kitchen</div>
                <div className="text-gray-400">View and manage orders</div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-400 mt-1 flex-shrink-0"></div>
              <div>
                <div className="font-semibold text-purple-300">Owner</div>
                <div className="text-gray-400">Full system access + settings</div>
              </div>
            </div>
          </div>
        </div>

        {/* Security Note */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <div className="text-lg">🔒</div>
          <div className="flex-1">
            <div className="text-xs font-semibold text-yellow-300 mb-1">Security Note</div>
            <div className="text-xs text-gray-400">
              Each staff member gets a unique PIN for secure login. PINs are encrypted and never stored in plain text.
            </div>
          </div>
        </div>

        {/* Quick Start */}
        <div className="text-xs text-gray-500 space-y-2">
          <div className="font-semibold text-gray-400">Quick Start:</div>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Click "Manage Staff" to go to staff settings</li>
            <li>Add staff member with name, role, and 4-digit PIN</li>
            <li>Assign permissions based on their role</li>
          </ol>
        </div>
      </div>
    </SetupCardBase>
  );
}
