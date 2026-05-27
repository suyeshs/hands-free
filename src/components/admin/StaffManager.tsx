import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { useStaffStore, StaffMember } from '../../stores/staffStore';
import { usePayrollStore } from '../../stores/payrollStore';
import { UserRole } from '../../types/auth';

interface StaffManagerProps {
    tenantId?: string;
}

interface StaffFormData extends Partial<StaffMember> {
    // Salary configuration
    salaryEnabled?: boolean;
    salaryType?: 'monthly' | 'hourly' | 'daily';
    baseSalary?: number;
    hourlyRate?: number;
    overtimeRate?: number;

    // Initial advance
    advanceEnabled?: boolean;
    advanceAmount?: number;
    advanceReason?: string;
    advanceInstallments?: number;

    // Documents & KYC
    photoUrl?: string;
    aadhaarNumber?: string;
    aadhaarImageUrl?: string;
    panNumber?: string;

    // Bank details
    bankAccountNumber?: string;
    bankIfscCode?: string;
    bankName?: string;
    bankBranch?: string;
}

export const StaffManager = ({ tenantId }: StaffManagerProps) => {
    const { staff, addStaff, updateStaff, removeStaff, loadStaffFromDatabase, syncFromCloud, isLoaded, isLoading } = useStaffStore();
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'ok' | 'fail'>('idle');

    const handleSyncFromCloud = async () => {
        if (!tenantId || isSyncing) return;
        setIsSyncing(true);
        setSyncStatus('idle');
        try {
            await syncFromCloud(tenantId);
            setSyncStatus('ok');
            setTimeout(() => setSyncStatus('idle'), 3000);
        } catch {
            setSyncStatus('fail');
            setTimeout(() => setSyncStatus('idle'), 4000);
        } finally {
            setIsSyncing(false);
        }
    };
    const { setSalary, addAdvance, loadSalaries, loadAdvances } = usePayrollStore();

    // Load staff and payroll data; sync from cloud on first load (like menu sync)
    useEffect(() => {
        if (tenantId && !isLoaded) {
            loadStaffFromDatabase(tenantId).then(() => {
                syncFromCloud(tenantId).catch(console.error);
            });
            loadSalaries(tenantId);
            loadAdvances(tenantId);
        }
    }, [tenantId, isLoaded, loadStaffFromDatabase, syncFromCloud, loadSalaries, loadAdvances]);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [memberToDelete, setMemberToDelete] = useState<{ id: string; name: string } | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState<StaffFormData>({
        name: '',
        role: UserRole.SERVER,
        pin: '',
        email: '',
        phone: '',
        isActive: true,
        salaryEnabled: false,
        salaryType: 'monthly',
        baseSalary: 0,
        hourlyRate: 0,
        overtimeRate: 0,
        advanceEnabled: false,
        advanceAmount: 0,
        advanceReason: '',
        advanceInstallments: 1,
    });

    const handleEdit = (member: StaffMember) => {
        setEditingId(member.id);
        setFormData({ ...member });
        setIsFormOpen(true);
    };

    const handleAddNew = () => {
        setEditingId(null);
        setFormData({
            name: '',
            role: UserRole.SERVER,
            pin: '',
            email: '',
            phone: '',
            isActive: true,
            photoUrl: '',
            aadhaarNumber: '',
            aadhaarImageUrl: '',
            panNumber: '',
            bankAccountNumber: '',
            bankIfscCode: '',
            bankName: '',
            bankBranch: '',
            salaryEnabled: false,
            salaryType: 'monthly',
            baseSalary: 0,
            hourlyRate: 0,
            overtimeRate: 0,
            advanceEnabled: false,
            advanceAmount: 0,
            advanceReason: '',
            advanceInstallments: 1,
        });
        setIsFormOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Explicit validation check
        if (!formData.name?.trim()) {
            alert("Name is required");
            return;
        }

        // For new staff, PIN is required; for edit, PIN is optional (keep existing)
        if (!editingId && !formData.pin?.trim()) {
            alert("PIN is required for new staff members");
            return;
        }

        // Validate salary if enabled
        if (formData.salaryEnabled) {
            console.log('[StaffManager] Salary enabled - validating:', {
                salaryType: formData.salaryType,
                baseSalary: formData.baseSalary,
                hourlyRate: formData.hourlyRate,
                formDataKeys: Object.keys(formData)
            });

            if (formData.salaryType === 'monthly') {
                if (!formData.baseSalary || formData.baseSalary <= 0) {
                    console.error('[StaffManager] Monthly salary validation failed:', formData.baseSalary);
                    alert("Please enter a valid monthly salary (must be greater than 0)");
                    return;
                }
                console.log('[StaffManager] Monthly salary validation passed:', formData.baseSalary);
            }

            if (formData.salaryType === 'hourly') {
                if (!formData.hourlyRate || formData.hourlyRate <= 0) {
                    console.error('[StaffManager] Hourly rate validation failed:', formData.hourlyRate);
                    alert("Please enter a valid hourly rate (must be greater than 0)");
                    return;
                }
                console.log('[StaffManager] Hourly rate validation passed:', formData.hourlyRate);
            }

            if (formData.salaryType === 'daily') {
                if (!formData.baseSalary || formData.baseSalary <= 0) {
                    console.error('[StaffManager] Daily rate validation failed:', formData.baseSalary);
                    alert("Please enter a valid daily rate (must be greater than 0)");
                    return;
                }
                console.log('[StaffManager] Daily rate validation passed:', formData.baseSalary);
            }
        }

        // Validate advance if enabled
        if (formData.advanceEnabled) {
            if (!formData.advanceAmount || formData.advanceAmount <= 0) {
                alert("Please enter a valid advance amount");
                return;
            }
            if (!formData.advanceInstallments || formData.advanceInstallments < 1) {
                alert("Please enter valid number of installments");
                return;
            }
        }

        try {
            let staffId = editingId;

            if (editingId) {
                await updateStaff(editingId, {
                    name: formData.name,
                    role: formData.role,
                    pin: formData.pin,
                    email: formData.email,
                    phone: formData.phone,
                    isActive: formData.isActive,
                    photoUrl: formData.photoUrl,
                    aadhaarNumber: formData.aadhaarNumber,
                    aadhaarImageUrl: formData.aadhaarImageUrl,
                    panNumber: formData.panNumber,
                    bankAccountNumber: formData.bankAccountNumber,
                    bankIfscCode: formData.bankIfscCode,
                    bankName: formData.bankName,
                    bankBranch: formData.bankBranch,
                });
            } else {
                // Create new staff member
                const newStaffMember = {
                    name: formData.name || '',
                    role: formData.role || UserRole.SERVER,
                    pin: formData.pin || '',
                    email: formData.email,
                    phone: formData.phone,
                    isActive: formData.isActive ?? true,
                    photoUrl: formData.photoUrl,
                    aadhaarNumber: formData.aadhaarNumber,
                    aadhaarImageUrl: formData.aadhaarImageUrl,
                    panNumber: formData.panNumber,
                    bankAccountNumber: formData.bankAccountNumber,
                    bankIfscCode: formData.bankIfscCode,
                    bankName: formData.bankName,
                    bankBranch: formData.bankBranch,
                } as Omit<StaffMember, 'id' | 'joinedAt'>;

                // addStaff now returns the new staff ID
                staffId = await addStaff(newStaffMember, tenantId);
            }

            // Add salary configuration if enabled
            if (formData.salaryEnabled && staffId) {
                console.log('[StaffManager] Setting salary for staff:', staffId, {
                    baseSalary: formData.baseSalary,
                    hourlyRate: formData.hourlyRate,
                    overtimeRate: formData.overtimeRate,
                    salaryType: formData.salaryType
                });
                const today = new Date().toISOString().split('T')[0];
                try {
                    await setSalary({
                        staffId,
                        baseSalary: formData.baseSalary || 0,
                        hourlyRate: formData.hourlyRate,
                        overtimeRate: formData.overtimeRate,
                        salaryType: formData.salaryType || 'monthly',
                        effectiveFrom: today,
                    });
                    console.log('[StaffManager] Salary set successfully');
                } catch (salaryError) {
                    console.error('[StaffManager] Failed to set salary:', salaryError);
                    throw salaryError; // Re-throw to be caught by outer try-catch
                }
            }

            // Add initial advance if enabled
            if (formData.advanceEnabled && staffId && formData.advanceAmount) {
                const today = new Date().toISOString().split('T')[0];
                const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

                await addAdvance({
                    staffId,
                    amount: formData.advanceAmount,
                    reason: formData.advanceReason || 'Initial advance',
                    advanceDate: today,
                    repaymentStartMonth: currentMonth,
                    installments: formData.advanceInstallments || 1,
                    installmentsPaid: 0,
                    status: 'active',
                });
            }

            setIsFormOpen(false);
        } catch (error) {
            console.error("Failed to save staff:", error);
            alert("Error saving staff member: " + (error as Error).message);
        }
    };

    const confirmDelete = (id: string, name: string) => {
        setMemberToDelete({ id, name });
        setIsDeleteConfirmOpen(true);
    };

    const handleDelete = async () => {
        if (memberToDelete) {
            await removeStaff(memberToDelete.id);
            setIsDeleteConfirmOpen(false);
            setMemberToDelete(null);
        }
    };

    const getRoleBadgeColor = (role: UserRole) => {
        switch (role) {
            case UserRole.MANAGER:
                return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
            case UserRole.KITCHEN:
                return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
            case UserRole.SERVER:
                return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
            case UserRole.AGGREGATOR:
                return 'bg-green-500/20 text-green-300 border-green-500/30';
            default:
                return 'bg-accent/20 text-accent border-accent/30';
        }
    };

    // Show loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="glass-panel p-6 rounded-2xl border border-border flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-accent/20 flex items-center justify-center text-2xl">
                        👥
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight">Staff Directory</h2>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                            {staff.length} {staff.length === 1 ? 'Member' : 'Members'} Enrolled
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSyncFromCloud}
                        disabled={!tenantId || isSyncing}
                        className={cn(
                            "px-4 py-3 font-bold uppercase tracking-widest text-xs transition-all border",
                            syncStatus === 'ok' && "border-green-500 text-green-400 bg-green-500/10",
                            syncStatus === 'fail' && "border-red-500 text-red-400 bg-red-500/10",
                            syncStatus === 'idle' && "border-border text-muted-foreground hover:border-accent hover:text-accent",
                            "disabled:opacity-40 disabled:cursor-not-allowed"
                        )}
                        title="Pull staff from cloud (D1)"
                    >
                        {isSyncing ? '⟳ Syncing…' : syncStatus === 'ok' ? '✓ Synced' : syncStatus === 'fail' ? '✗ Failed' : '↓ Sync from Cloud'}
                    </button>
                    <button
                        onClick={handleAddNew}
                        disabled={!tenantId}
                        className="px-6 py-3 bg-accent text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        title={!tenantId ? 'Tenant ID required to add staff' : undefined}
                    >
                        + Add Staff
                    </button>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="glass-panel w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden animate-fade-in">
                        <div className="bg-accent/10 border-b border-border p-6 flex justify-between items-center">
                            <h3 className="text-xl font-black uppercase tracking-tight">
                                {editingId ? 'Edit Staff Member' : 'Add New Staff'}
                            </h3>
                            <button
                                onClick={() => setIsFormOpen(false)}
                                className="w-10 h-10 bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                            >
                                <span className="text-2xl leading-none">&times;</span>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                            {/* Basic Information */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-black uppercase text-accent tracking-widest">Basic Information</h4>

                                <div>
                                    <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="John Doe"
                                        required
                                        className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 placeholder:text-muted-foreground/50"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                            Role
                                        </label>
                                        <select
                                            value={formData.role}
                                            onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                                            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50"
                                        >
                                            {Object.values(UserRole).map(role => (
                                                <option key={role} value={role} className="bg-card text-foreground">
                                                    {role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                            Security PIN
                                        </label>
                                        <input
                                            type="password"
                                            value={formData.pin}
                                            onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                                            maxLength={4}
                                            placeholder="****"
                                            required
                                            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 placeholder:text-muted-foreground/50"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                            Email Address (Optional)
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.email || ''}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="staff@restaurant.com"
                                            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 placeholder:text-muted-foreground/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                            Phone Number (Optional)
                                        </label>
                                        <input
                                            type="tel"
                                            value={formData.phone || ''}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="+91 98765 43210"
                                            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 placeholder:text-muted-foreground/50"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 bg-white/5 p-4 border border-white/10">
                                    <input
                                        type="checkbox"
                                        id="isActive"
                                        checked={formData.isActive}
                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                        className="w-5 h-5 rounded accent-accent"
                                    />
                                    <label htmlFor="isActive" className="text-sm font-bold cursor-pointer select-none flex items-center gap-2">
                                        <span className={cn(
                                            "w-2 h-2 rounded-full",
                                            formData.isActive ? "bg-green-500" : "bg-red-500"
                                        )} />
                                        Account is {formData.isActive ? 'Active' : 'Inactive'}
                                    </label>
                                </div>
                            </div>

                            {/* Documents & KYC */}
                            <div className="space-y-4 pt-4 border-t border-border">
                                <h4 className="text-xs font-black uppercase text-accent tracking-widest">Documents & KYC</h4>

                                <div>
                                    <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                        Profile Photo URL (Optional)
                                    </label>
                                    <input
                                        type="url"
                                        value={formData.photoUrl || ''}
                                        onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                                        placeholder="https://example.com/photo.jpg"
                                        className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1">Upload to Cloudflare R2 for best results</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                            Aadhaar Number (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.aadhaarNumber || ''}
                                            onChange={(e) => setFormData({ ...formData, aadhaarNumber: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                                            placeholder="1234 5678 9012"
                                            maxLength={12}
                                            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                            PAN Card (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.panNumber || ''}
                                            onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase().slice(0, 10) })}
                                            placeholder="ABCDE1234F"
                                            maxLength={10}
                                            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-accent/50"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                        Aadhaar Card Image URL (Optional)
                                    </label>
                                    <input
                                        type="url"
                                        value={formData.aadhaarImageUrl || ''}
                                        onChange={(e) => setFormData({ ...formData, aadhaarImageUrl: e.target.value })}
                                        placeholder="https://example.com/aadhaar.jpg"
                                        className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                                    />
                                </div>
                            </div>

                            {/* Bank Details */}
                            <div className="space-y-4 pt-4 border-t border-border">
                                <h4 className="text-xs font-black uppercase text-accent tracking-widest">Bank Details</h4>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                            Account Number (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.bankAccountNumber || ''}
                                            onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                                            placeholder="123456789012"
                                            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                            IFSC Code (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.bankIfscCode || ''}
                                            onChange={(e) => setFormData({ ...formData, bankIfscCode: e.target.value.toUpperCase() })}
                                            placeholder="SBIN0001234"
                                            maxLength={11}
                                            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-accent/50"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                            Bank Name (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.bankName || ''}
                                            onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                                            placeholder="State Bank of India"
                                            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                            Branch Name (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.bankBranch || ''}
                                            onChange={(e) => setFormData({ ...formData, bankBranch: e.target.value })}
                                            placeholder="MG Road"
                                            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Salary Configuration */}
                            {!editingId && (
                                <div className="space-y-4 pt-4 border-t border-border">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="salaryEnabled"
                                            checked={formData.salaryEnabled}
                                            onChange={(e) => setFormData({ ...formData, salaryEnabled: e.target.checked })}
                                            className="w-5 h-5 rounded accent-accent"
                                        />
                                        <label htmlFor="salaryEnabled" className="text-xs font-black uppercase text-accent tracking-widest cursor-pointer">
                                            💰 Configure Salary
                                        </label>
                                    </div>

                                    {formData.salaryEnabled && (
                                        <div className="space-y-3 pl-8">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                                    Salary Type
                                                </label>
                                                <select
                                                    value={formData.salaryType}
                                                    onChange={(e) => setFormData({ ...formData, salaryType: e.target.value as 'monthly' | 'hourly' | 'daily' })}
                                                    className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                                                >
                                                    <option value="monthly">Monthly Salary</option>
                                                    <option value="hourly">Hourly Rate</option>
                                                    <option value="daily">Daily Rate</option>
                                                </select>
                                            </div>

                                            {formData.salaryType === 'monthly' && (
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                                        Monthly Salary (₹) {formData.baseSalary > 0 && `- Current: ₹${formData.baseSalary}`}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={formData.baseSalary || ''}
                                                        onChange={(e) => {
                                                            const inputValue = e.target.value;
                                                            const value = inputValue === '' ? 0 : parseFloat(inputValue);
                                                            const finalValue = isNaN(value) ? 0 : value;
                                                            console.log('[StaffManager] Salary input changed:', { inputValue, value, finalValue });
                                                            setFormData({ ...formData, baseSalary: finalValue });
                                                        }}
                                                        placeholder="Enter monthly salary (e.g., 25000)"
                                                        min="1"
                                                        step="any"
                                                        required={formData.salaryEnabled}
                                                        className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                                                    />
                                                    {formData.baseSalary === 0 && (
                                                        <p className="text-xs text-yellow-400 mt-1">⚠️ Please enter a salary amount</p>
                                                    )}
                                                </div>
                                            )}

                                            {formData.salaryType === 'hourly' && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                                            Hourly Rate (₹)
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={formData.hourlyRate || ''}
                                                            onChange={(e) => {
                                                                const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                                setFormData({ ...formData, hourlyRate: isNaN(value) ? 0 : value });
                                                            }}
                                                            placeholder="150"
                                                            min="0"
                                                            step="any"
                                                            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                                            Overtime Rate (₹)
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={formData.overtimeRate || ''}
                                                            onChange={(e) => {
                                                                const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                                setFormData({ ...formData, overtimeRate: isNaN(value) ? 0 : value });
                                                            }}
                                                            placeholder="225"
                                                            min="0"
                                                            step="any"
                                                            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {formData.salaryType === 'daily' && (
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                                        Daily Rate (₹)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={formData.baseSalary || ''}
                                                        onChange={(e) => {
                                                            const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                            setFormData({ ...formData, baseSalary: isNaN(value) ? 0 : value });
                                                        }}
                                                        placeholder="800"
                                                        min="0"
                                                        step="any"
                                                        className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Initial Advance */}
                            {!editingId && (
                                <div className="space-y-4 pt-4 border-t border-border">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="advanceEnabled"
                                            checked={formData.advanceEnabled}
                                            onChange={(e) => setFormData({ ...formData, advanceEnabled: e.target.checked })}
                                            className="w-5 h-5 rounded accent-accent"
                                        />
                                        <label htmlFor="advanceEnabled" className="text-xs font-black uppercase text-accent tracking-widest cursor-pointer">
                                            💵 Provide Initial Advance
                                        </label>
                                    </div>

                                    {formData.advanceEnabled && (
                                        <div className="space-y-3 pl-8">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                                        Amount (₹)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={formData.advanceAmount || ''}
                                                        onChange={(e) => setFormData({ ...formData, advanceAmount: parseFloat(e.target.value) || 0 })}
                                                        placeholder="5000"
                                                        min="0"
                                                        step="100"
                                                        className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                                        Installments
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={formData.advanceInstallments || ''}
                                                        onChange={(e) => setFormData({ ...formData, advanceInstallments: parseInt(e.target.value) || 1 })}
                                                        placeholder="3"
                                                        min="1"
                                                        max="12"
                                                        className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                                    Reason (Optional)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={formData.advanceReason || ''}
                                                    onChange={(e) => setFormData({ ...formData, advanceReason: e.target.value })}
                                                    placeholder="Joining bonus, emergency, etc."
                                                    className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                                                />
                                            </div>
                                            {formData.advanceAmount && formData.advanceInstallments && formData.advanceInstallments > 0 && (
                                                <div className="bg-blue-500/10 border border-blue-500/20 p-3">
                                                    <p className="text-xs text-blue-300">
                                                        <strong>Monthly deduction:</strong> ₹{(formData.advanceAmount / formData.advanceInstallments).toFixed(2)} for {formData.advanceInstallments} month{formData.advanceInstallments > 1 ? 's' : ''}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-3 pt-4 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setIsFormOpen(false)}
                                    className="flex-1 py-3 bg-white/5 border border-white/10 text-muted-foreground font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-accent text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all"
                                >
                                    {editingId ? 'Save Changes' : 'Add Staff'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteConfirmOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
                    <div className="glass-panel w-full max-w-sm rounded-2xl border-2 border-red-500/50 shadow-2xl overflow-hidden animate-fade-in">
                        <div className="bg-red-500/20 border-b border-red-500/30 p-6 text-center">
                            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">⚠️</span>
                            </div>
                            <h3 className="text-xl font-black uppercase text-red-400">
                                Delete Staff Member
                            </h3>
                        </div>
                        <div className="p-6 text-center">
                            <p className="text-muted-foreground mb-2">
                                Are you sure you want to remove
                            </p>
                            <p className="text-2xl font-black text-foreground mb-4">
                                {memberToDelete?.name}
                            </p>
                            <p className="text-xs text-muted-foreground mb-6">
                                This action cannot be undone.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsDeleteConfirmOpen(false)}
                                    className="flex-1 py-3 bg-white/5 border border-white/10 text-muted-foreground font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="flex-1 py-3 bg-red-500 text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-red-500/20 hover:bg-red-600 transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Staff Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {staff.map((member) => (
                    <div
                        key={member.id}
                        className={cn(
                            "glass-panel p-5 rounded-2xl border border-border transition-all hover:border-accent/30 group",
                            !member.isActive && "opacity-60"
                        )}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-accent/10 flex items-center justify-center text-xl font-black text-accent">
                                    {member.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg leading-tight group-hover:text-accent transition-colors">
                                        {member.name}
                                    </h3>
                                    <div className={cn(
                                        "text-[10px] font-black uppercase px-2 py-0.5 rounded-full border mt-1 inline-block",
                                        getRoleBadgeColor(member.role)
                                    )}>
                                        {member.role}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className={cn(
                                    "w-2 h-2 rounded-full",
                                    member.isActive ? "bg-green-500" : "bg-red-500"
                                )} />
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                    {member.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>

                        <div className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
                            <span className="opacity-50">@</span>
                            {member.email || 'No email registered'}
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-border">
                            <div className="text-[10px] text-muted-foreground font-mono">
                                ID: {member.id.split('-')[0]}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleEdit(member)}
                                    className="px-4 py-2 bg-white/5 border border-white/10 text-xs font-bold uppercase hover:bg-white/10 transition-colors"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => confirmDelete(member.id, member.name)}
                                    className="px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {staff.length === 0 && (
                    <div className="col-span-full glass-panel p-12 rounded-2xl border border-border border-dashed text-center">
                        <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                            <span className="text-4xl">👥</span>
                        </div>
                        <p className="text-xl font-bold text-muted-foreground mb-2">No Staff Members</p>
                        <p className="text-sm text-muted-foreground mb-6">Add your first team member to get started</p>
                        <button
                            onClick={handleAddNew}
                            className="px-6 py-3 bg-accent text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20"
                        >
                            Add Your First Staff
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
