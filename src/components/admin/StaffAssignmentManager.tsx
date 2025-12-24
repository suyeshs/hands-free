import { useState, useEffect } from 'react';
import { useFloorPlanStore } from '../../stores/floorPlanStore';
import { useStaffStore } from '../../stores/staffStore';
import { useAuthStore } from '../../stores/authStore';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';
import { UserRole } from '../../types/auth';

export const StaffAssignmentManager = () => {
    const { sections, assignments, assignStaff } = useFloorPlanStore();
    const { staff, loadStaffFromDatabase, isLoaded } = useStaffStore();
    const { user } = useAuthStore();
    const [selectedStaffId, setSelectedStaffId] = useState<string>('');
    const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);

    // Load staff from database on mount
    useEffect(() => {
        if (user?.tenantId && !isLoaded) {
            loadStaffFromDatabase(user.tenantId);
        }
    }, [user?.tenantId, isLoaded, loadStaffFromDatabase]);

    // Set default selected staff when staff list loads
    useEffect(() => {
        if (staff.length > 0 && !selectedStaffId) {
            setSelectedStaffId(staff[0].id);
        }
    }, [staff, selectedStaffId]);

    // Filter to only show active servers/waiters for section assignment
    const assignableStaff = staff.filter(s => s.isActive && (s.role === UserRole.SERVER || s.role === UserRole.MANAGER));

    const handleToggleSection = (sectionId: string) => {
        setSelectedSectionIds(prev =>
            prev.includes(sectionId)
                ? prev.filter(id => id !== sectionId)
                : [...prev, sectionId]
        );
    };

    const handleAssign = () => {
        const selectedStaff = assignableStaff.find(s => s.id === selectedStaffId);
        if (selectedStaff) {
            assignStaff(selectedStaff.id, selectedStaff.name, selectedSectionIds);
            // Reset selection
            setSelectedSectionIds([]);
            alert(`Assigned ${selectedStaff.name} to ${selectedSectionIds.length} sections`);
        }
    };

    // Helper to get role display name
    const getRoleLabel = (role: UserRole) => {
        switch (role) {
            case UserRole.MANAGER: return 'Manager';
            case UserRole.SERVER: return 'Server';
            case UserRole.KITCHEN: return 'Kitchen';
            case UserRole.AGGREGATOR: return 'Aggregator';
            default: return 'Staff';
        }
    };

    return (
        <div className="space-y-6 mt-8 border-t border-border pt-8">
            <h2 className="text-xl font-black uppercase text-foreground">Staff Assignments</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Assignment Form */}
                <div className="glass-panel border border-border rounded-lg p-6 space-y-4">
                    <h3 className="font-bold text-lg text-foreground">New Assignment</h3>

                    <div>
                        <label className="block text-sm font-bold text-foreground/70 mb-2">Select Staff</label>
                        {assignableStaff.length === 0 ? (
                            <div className="neo-inset rounded-xl p-4 text-center text-muted-foreground">
                                <p className="text-sm">No staff members available.</p>
                                <p className="text-xs mt-1">Add staff in the Staff tab first.</p>
                            </div>
                        ) : (
                            <select
                                className="w-full neo-inset rounded-xl p-2.5 text-lg font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                                value={selectedStaffId}
                                onChange={(e) => setSelectedStaffId(e.target.value)}
                            >
                                {assignableStaff.map(member => (
                                    <option key={member.id} value={member.id}>
                                        {member.name} ({getRoleLabel(member.role)})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-foreground/70 mb-2">Assign Sections</label>
                        <div className="flex flex-wrap gap-2">
                            {sections.map(section => (
                                <button
                                    key={section.id}
                                    onClick={() => handleToggleSection(section.id)}
                                    className={`px-4 py-2 border rounded-lg font-bold uppercase transition-all ${selectedSectionIds.includes(section.id)
                                            ? 'bg-primary text-primary-foreground border-primary shadow-md'
                                            : 'bg-accent/20 text-foreground/70 border-border hover:bg-accent/40'
                                        }`}
                                >
                                    {section.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <IndustrialButton
                        onClick={handleAssign}
                        fullWidth
                        variant="primary"
                        disabled={selectedSectionIds.length === 0 || assignableStaff.length === 0 || !selectedStaffId}
                    >
                        Confirm Assignment
                    </IndustrialButton>
                </div>

                {/* Current Assignments List */}
                <div className="glass-panel border border-border rounded-lg p-6">
                    <h3 className="font-bold text-lg text-foreground mb-4">Current Assignments</h3>
                    {assignments.length === 0 ? (
                        <div className="text-foreground/40 italic">No active assignments</div>
                    ) : (
                        <div className="space-y-3">
                            {assignments.map((assignment, idx) => (
                                <div key={idx} className="bg-accent/20 border-l-4 border-primary p-3 rounded-r-lg flex justify-between items-center">
                                    <div>
                                        <div className="font-black text-lg text-foreground">{assignment.userName}</div>
                                        <div className="text-sm text-foreground/50">
                                            Sections: {assignment.sectionIds.map(sid => sections.find(s => s.id === sid)?.name).join(', ') || 'None'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
