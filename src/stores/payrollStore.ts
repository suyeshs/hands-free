import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Database from '@tauri-apps/plugin-sql';

// Determine database name based on environment
const DB_NAME = import.meta.env.DEV ? "sqlite:pos-dev.db" : "sqlite:guanix.db";

// ===== Interfaces =====

export interface StaffSalary {
    id: string;
    staffId: string;
    baseSalary: number;
    hourlyRate?: number;
    overtimeRate?: number;
    salaryType: 'monthly' | 'hourly' | 'daily';
    effectiveFrom: string; // ISO date
    effectiveTo?: string; // ISO date, null if current
    createdAt: string;
    updatedAt: string;
}

export interface StaffAdvance {
    id: string;
    staffId: string;
    amount: number;
    reason?: string;
    advanceDate: string; // ISO date
    repaymentStartMonth: string; // YYYY-MM
    installments: number;
    installmentsPaid: number;
    status: 'pending' | 'active' | 'completed' | 'cancelled';
    createdAt: string;
    updatedAt: string;
}

export interface StaffDeduction {
    id: string;
    staffId: string;
    amount: number;
    type: 'penalty' | 'loan_repayment' | 'tax' | 'insurance' | 'other';
    reason: string;
    deductionMonth: string; // YYYY-MM
    isRecurring: boolean;
    createdAt: string;
}

export interface StaffBonus {
    id: string;
    staffId: string;
    amount: number;
    type: 'performance' | 'festival' | 'target' | 'other';
    reason: string;
    bonusMonth: string; // YYYY-MM
    createdAt: string;
}

export interface StaffPayslip {
    id: string;
    staffId: string;
    month: string; // YYYY-MM
    baseSalary: number;
    overtimePay: number;
    bonuses: number;
    advancesDeducted: number;
    otherDeductions: number;
    grossSalary: number;
    netSalary: number;
    daysWorked?: number;
    hoursWorked?: number;
    status: 'draft' | 'processed' | 'paid';
    paidDate?: string; // ISO date
    paymentMethod?: 'cash' | 'bank_transfer' | 'cheque' | 'upi';
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

// ===== Store Interface =====

interface PayrollStore {
    // State
    salaries: StaffSalary[];
    advances: StaffAdvance[];
    deductions: StaffDeduction[];
    bonuses: StaffBonus[];
    payslips: StaffPayslip[];
    isLoaded: boolean;
    isLoading: boolean;

    // Salary Actions
    loadSalaries: (tenantId: string) => Promise<void>;
    setSalary: (salary: Omit<StaffSalary, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateSalary: (id: string, updates: Partial<StaffSalary>) => Promise<void>;
    getCurrentSalary: (staffId: string) => StaffSalary | undefined;
    getSalaryHistory: (staffId: string) => StaffSalary[];

    // Advance Actions
    loadAdvances: (tenantId: string) => Promise<void>;
    addAdvance: (advance: Omit<StaffAdvance, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateAdvance: (id: string, updates: Partial<StaffAdvance>) => Promise<void>;
    getActiveAdvances: (staffId: string) => StaffAdvance[];
    getAdvanceBalance: (staffId: string) => number;
    payAdvanceInstallment: (advanceId: string) => Promise<void>;

    // Deduction Actions
    loadDeductions: (tenantId: string) => Promise<void>;
    addDeduction: (deduction: Omit<StaffDeduction, 'id' | 'createdAt'>) => Promise<void>;
    getDeductionsForMonth: (staffId: string, month: string) => StaffDeduction[];

    // Bonus Actions
    loadBonuses: (tenantId: string) => Promise<void>;
    addBonus: (bonus: Omit<StaffBonus, 'id' | 'createdAt'>) => Promise<void>;
    getBonusesForMonth: (staffId: string, month: string) => StaffBonus[];

    // Payslip Actions
    loadPayslips: (tenantId: string) => Promise<void>;
    generatePayslip: (staffId: string, month: string) => Promise<StaffPayslip>;
    updatePayslip: (id: string, updates: Partial<StaffPayslip>) => Promise<void>;
    getPayslipsForStaff: (staffId: string) => StaffPayslip[];
}

// ===== Store Implementation =====

export const usePayrollStore = create<PayrollStore>()(
    persist(
        (set, get) => ({
            // Initial State
            salaries: [],
            advances: [],
            deductions: [],
            bonuses: [],
            payslips: [],
            isLoaded: false,
            isLoading: false,

            // ===== SALARY ACTIONS =====

            loadSalaries: async (tenantId: string) => {
                if (get().isLoading) return;
                set({ isLoading: true });

                try {
                    const db = await Database.load(DB_NAME);

                    // Ensure table exists with correct foreign key
                    await db.execute(`
                        CREATE TABLE IF NOT EXISTS staff_salary (
                            id TEXT PRIMARY KEY,
                            staff_id TEXT NOT NULL,
                            base_salary REAL NOT NULL,
                            hourly_rate REAL,
                            overtime_rate REAL,
                            salary_type TEXT NOT NULL CHECK(salary_type IN ('monthly', 'hourly', 'daily')),
                            effective_from TEXT NOT NULL,
                            effective_to TEXT,
                            created_at TEXT NOT NULL DEFAULT (datetime('now')),
                            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                            FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
                        )
                    `);

                    // Create index if it doesn't exist
                    await db.execute(`CREATE INDEX IF NOT EXISTS idx_staff_salary_staff ON staff_salary(staff_id)`);

                    const result = await db.select<Array<{
                        id: string;
                        staff_id: string;
                        base_salary: number;
                        hourly_rate: number | null;
                        overtime_rate: number | null;
                        salary_type: string;
                        effective_from: string;
                        effective_to: string | null;
                        created_at: string;
                        updated_at: string;
                    }>>(`
                        SELECT ss.*
                        FROM staff_salary ss
                        JOIN staff_users su ON ss.staff_id = su.id
                        WHERE su.tenant_id = ?
                    `, [tenantId]);

                    const salaries: StaffSalary[] = result.map(row => ({
                        id: row.id,
                        staffId: row.staff_id,
                        baseSalary: row.base_salary,
                        hourlyRate: row.hourly_rate || undefined,
                        overtimeRate: row.overtime_rate || undefined,
                        salaryType: row.salary_type as 'monthly' | 'hourly' | 'daily',
                        effectiveFrom: row.effective_from,
                        effectiveTo: row.effective_to || undefined,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                    }));

                    set({ salaries, isLoaded: true, isLoading: false });
                    console.log(`[PayrollStore] Loaded ${salaries.length} salary records`);
                } catch (error) {
                    console.error('[PayrollStore] Failed to load salaries:', error);
                    set({ isLoading: false });
                }
            },

            setSalary: async (salary) => {
                const id = `salary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const now = new Date().toISOString();

                try {
                    const db = await Database.load(DB_NAME);

                    // Ensure table exists with correct foreign key
                    await db.execute(`
                        CREATE TABLE IF NOT EXISTS staff_salary (
                            id TEXT PRIMARY KEY,
                            staff_id TEXT NOT NULL,
                            base_salary REAL NOT NULL,
                            hourly_rate REAL,
                            overtime_rate REAL,
                            salary_type TEXT NOT NULL CHECK(salary_type IN ('monthly', 'hourly', 'daily')),
                            effective_from TEXT NOT NULL,
                            effective_to TEXT,
                            created_at TEXT NOT NULL DEFAULT (datetime('now')),
                            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                            FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
                        )
                    `);

                    // Create index if it doesn't exist
                    await db.execute(`CREATE INDEX IF NOT EXISTS idx_staff_salary_staff ON staff_salary(staff_id)`);

                    // End any existing current salary for this staff
                    await db.execute(`
                        UPDATE staff_salary
                        SET effective_to = ?
                        WHERE staff_id = ? AND effective_to IS NULL
                    `, [salary.effectiveFrom, salary.staffId]);

                    // Insert new salary
                    await db.execute(`
                        INSERT INTO staff_salary (
                            id, staff_id, base_salary, hourly_rate, overtime_rate,
                            salary_type, effective_from, effective_to, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        id,
                        salary.staffId,
                        salary.baseSalary,
                        salary.hourlyRate || null,
                        salary.overtimeRate || null,
                        salary.salaryType,
                        salary.effectiveFrom,
                        salary.effectiveTo || null,
                        now,
                        now,
                    ]);

                    const newSalary: StaffSalary = {
                        ...salary,
                        id,
                        createdAt: now,
                        updatedAt: now,
                    };

                    set((state) => ({
                        salaries: [...state.salaries.map(s =>
                            s.staffId === salary.staffId && !s.effectiveTo
                                ? { ...s, effectiveTo: salary.effectiveFrom }
                                : s
                        ), newSalary],
                    }));

                    console.log(`[PayrollStore] Set salary for staff ${salary.staffId}`);
                } catch (error) {
                    console.error('[PayrollStore] Failed to set salary:', error);
                    throw error;
                }
            },

            updateSalary: async (id, updates) => {
                const now = new Date().toISOString();

                try {
                    const db = await Database.load(DB_NAME);

                    await db.execute(`
                        UPDATE staff_salary
                        SET
                            base_salary = COALESCE(?, base_salary),
                            hourly_rate = COALESCE(?, hourly_rate),
                            overtime_rate = COALESCE(?, overtime_rate),
                            salary_type = COALESCE(?, salary_type),
                            effective_from = COALESCE(?, effective_from),
                            effective_to = COALESCE(?, effective_to),
                            updated_at = ?
                        WHERE id = ?
                    `, [
                        updates.baseSalary || null,
                        updates.hourlyRate || null,
                        updates.overtimeRate || null,
                        updates.salaryType || null,
                        updates.effectiveFrom || null,
                        updates.effectiveTo || null,
                        now,
                        id,
                    ]);

                    set((state) => ({
                        salaries: state.salaries.map(s =>
                            s.id === id ? { ...s, ...updates, updatedAt: now } : s
                        ),
                    }));

                    console.log(`[PayrollStore] Updated salary ${id}`);
                } catch (error) {
                    console.error('[PayrollStore] Failed to update salary:', error);
                    throw error;
                }
            },

            getCurrentSalary: (staffId) => {
                return get().salaries.find(s =>
                    s.staffId === staffId && !s.effectiveTo
                );
            },

            getSalaryHistory: (staffId) => {
                return get().salaries
                    .filter(s => s.staffId === staffId)
                    .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());
            },

            // ===== ADVANCE ACTIONS =====

            loadAdvances: async (tenantId: string) => {
                try {
                    const db = await Database.load(DB_NAME);

                    // Ensure table exists with correct foreign key
                    await db.execute(`
                        CREATE TABLE IF NOT EXISTS staff_advances (
                            id TEXT PRIMARY KEY,
                            staff_id TEXT NOT NULL,
                            amount REAL NOT NULL,
                            reason TEXT,
                            advance_date TEXT NOT NULL,
                            repayment_start_month TEXT NOT NULL,
                            installments INTEGER NOT NULL DEFAULT 1,
                            installments_paid INTEGER NOT NULL DEFAULT 0,
                            status TEXT NOT NULL CHECK(status IN ('pending', 'active', 'completed', 'cancelled')),
                            created_at TEXT NOT NULL DEFAULT (datetime('now')),
                            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                            FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
                        )
                    `);

                    // Create index if it doesn't exist
                    await db.execute(`CREATE INDEX IF NOT EXISTS idx_staff_advances_staff ON staff_advances(staff_id)`);

                    const result = await db.select<Array<{
                        id: string;
                        staff_id: string;
                        amount: number;
                        reason: string | null;
                        advance_date: string;
                        repayment_start_month: string;
                        installments: number;
                        installments_paid: number;
                        status: string;
                        created_at: string;
                        updated_at: string;
                    }>>(`
                        SELECT sa.*
                        FROM staff_advances sa
                        JOIN staff_users su ON sa.staff_id = su.id
                        WHERE su.tenant_id = ?
                    `, [tenantId]);

                    const advances: StaffAdvance[] = result.map(row => ({
                        id: row.id,
                        staffId: row.staff_id,
                        amount: row.amount,
                        reason: row.reason || undefined,
                        advanceDate: row.advance_date,
                        repaymentStartMonth: row.repayment_start_month,
                        installments: row.installments,
                        installmentsPaid: row.installments_paid,
                        status: row.status as 'pending' | 'active' | 'completed' | 'cancelled',
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                    }));

                    set({ advances });
                    console.log(`[PayrollStore] Loaded ${advances.length} advances`);
                } catch (error) {
                    console.error('[PayrollStore] Failed to load advances:', error);
                }
            },

            addAdvance: async (advance) => {
                const id = `advance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const now = new Date().toISOString();

                try {
                    const db = await Database.load(DB_NAME);

                    // Ensure table exists with correct foreign key
                    await db.execute(`
                        CREATE TABLE IF NOT EXISTS staff_advances (
                            id TEXT PRIMARY KEY,
                            staff_id TEXT NOT NULL,
                            amount REAL NOT NULL,
                            reason TEXT,
                            advance_date TEXT NOT NULL,
                            repayment_start_month TEXT NOT NULL,
                            installments INTEGER NOT NULL DEFAULT 1,
                            installments_paid INTEGER NOT NULL DEFAULT 0,
                            status TEXT NOT NULL CHECK(status IN ('pending', 'active', 'completed', 'cancelled')),
                            created_at TEXT NOT NULL DEFAULT (datetime('now')),
                            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                            FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
                        )
                    `);

                    // Create index if it doesn't exist
                    await db.execute(`CREATE INDEX IF NOT EXISTS idx_staff_advances_staff ON staff_advances(staff_id)`);

                    await db.execute(`
                        INSERT INTO staff_advances (
                            id, staff_id, amount, reason, advance_date,
                            repayment_start_month, installments, installments_paid,
                            status, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        id,
                        advance.staffId,
                        advance.amount,
                        advance.reason || null,
                        advance.advanceDate,
                        advance.repaymentStartMonth,
                        advance.installments,
                        advance.installmentsPaid,
                        advance.status,
                        now,
                        now,
                    ]);

                    const newAdvance: StaffAdvance = {
                        ...advance,
                        id,
                        createdAt: now,
                        updatedAt: now,
                    };

                    set((state) => ({
                        advances: [...state.advances, newAdvance],
                    }));

                    console.log(`[PayrollStore] Added advance ${id} for staff ${advance.staffId}`);
                } catch (error) {
                    console.error('[PayrollStore] Failed to add advance:', error);
                    throw error;
                }
            },

            updateAdvance: async (id, updates) => {
                const now = new Date().toISOString();

                try {
                    const db = await Database.load(DB_NAME);

                    await db.execute(`
                        UPDATE staff_advances
                        SET
                            installments_paid = COALESCE(?, installments_paid),
                            status = COALESCE(?, status),
                            updated_at = ?
                        WHERE id = ?
                    `, [
                        updates.installmentsPaid || null,
                        updates.status || null,
                        now,
                        id,
                    ]);

                    set((state) => ({
                        advances: state.advances.map(a =>
                            a.id === id ? { ...a, ...updates, updatedAt: now } : a
                        ),
                    }));

                    console.log(`[PayrollStore] Updated advance ${id}`);
                } catch (error) {
                    console.error('[PayrollStore] Failed to update advance:', error);
                    throw error;
                }
            },

            getActiveAdvances: (staffId) => {
                return get().advances.filter(a =>
                    a.staffId === staffId &&
                    (a.status === 'active' || a.status === 'pending')
                );
            },

            getAdvanceBalance: (staffId) => {
                const activeAdvances = get().getActiveAdvances(staffId);
                return activeAdvances.reduce((total, advance) => {
                    const remaining = advance.installments - advance.installmentsPaid;
                    const installmentAmount = advance.amount / advance.installments;
                    return total + (remaining * installmentAmount);
                }, 0);
            },

            payAdvanceInstallment: async (advanceId) => {
                const advance = get().advances.find(a => a.id === advanceId);
                if (!advance) return;

                const newPaid = advance.installmentsPaid + 1;
                const newStatus = newPaid >= advance.installments ? 'completed' : 'active';

                await get().updateAdvance(advanceId, {
                    installmentsPaid: newPaid,
                    status: newStatus,
                });
            },

            // ===== DEDUCTION ACTIONS =====

            loadDeductions: async (tenantId: string) => {
                try {
                    const db = await Database.load(DB_NAME);

                    // Ensure table exists with correct foreign key
                    await db.execute(`
                        CREATE TABLE IF NOT EXISTS staff_deductions (
                            id TEXT PRIMARY KEY,
                            staff_id TEXT NOT NULL,
                            amount REAL NOT NULL,
                            type TEXT NOT NULL CHECK(type IN ('penalty', 'loan_repayment', 'tax', 'insurance', 'other')),
                            reason TEXT NOT NULL,
                            deduction_month TEXT NOT NULL,
                            is_recurring BOOLEAN NOT NULL DEFAULT 0,
                            created_at TEXT NOT NULL DEFAULT (datetime('now')),
                            FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
                        )
                    `);

                    // Create index if it doesn't exist
                    await db.execute(`CREATE INDEX IF NOT EXISTS idx_staff_deductions_staff ON staff_deductions(staff_id)`);

                    const result = await db.select<Array<{
                        id: string;
                        staff_id: string;
                        amount: number;
                        type: string;
                        reason: string;
                        deduction_month: string;
                        is_recurring: number;
                        created_at: string;
                    }>>(`
                        SELECT sd.*
                        FROM staff_deductions sd
                        JOIN staff_users su ON sd.staff_id = su.id
                        WHERE su.tenant_id = ?
                    `, [tenantId]);

                    const deductions: StaffDeduction[] = result.map(row => ({
                        id: row.id,
                        staffId: row.staff_id,
                        amount: row.amount,
                        type: row.type as StaffDeduction['type'],
                        reason: row.reason,
                        deductionMonth: row.deduction_month,
                        isRecurring: row.is_recurring === 1,
                        createdAt: row.created_at,
                    }));

                    set({ deductions });
                    console.log(`[PayrollStore] Loaded ${deductions.length} deductions`);
                } catch (error) {
                    console.error('[PayrollStore] Failed to load deductions:', error);
                }
            },

            addDeduction: async (deduction) => {
                const id = `deduction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const now = new Date().toISOString();

                try {
                    const db = await Database.load(DB_NAME);

                    await db.execute(`
                        INSERT INTO staff_deductions (
                            id, staff_id, amount, type, reason, deduction_month, is_recurring, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        id,
                        deduction.staffId,
                        deduction.amount,
                        deduction.type,
                        deduction.reason,
                        deduction.deductionMonth,
                        deduction.isRecurring ? 1 : 0,
                        now,
                    ]);

                    const newDeduction: StaffDeduction = {
                        ...deduction,
                        id,
                        createdAt: now,
                    };

                    set((state) => ({
                        deductions: [...state.deductions, newDeduction],
                    }));

                    console.log(`[PayrollStore] Added deduction ${id}`);
                } catch (error) {
                    console.error('[PayrollStore] Failed to add deduction:', error);
                    throw error;
                }
            },

            getDeductionsForMonth: (staffId, month) => {
                return get().deductions.filter(d =>
                    d.staffId === staffId && d.deductionMonth === month
                );
            },

            // ===== BONUS ACTIONS =====

            loadBonuses: async (tenantId: string) => {
                try {
                    const db = await Database.load(DB_NAME);

                    // Ensure table exists with correct foreign key
                    await db.execute(`
                        CREATE TABLE IF NOT EXISTS staff_bonuses (
                            id TEXT PRIMARY KEY,
                            staff_id TEXT NOT NULL,
                            amount REAL NOT NULL,
                            type TEXT NOT NULL CHECK(type IN ('performance', 'festival', 'target', 'other')),
                            reason TEXT NOT NULL,
                            bonus_month TEXT NOT NULL,
                            created_at TEXT NOT NULL DEFAULT (datetime('now')),
                            FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
                        )
                    `);

                    // Create index if it doesn't exist
                    await db.execute(`CREATE INDEX IF NOT EXISTS idx_staff_bonuses_staff ON staff_bonuses(staff_id)`);

                    const result = await db.select<Array<{
                        id: string;
                        staff_id: string;
                        amount: number;
                        type: string;
                        reason: string;
                        bonus_month: string;
                        created_at: string;
                    }>>(`
                        SELECT sb.*
                        FROM staff_bonuses sb
                        JOIN staff_users su ON sb.staff_id = su.id
                        WHERE su.tenant_id = ?
                    `, [tenantId]);

                    const bonuses: StaffBonus[] = result.map(row => ({
                        id: row.id,
                        staffId: row.staff_id,
                        amount: row.amount,
                        type: row.type as StaffBonus['type'],
                        reason: row.reason,
                        bonusMonth: row.bonus_month,
                        createdAt: row.created_at,
                    }));

                    set({ bonuses });
                    console.log(`[PayrollStore] Loaded ${bonuses.length} bonuses`);
                } catch (error) {
                    console.error('[PayrollStore] Failed to load bonuses:', error);
                }
            },

            addBonus: async (bonus) => {
                const id = `bonus-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const now = new Date().toISOString();

                try {
                    const db = await Database.load(DB_NAME);

                    await db.execute(`
                        INSERT INTO staff_bonuses (
                            id, staff_id, amount, type, reason, bonus_month, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [
                        id,
                        bonus.staffId,
                        bonus.amount,
                        bonus.type,
                        bonus.reason,
                        bonus.bonusMonth,
                        now,
                    ]);

                    const newBonus: StaffBonus = {
                        ...bonus,
                        id,
                        createdAt: now,
                    };

                    set((state) => ({
                        bonuses: [...state.bonuses, newBonus],
                    }));

                    console.log(`[PayrollStore] Added bonus ${id}`);
                } catch (error) {
                    console.error('[PayrollStore] Failed to add bonus:', error);
                    throw error;
                }
            },

            getBonusesForMonth: (staffId, month) => {
                return get().bonuses.filter(b =>
                    b.staffId === staffId && b.bonusMonth === month
                );
            },

            // ===== PAYSLIP ACTIONS =====

            loadPayslips: async (tenantId: string) => {
                try {
                    const db = await Database.load(DB_NAME);

                    // Ensure table exists with correct foreign key
                    await db.execute(`
                        CREATE TABLE IF NOT EXISTS staff_payslips (
                            id TEXT PRIMARY KEY,
                            staff_id TEXT NOT NULL,
                            month TEXT NOT NULL,
                            base_salary REAL NOT NULL,
                            overtime_pay REAL DEFAULT 0,
                            bonuses REAL DEFAULT 0,
                            advances_deducted REAL DEFAULT 0,
                            other_deductions REAL DEFAULT 0,
                            gross_salary REAL NOT NULL,
                            net_salary REAL NOT NULL,
                            days_worked INTEGER,
                            hours_worked REAL,
                            status TEXT NOT NULL CHECK(status IN ('draft', 'processed', 'paid')) DEFAULT 'draft',
                            paid_date TEXT,
                            payment_method TEXT CHECK(payment_method IN ('cash', 'bank_transfer', 'cheque', 'upi')),
                            notes TEXT,
                            created_at TEXT NOT NULL DEFAULT (datetime('now')),
                            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                            FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE,
                            UNIQUE(staff_id, month)
                        )
                    `);

                    // Create index if it doesn't exist
                    await db.execute(`CREATE INDEX IF NOT EXISTS idx_staff_payslips_staff_month ON staff_payslips(staff_id, month)`);

                    const result = await db.select<Array<{
                        id: string;
                        staff_id: string;
                        month: string;
                        base_salary: number;
                        overtime_pay: number;
                        bonuses: number;
                        advances_deducted: number;
                        other_deductions: number;
                        gross_salary: number;
                        net_salary: number;
                        days_worked: number | null;
                        hours_worked: number | null;
                        status: string;
                        paid_date: string | null;
                        payment_method: string | null;
                        notes: string | null;
                        created_at: string;
                        updated_at: string;
                    }>>(`
                        SELECT sp.*
                        FROM staff_payslips sp
                        JOIN staff_users su ON sp.staff_id = su.id
                        WHERE su.tenant_id = ?
                    `, [tenantId]);

                    const payslips: StaffPayslip[] = result.map(row => ({
                        id: row.id,
                        staffId: row.staff_id,
                        month: row.month,
                        baseSalary: row.base_salary,
                        overtimePay: row.overtime_pay,
                        bonuses: row.bonuses,
                        advancesDeducted: row.advances_deducted,
                        otherDeductions: row.other_deductions,
                        grossSalary: row.gross_salary,
                        netSalary: row.net_salary,
                        daysWorked: row.days_worked || undefined,
                        hoursWorked: row.hours_worked || undefined,
                        status: row.status as 'draft' | 'processed' | 'paid',
                        paidDate: row.paid_date || undefined,
                        paymentMethod: row.payment_method as StaffPayslip['paymentMethod'] || undefined,
                        notes: row.notes || undefined,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                    }));

                    set({ payslips });
                    console.log(`[PayrollStore] Loaded ${payslips.length} payslips`);
                } catch (error) {
                    console.error('[PayrollStore] Failed to load payslips:', error);
                }
            },

            generatePayslip: async (staffId, month) => {
                const id = `payslip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const now = new Date().toISOString();

                try {
                    const db = await Database.load(DB_NAME);

                    // Get current salary
                    const salary = get().getCurrentSalary(staffId);
                    if (!salary) {
                        throw new Error('No salary configured for this staff member');
                    }

                    // Get bonuses for month
                    const monthBonuses = get().getBonusesForMonth(staffId, month);
                    const totalBonuses = monthBonuses.reduce((sum, b) => sum + b.amount, 0);

                    // Get deductions for month
                    const monthDeductions = get().getDeductionsForMonth(staffId, month);
                    const otherDeductions = monthDeductions.reduce((sum, d) => sum + d.amount, 0);

                    // Calculate advance deductions
                    const activeAdvances = get().getActiveAdvances(staffId);
                    let advancesDeducted = 0;
                    for (const advance of activeAdvances) {
                        const installmentAmount = advance.amount / advance.installments;
                        advancesDeducted += installmentAmount;
                        // Pay one installment
                        await get().payAdvanceInstallment(advance.id);
                    }

                    // Get attendance data
                    const attendanceData = await db.select<Array<{
                        hours_worked: number | null;
                        overtime_hours: number | null;
                    }>>(`
                        SELECT hours_worked, overtime_hours
                        FROM staff_attendance
                        WHERE staff_id = ? AND strftime('%Y-%m', date) = ?
                    `, [staffId, month]);

                    const totalHours = attendanceData.reduce((sum, a) => sum + (a.hours_worked || 0), 0);
                    const overtimeHours = attendanceData.reduce((sum, a) => sum + (a.overtime_hours || 0), 0);

                    // Calculate salary based on type
                    let baseSalary = salary.baseSalary;
                    let overtimePay = 0;

                    if (salary.salaryType === 'hourly') {
                        baseSalary = (salary.hourlyRate || 0) * totalHours;
                        overtimePay = (salary.overtimeRate || salary.hourlyRate || 0) * overtimeHours;
                    } else if (salary.salaryType === 'daily') {
                        const daysWorked = attendanceData.length;
                        baseSalary = salary.baseSalary * daysWorked;
                    }

                    const grossSalary = baseSalary + overtimePay + totalBonuses;
                    const netSalary = grossSalary - advancesDeducted - otherDeductions;

                    // Create payslip
                    await db.execute(`
                        INSERT INTO staff_payslips (
                            id, staff_id, month, base_salary, overtime_pay, bonuses,
                            advances_deducted, other_deductions, gross_salary, net_salary,
                            days_worked, hours_worked, status, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        id,
                        staffId,
                        month,
                        baseSalary,
                        overtimePay,
                        totalBonuses,
                        advancesDeducted,
                        otherDeductions,
                        grossSalary,
                        netSalary,
                        attendanceData.length,
                        totalHours,
                        'draft',
                        now,
                        now,
                    ]);

                    const newPayslip: StaffPayslip = {
                        id,
                        staffId,
                        month,
                        baseSalary,
                        overtimePay,
                        bonuses: totalBonuses,
                        advancesDeducted,
                        otherDeductions,
                        grossSalary,
                        netSalary,
                        daysWorked: attendanceData.length,
                        hoursWorked: totalHours,
                        status: 'draft',
                        createdAt: now,
                        updatedAt: now,
                    };

                    set((state) => ({
                        payslips: [...state.payslips, newPayslip],
                    }));

                    console.log(`[PayrollStore] Generated payslip ${id} for ${staffId} - ${month}`);
                    return newPayslip;
                } catch (error) {
                    console.error('[PayrollStore] Failed to generate payslip:', error);
                    throw error;
                }
            },

            updatePayslip: async (id, updates) => {
                const now = new Date().toISOString();

                try {
                    const db = await Database.load(DB_NAME);

                    await db.execute(`
                        UPDATE staff_payslips
                        SET
                            status = COALESCE(?, status),
                            paid_date = COALESCE(?, paid_date),
                            payment_method = COALESCE(?, payment_method),
                            notes = COALESCE(?, notes),
                            updated_at = ?
                        WHERE id = ?
                    `, [
                        updates.status || null,
                        updates.paidDate || null,
                        updates.paymentMethod || null,
                        updates.notes || null,
                        now,
                        id,
                    ]);

                    set((state) => ({
                        payslips: state.payslips.map(p =>
                            p.id === id ? { ...p, ...updates, updatedAt: now } : p
                        ),
                    }));

                    console.log(`[PayrollStore] Updated payslip ${id}`);
                } catch (error) {
                    console.error('[PayrollStore] Failed to update payslip:', error);
                    throw error;
                }
            },

            getPayslipsForStaff: (staffId) => {
                return get().payslips
                    .filter(p => p.staffId === staffId)
                    .sort((a, b) => b.month.localeCompare(a.month));
            },
        }),
        {
            name: 'payroll-storage',
            partialize: (state) => ({
                // Minimal persistence - SQLite is primary storage
                isLoaded: state.isLoaded,
            }),
        }
    )
);
