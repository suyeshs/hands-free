import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserRole } from '../types/auth';

export interface StaffMember {
    id: string;
    name: string;
    role: UserRole;
    pin: string;
    email?: string;
    phone?: string;
    isActive: boolean;
    joinedAt: string;
}

interface StaffStore {
    staff: StaffMember[];

    // Actions
    addStaff: (staff: Omit<StaffMember, 'id' | 'joinedAt'>) => void;
    updateStaff: (id: string, updates: Partial<StaffMember>) => void;
    removeStaff: (id: string) => void;
    getStaffByPin: (pin: string) => StaffMember | undefined;
}

export const useStaffStore = create<StaffStore>()(
    persist(
        (set, get) => ({
            staff: [
                // Initial Dummy Data
                {
                    id: 'staff-1',
                    name: 'John Doe',
                    role: UserRole.SERVER,
                    pin: '1234',
                    isActive: true,
                    joinedAt: new Date().toISOString()
                },
                {
                    id: 'staff-2',
                    name: 'Jane Smith',
                    role: UserRole.MANAGER,
                    pin: '9999',
                    email: 'jane@example.com',
                    isActive: true,
                    joinedAt: new Date().toISOString()
                },
                {
                    id: 'staff-3',
                    name: 'Mike Ross',
                    role: UserRole.KITCHEN,
                    pin: '5678',
                    isActive: true,
                    joinedAt: new Date().toISOString()
                }
            ],

            addStaff: (newStaff) => {
                const id = `staff-${Date.now()}`;
                const timestamp = new Date().toISOString();
                set((state) => ({
                    staff: [
                        ...state.staff,
                        {
                            ...newStaff,
                            id,
                            joinedAt: timestamp,
                        } as StaffMember,
                    ],
                }));
                console.log(`[StaffStore] Added staff: ${id}`);
            },

            updateStaff: (id, updates) => {
                set((state) => ({
                    staff: state.staff.map((s) => (s.id === id ? { ...s, ...updates } : s)),
                }));
                console.log(`[StaffStore] Updated staff: ${id}`);
            },

            removeStaff: (id) => {
                set((state) => ({
                    staff: state.staff.filter((s) => s.id !== id),
                }));
                console.log(`[StaffStore] Removed staff: ${id}`);
            },

            getStaffByPin: (pin) => {
                const { staff } = get();
                return staff.find(s => s.pin === pin && s.isActive);
            }
        }),
        {
            name: 'staff-storage',
        }
    )
);
