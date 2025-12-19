import { useState, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { useStaffStore, StaffMember } from '../../stores/staffStore';
import { UserRole } from '../../types/auth';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';
import { IndustrialCard } from '../ui-industrial/IndustrialCard';
import { IndustrialInput } from '../ui-industrial/IndustrialInput';

export const StaffManager = () => {
    const { staff, addStaff, updateStaff, removeStaff } = useStaffStore();
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Explicit validation check
        if (!formData.name?.trim() || !formData.pin?.trim()) {
            alert("Name and PIN are required");
            return;
        }

        try {
            if (editingId) {
                updateStaff(editingId, formData);
            } else {
                addStaff({
                    name: formData.name || '',
                    role: formData.role || UserRole.SERVER,
                    pin: formData.pin || '',
                    email: formData.email,
                    isActive: formData.isActive ?? true,
                } as Omit<StaffMember, 'id' | 'joinedAt'>);
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

    const handleDelete = () => {
        if (memberToDelete) {
            removeStaff(memberToDelete.id);
            setIsDeleteConfirmOpen(false);
            setMemberToDelete(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-100 p-4 border-l-4 border-slate-800">
                <div>
                    <h2 className="text-xl font-black uppercase text-slate-800">Staff Directory</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase">Total Members: {staff.length}</p>
                </div>
                <IndustrialButton onClick={handleAddNew} size="md">
                    + Add New Staff
                </IndustrialButton>
            </div>

            {/* Custom Modal for Add/Edit */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <IndustrialCard variant="raised" className="bg-white w-full max-w-lg border-4 border-slate-900 shadow-2xl">
                        <div className="flex justify-between items-center mb-6 border-b-4 border-slate-100 pb-4">
                            <h3 className="text-2xl font-black uppercase italic">
                                {editingId ? 'Modify Staff' : 'Enlist Staff'}
                            </h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-4xl leading-none">&times;</button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <IndustrialInput
                                label="Full Legal Name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. JOHN DOE"
                                required
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <div className="w-full">
                                    <label className="block text-sm font-bold uppercase tracking-wider text-gray-700 mb-1">Assigned Role</label>
                                    <select
                                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 focus:bg-white focus:border-slate-800 focus:outline-none transition-colors text-lg font-medium"
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                                    >
                                        {Object.values(UserRole).map(role => (
                                            <option key={role} value={role}>{role.toUpperCase()}</option>
                                        ))}
                                    </select>
                                </div>
                                <IndustrialInput
                                    label="Security PIN"
                                    value={formData.pin}
                                    onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                                    maxLength={4}
                                    placeholder="XXXX"
                                    required
                                />
                            </div>

                            <IndustrialInput
                                label="Email Address"
                                type="email"
                                value={formData.email || ''}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="staff@restaurant.com"
                            />

                            <div className="flex items-center gap-3 bg-slate-50 p-3 border-2 border-slate-200">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    className="w-6 h-6 accent-slate-800"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                />
                                <label htmlFor="isActive" className="font-black uppercase text-sm cursor-pointer select-none">Account is Active</label>
                            </div>

                            <div className="flex gap-3 pt-6 border-t-2 border-slate-100">
                                <IndustrialButton type="button" variant="ghost" fullWidth onClick={() => setIsFormOpen(false)}>
                                    Discard
                                </IndustrialButton>
                                <IndustrialButton type="submit" variant="primary" fullWidth>
                                    Confirm & Save
                                </IndustrialButton>
                            </div>
                        </form>
                    </IndustrialCard>
                </div>
            )}

            {/* Custom Modal for Delete Confirmation */}
            {isDeleteConfirmOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[110] p-4">
                    <IndustrialCard variant="raised" className="bg-white w-full max-w-sm border-4 border-red-600 shadow-2xl p-0 overflow-hidden">
                        <div className="bg-red-600 text-white p-4 font-black uppercase text-center">
                            Warning: Deletion
                        </div>
                        <div className="p-6 text-center">
                            <p className="text-lg font-bold mb-4">
                                Are you sure you want to remove <br />
                                <span className="text-red-600 uppercase text-2xl font-black">{memberToDelete?.name}</span>?
                            </p>
                            <p className="text-sm text-gray-500 mb-6 italic">This action cannot be undone.</p>
                            <div className="flex gap-3">
                                <IndustrialButton variant="ghost" fullWidth onClick={() => setIsDeleteConfirmOpen(false)}>
                                    Cancel
                                </IndustrialButton>
                                <IndustrialButton variant="danger" fullWidth onClick={handleDelete}>
                                    Delete Now
                                </IndustrialButton>
                            </div>
                        </div>
                    </IndustrialCard>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {staff.map((member) => (
                    <IndustrialCard
                        key={member.id}
                        variant="default"
                        className={cn(
                            "bg-white border-b-8 transition-shadow hover:shadow-lg",
                            member.isActive ? "border-slate-800" : "border-red-300 opacity-60 grayscale"
                        )}
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight">{member.name}</h3>
                                <div className="text-[10px] font-black bg-slate-800 text-white px-2 py-0.5 rounded mt-1 inline-block uppercase">
                                    {member.role}
                                </div>
                                {!member.isActive && (
                                    <div className="text-[10px] font-black bg-red-600 text-white px-2 py-0.5 rounded mt-1 ml-1 inline-block uppercase">
                                        Inactive
                                    </div>
                                )}
                            </div>
                            <div className="text-right">
                                <span className="text-2xl opacity-20 select-none font-mono font-bold tracking-[0.2em]">••••</span>
                                <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">ID: {member.id.split('-')[1]}</div>
                            </div>
                        </div>

                        <div className="text-sm font-bold text-slate-500 mb-6 border-t border-slate-50 pt-3 italic">
                            {member.email || 'No email registered'}
                        </div>

                        <div className="flex gap-2">
                            <IndustrialButton
                                size="sm"
                                variant="secondary"
                                fullWidth
                                onClick={() => handleEdit(member)}
                            >
                                Edit
                            </IndustrialButton>
                            <IndustrialButton
                                size="sm"
                                variant="danger"
                                onClick={() => confirmDelete(member.id, member.name)}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </IndustrialButton>
                        </div>
                    </IndustrialCard>
                ))}

                {staff.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-slate-50 border-4 border-dashed border-slate-200">
                        <p className="text-2xl font-black text-slate-300 uppercase italic">No Staff Enlisted</p>
                        <IndustrialButton onClick={handleAddNew} className="mt-4" variant="ghost">Add your first member</IndustrialButton>
                    </div>
                )}
            </div>
        </div>
    );
};

