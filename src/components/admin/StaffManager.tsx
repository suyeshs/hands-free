import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { useStaffStore, StaffMember } from '../../stores/staffStore';
import { UserRole } from '../../types/auth';

interface StaffManagerProps {
    tenantId?: string;
}

export const StaffManager = ({ tenantId }: StaffManagerProps) => {
    const { staff, addStaff, updateStaff, removeStaff, loadStaffFromDatabase, isLoaded, isLoading } = useStaffStore();

    // Load staff from database when tenantId is available
    useEffect(() => {
        if (tenantId && !isLoaded) {
            loadStaffFromDatabase(tenantId);
        }
    }, [tenantId, isLoaded, loadStaffFromDatabase]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [memberToDelete, setMemberToDelete] = useState<{ id: string; name: string } | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<StaffMember>>({
        name: '',
        role: UserRole.SERVER,
        pin: '',
        email: '',
        isActive: true,
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
            isActive: true,
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

        try {
            if (editingId) {
                await updateStaff(editingId, formData);
            } else {
                await addStaff({
                    name: formData.name || '',
                    role: formData.role || UserRole.SERVER,
                    pin: formData.pin || '',
                    email: formData.email,
                    isActive: formData.isActive ?? true,
                } as Omit<StaffMember, 'id' | 'joinedAt'>, tenantId);
            }
            setIsFormOpen(false);
        } catch (error) {
            console.error("Failed to save staff:", error);
            alert("Error saving staff member.");
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
                    <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center text-2xl">
                        👥
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight">Staff Directory</h2>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                            {staff.length} {staff.length === 1 ? 'Member' : 'Members'} Enrolled
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleAddNew}
                    disabled={!tenantId}
                    className="px-6 py-3 rounded-xl bg-accent text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    title={!tenantId ? 'Tenant ID required to add staff' : undefined}
                >
                    + Add Staff
                </button>
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
                                className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                            >
                                <span className="text-2xl leading-none">&times;</span>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 placeholder:text-muted-foreground/50"
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
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50"
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
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 placeholder:text-muted-foreground/50"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                    Email Address (Optional)
                                </label>
                                <input
                                    type="email"
                                    value={formData.email || ''}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="staff@restaurant.com"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 placeholder:text-muted-foreground/50"
                                />
                            </div>

                            <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/10">
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

                            <div className="flex gap-3 pt-4 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setIsFormOpen(false)}
                                    className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-muted-foreground font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 rounded-xl bg-accent text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all"
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
                                    className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-muted-foreground font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-red-500/20 hover:bg-red-600 transition-colors"
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
                                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-xl font-black text-accent">
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
                                    className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-bold uppercase hover:bg-white/10 transition-colors"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => confirmDelete(member.id, member.name)}
                                    className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
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
                            className="px-6 py-3 rounded-xl bg-accent text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20"
                        >
                            Add Your First Staff
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
