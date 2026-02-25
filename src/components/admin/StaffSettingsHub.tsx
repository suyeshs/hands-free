/**
 * Staff Settings Hub - Centralized view for all staff-related settings
 */
import {
  Users,
  Clock,
  Smartphone,
  Calendar,
  Briefcase,
  Receipt,
  ChevronRight
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface StaffSettingOption {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}

interface StaffSettingsHubProps {
  tenantId?: string;
  onNavigateToSetting?: (settingId: string) => void;
}

export function StaffSettingsHub({ tenantId, onNavigateToSetting }: StaffSettingsHubProps) {
  const staffSettings: StaffSettingOption[] = [
    {
      id: 'staff-management',
      label: 'Staff Management',
      description: 'Add staff, roles, PINs, and documents',
      icon: Users,
      onClick: () => onNavigateToSetting?.('staff-management'),
    },
    {
      id: 'attendance',
      label: 'Attendance Tracking',
      description: 'Clock in/out and attendance records',
      icon: Clock,
      onClick: () => onNavigateToSetting?.('attendance'),
    },
    {
      id: 'wifi-attendance',
      label: 'WiFi & Auto-Attendance',
      description: 'WiFi access control and automatic clock-in',
      icon: Smartphone,
      onClick: () => onNavigateToSetting?.('wifi-attendance'),
    },
    {
      id: 'roster',
      label: 'Weekly Roster',
      description: 'Staff schedules and shift planning',
      icon: Calendar,
      onClick: () => onNavigateToSetting?.('roster'),
    },
    {
      id: 'leave',
      label: 'Leave Management',
      description: 'Leave requests and approvals',
      icon: Briefcase,
      onClick: () => onNavigateToSetting?.('leave'),
    },
    {
      id: 'payroll',
      label: 'Payroll & Advances',
      description: 'Salary, advances, and payslips',
      icon: Receipt,
      onClick: () => onNavigateToSetting?.('payroll'),
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#e8d4b8] mb-2">Staff Settings</h1>
        <p className="text-[#e8d4b8]/60">
          Manage all aspects of your staff - from basic information to attendance, schedules, and payroll
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {staffSettings.map((setting) => {
          const Icon = setting.icon;
          return (
            <button
              key={setting.id}
              onClick={setting.onClick}
              className={cn(
                "group relative bg-gradient-to-br from-[#e8d4b8]/5 to-[#e8d4b8]/[0.02]",
                "backdrop-blur-xl border border-[#e8d4b8]/10 rounded-2xl p-6",
                "cursor-pointer transition-all text-left",
                "hover:border-[#d97542]/30 hover:shadow-lg hover:shadow-[#d97542]/10"
              )}
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#d97542] to-[#c85a2a] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Icon className="w-6 h-6 text-white" />
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold text-[#e8d4b8] mb-2 flex items-center justify-between">
                {setting.label}
                <ChevronRight className="w-5 h-5 text-[#e8d4b8]/40 group-hover:text-[#d97542] group-hover:translate-x-1 transition-all" />
              </h3>

              <p className="text-sm text-[#e8d4b8]/60">
                {setting.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
