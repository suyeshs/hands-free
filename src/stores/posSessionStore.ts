/**
 * POS Session Store
 * Manages staff session for POS operations when staff PIN is required
 */

import { create } from 'zustand';

interface POSStaffInfo {
  id: string;
  name: string;
  role: string;
}

interface POSSessionStore {
  // State
  activeStaff: POSStaffInfo | null;
  assignedSectionIds: string[];
  loginTime: number | null; // timestamp

  // Actions
  setActiveStaff: (staff: POSStaffInfo, sectionIds: string[]) => void;
  clearSession: () => void;
  isSessionValid: (timeoutMinutes: number) => boolean;
  getSessionDurationMinutes: () => number;
}

export const usePOSSessionStore = create<POSSessionStore>()((set, get) => ({
  activeStaff: null,
  assignedSectionIds: [],
  loginTime: null,

  setActiveStaff: (staff, sectionIds) => {
    console.log('[POSSessionStore] Setting active staff:', staff.name, 'sections:', sectionIds);
    set({
      activeStaff: staff,
      assignedSectionIds: sectionIds,
      loginTime: Date.now(),
    });
  },

  clearSession: () => {
    console.log('[POSSessionStore] Clearing session');
    set({
      activeStaff: null,
      assignedSectionIds: [],
      loginTime: null,
    });
  },

  isSessionValid: (timeoutMinutes: number) => {
    const { loginTime } = get();

    // No session
    if (!loginTime) return false;

    // No timeout configured (0 = never expire)
    if (timeoutMinutes <= 0) return true;

    // Check if session has expired
    const now = Date.now();
    const elapsedMinutes = (now - loginTime) / (1000 * 60);
    return elapsedMinutes < timeoutMinutes;
  },

  getSessionDurationMinutes: () => {
    const { loginTime } = get();
    if (!loginTime) return 0;
    return Math.floor((Date.now() - loginTime) / (1000 * 60));
  },
}));
