import { useState } from 'react';
import { useFloorPlanStore } from '../../stores/floorPlanStore';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';
import { IndustrialCard } from '../ui-industrial/IndustrialCard';

// Mock staff list for MVP
const MOCK_STAFF = [
    { id: 'user-1', name: 'John Doe', role: 'waiter' },
    { id: 'user-2', name: 'Jane Smith', role: 'waiter' },
    { id: 'user-3', name: 'Mike Ross', role: 'manager' },
];

export const StaffAssignmentManager = () => {
    const { sections, assignments, assignStaff } = useFloorPlanStore();
    const [selectedStaffId, setSelectedStaffId] = useState(MOCK_STAFF[0].id);
    const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);

    const handleToggleSection = (sectionId: string) => {
        setSelectedSectionIds(prev =>
            prev.includes(sectionId)
                ? prev.filter(id => id !== sectionId)
                : [...prev, sectionId]
        );
    };

    const handleAssign = () => {
        const staff = MOCK_STAFF.find(s => s.id === selectedStaffId);
        if (staff) {
            assignStaff(staff.id, staff.name, selectedSectionIds);
            // Reset selection
            setSelectedSectionIds([]);
            alert(`Assigned ${staff.name} to ${selectedSectionIds.length} sections`);
        }
    };

    return (
        <div className="space-y-6 mt-8 border-t-4 border-slate-200 pt-8">
            <h2 className="text-xl font-black uppercase text-slate-800">Staff Assignments</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Assignment Form */}
                <IndustrialCard variant="default" className="bg-white p-6 space-y-4">
                    <h3 className="font-bold text-lg">New Assignment</h3>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Select Staff</label>
                        <select
                            className="w-full border-2 border-slate-300 rounded p-2 text-lg font-medium"
                            value={selectedStaffId}
                            onChange={(e) => setSelectedStaffId(e.target.value)}
                        >
                            {MOCK_STAFF.map(staff => (
                                <option key={staff.id} value={staff.id}>{staff.name} ({staff.role})</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Assign Sections</label>
                        <div className="flex flex-wrap gap-2">
                            {sections.map(section => (
                                <button
                                    key={section.id}
                                    onClick={() => handleToggleSection(section.id)}
                                    className={`px-4 py-2 border-2 rounded font-bold uppercase transition-all ${selectedSectionIds.includes(section.id)
                                            ? 'bg-blue-600 text-white border-blue-800 shadow-md'
                                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
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
                        disabled={selectedSectionIds.length === 0}
                    >
                        Confirm Assignment
                    </IndustrialButton>
                </IndustrialCard>

                {/* Current Assignments List */}
                <IndustrialCard variant="sunken" className="p-6">
                    <h3 className="font-bold text-lg mb-4">Current Assignments</h3>
                    {assignments.length === 0 ? (
                        <div className="text-slate-400 italic">No active assignments</div>
                    ) : (
                        <div className="space-y-3">
                            {assignments.map((assignment, idx) => (
                                <div key={idx} className="bg-white border-l-4 border-blue-500 p-3 shadow-sm flex justify-between items-center">
                                    <div>
                                        <div className="font-black text-lg">{assignment.userName}</div>
                                        <div className="text-sm text-slate-500">
                                            Sections: {assignment.sectionIds.map(sid => sections.find(s => s.id === sid)?.name).join(', ') || 'None'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </IndustrialCard>
            </div>
        </div>
    );
};
