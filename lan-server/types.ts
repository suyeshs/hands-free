/**
 * Dine-in Floor Plan Types
 */

export interface Section {
    id: string;
    name: string; // e.g., "Patio", "Main Hall"
    isActive: boolean;
}

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';

export interface Table {
    id: string;
    sectionId: string;
    tableNumber: string;
    capacity: number;
    qrCodeUrl: string; // Generated URL
    status: TableStatus;
    assignedStaffId?: string;
    currentOrderId?: string;
    lastActiveAt?: string; // ISO timestamp
}

export interface StaffAssignment {
    userId: string; // Links to AuthUser.id
    userName: string;
    sectionIds: string[]; // Staff can be assigned to whole sections
    tableIds: string[]; // Or specific tables overrides
}

export interface FloorPlanState {
    sections: Section[];
    tables: Table[];
    assignments: StaffAssignment[];
}
