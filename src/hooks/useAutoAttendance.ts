/**
 * useAutoAttendance Hook
 * Handles automatic attendance marking when staff connect to restaurant WiFi
 *
 * Features:
 * - Hybrid staff identification (session-based or device-assigned)
 * - Leave management integration (no auto clock-in for staff on leave)
 * - Cooldown protection (prevents rapid re-clocking)
 * - Toast notifications for user feedback
 */

import { useEffect, useCallback } from 'react';
import { useNetwork } from '../contexts/NetworkContext';
import { useAuthStore } from '../stores/authStore';
import { useDeviceStore } from '../stores/deviceStore';
import { useAttendanceStore } from '../stores/attendanceStore';
import { useTenantStore } from '../stores/tenantStore';
import { useRestaurantSettingsStore } from '../stores/restaurantSettingsStore';
import { useLeaveStore } from '../stores/leaveStore';
import { toast } from 'sonner';

export function useAutoAttendance() {
  const { onWiFiConnected } = useNetwork();
  const { user } = useAuthStore();
  const { assignedStaffId } = useDeviceStore();
  const { clockIn, getActiveRecordForStaff } = useAttendanceStore();
  const { tenant } = useTenantStore();
  const { settings } = useRestaurantSettingsStore();
  const { requests: leaveRequests } = useLeaveStore();

  const handleWiFiConnected = useCallback(async () => {
    try {
      // GUARD 1: Check if auto-attendance is enabled
      if (!settings?.auto_attendance_enabled) {
        console.log('[AutoAttendance] Feature disabled in settings');
        return;
      }

      // GUARD 2: Identify staff member (hybrid approach: session first, then device assignment)
      const staffId = user?.id || assignedStaffId;
      if (!staffId) {
        console.log('[AutoAttendance] No staff identified (no session, no device assignment), skipping auto clock-in');
        return;
      }

      // GUARD 3: Check if staff has approved leave for today (CRITICAL)
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const hasLeaveToday = leaveRequests.some(request =>
        request.staffId === staffId &&
        request.status === 'approved' &&
        request.startDate <= today &&
        request.endDate >= today
      );

      if (hasLeaveToday) {
        console.log('[AutoAttendance] Staff has approved leave today, skipping auto clock-in');
        return;
      }

      // GUARD 4: Check if already clocked in
      const existingRecord = getActiveRecordForStaff(staffId);
      if (existingRecord) {
        console.log('[AutoAttendance] Staff already clocked in, skipping');
        return;
      }

      // GUARD 5: Check cooldown (5 minutes)
      const cooldownKey = `last-auto-clock-in-${staffId}`;
      const lastAutoClockIn = sessionStorage.getItem(cooldownKey);
      if (lastAutoClockIn) {
        const elapsed = Date.now() - parseInt(lastAutoClockIn);
        const cooldownPeriod = 5 * 60 * 1000; // 5 minutes in milliseconds
        if (elapsed < cooldownPeriod) {
          console.log('[AutoAttendance] Cooldown active, skipping auto clock-in');
          return;
        }
      }

      // EXECUTE: Auto clock-in
      console.log('[AutoAttendance] All guards passed, executing auto clock-in for staff:', staffId);

      await clockIn(staffId, tenant?.tenantId || '', {
        method: 'wifi-auto',
        deviceId: 'default', // Could get actual device ID if needed
      });

      // Store cooldown timestamp
      sessionStorage.setItem(cooldownKey, Date.now().toString());

      // Show success notification
      toast.success('Automatically clocked in via WiFi', {
        duration: 4000,
        description: 'You are now on the clock',
      });

      console.log('[AutoAttendance] Auto clock-in successful');
    } catch (error) {
      console.error('[AutoAttendance] Auto clock-in failed:', error);
      // Silent failure - user can manually clock in
      // Don't show error toast to avoid annoying users on connection issues
    }
  }, [
    settings?.auto_attendance_enabled,
    user?.id,
    assignedStaffId,
    leaveRequests,
    getActiveRecordForStaff,
    clockIn,
    tenant?.tenantId,
  ]);

  // Subscribe to WiFi connection events
  useEffect(() => {
    const unsubscribe = onWiFiConnected(handleWiFiConnected);
    return unsubscribe;
  }, [onWiFiConnected, handleWiFiConnected]);

  return {
    handleWiFiConnected, // Expose for manual triggering if needed
  };
}
