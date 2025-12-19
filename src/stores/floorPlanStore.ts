import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FloorPlanState, Section, Table, StaffAssignment } from '../types/floor-plan';

interface FloorPlanStore extends FloorPlanState {
    // Actions
    addSection: (name: string) => void;
    removeSection: (id: string) => void;
    addTable: (sectionId: string, tableNumber: string, capacity: number) => void;
    removeTable: (id: string) => void;
    assignStaff: (userId: string, userName: string, sectionIds: string[]) => void;

    // Getters
    getSections: () => Section[];
    getTablesBySection: (sectionId: string) => Table[];
    getStaffAssignments: () => StaffAssignment[];
}

export const useFloorPlanStore = create<FloorPlanStore>()(
    persist(
        (set, get) => ({
            sections: [],
            tables: [],
            assignments: [],

            addSection: (name) => {
                const id = `sec-${Date.now()}`;
                set((state) => ({
                    sections: [...state.sections, { id, name, isActive: true }],
                }));
            },

            removeSection: (id) => {
                set((state) => ({
                    sections: state.sections.filter((s) => s.id !== id),
                    // Also remove tables in this section? For now keep them orphans or remove them
                    tables: state.tables.filter((t) => t.sectionId !== id),
                }));
            },

            addTable: (sectionId, tableNumber, capacity) => {
                const id = `tab-${Date.now()}`;
                const qrCodeUrl = `http://localhost:3000/table/${id}`; // Simplified for now
                set((state) => ({
                    tables: [
                        ...state.tables,
                        {
                            id,
                            sectionId,
                            tableNumber,
                            capacity,
                            qrCodeUrl,
                            status: 'available',
                        },
                    ],
                }));
            },

            removeTable: (id) => {
                set((state) => ({
                    tables: state.tables.filter((t) => t.id !== id),
                }));
            },

            assignStaff: (userId, userName, sectionIds) => {
                set((state) => {
                    // Remove existing assignment for this user
                    const otherAssignments = state.assignments.filter((a) => a.userId !== userId);
                    return {
                        assignments: [
                            ...otherAssignments,
                            { userId, userName, sectionIds, tableIds: [] },
                        ],
                    };
                });
            },

            getSections: () => get().sections,
            getTablesBySection: (sectionId) => get().tables.filter((t) => t.sectionId === sectionId),
            getStaffAssignments: () => get().assignments,
        }),
        {
            name: 'floor-plan-storage',
        }
    )
);
