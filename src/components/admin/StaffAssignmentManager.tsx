import { useState, useEffect } from 'react';
import { useFloorPlanStore } from '../../stores/floorPlanStore';
import { useStaffStore } from '../../stores/staffStore';
import { useAuthStore } from '../../stores/authStore';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';
import { UserRole } from '../../types/auth';
import { TableSVG } from '../floor/TableSVG';

export const StaffAssignmentManager = () => {
    const { sections, tables, assignments, assignStaff, removeStaffAssignment, loadFloorPlan, isLoaded: floorPlanLoaded, isLoading: floorPlanLoading } = useFloorPlanStore();
    const { staff, loadStaffFromDatabase, isLoaded } = useStaffStore();
    const { user } = useAuthStore();
    const [selectedStaffId, setSelectedStaffId] = useState<string>('');
    const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
    const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
    const [expandedSections, setExpandedSections] = useState<string[]>([]);

    const tenantId = user?.tenantId;

    // Load floor plan from database on mount
    useEffect(() => {
        if (tenantId && !floorPlanLoaded && !floorPlanLoading) {
            loadFloorPlan(tenantId);
        }
    }, [tenantId, floorPlanLoaded, floorPlanLoading, loadFloorPlan]);

    // Load staff from database on mount
    useEffect(() => {
        if (tenantId && !isLoaded) {
            loadStaffFromDatabase(tenantId);
        }
    }, [tenantId, isLoaded, loadStaffFromDatabase]);

    // Set default selected staff when staff list loads
    useEffect(() => {
        if (staff.length > 0 && !selectedStaffId) {
            setSelectedStaffId(staff[0].id);
        }
    }, [staff, selectedStaffId]);

    // Load existing assignment when staff is selected
    useEffect(() => {
        if (selectedStaffId) {
            const existingAssignment = assignments.find(a => a.userId === selectedStaffId);
            if (existingAssignment) {
                setSelectedSectionIds(existingAssignment.sectionIds);
                setSelectedTableIds(existingAssignment.tableIds);
                // Expand sections that have table assignments
                const sectionsWithTables = new Set<string>();
                existingAssignment.tableIds.forEach(tableId => {
                    const table = tables.find(t => t.id === tableId);
                    if (table) sectionsWithTables.add(table.sectionId);
                });
                setExpandedSections(Array.from(sectionsWithTables));
            } else {
                setSelectedSectionIds([]);
                setSelectedTableIds([]);
                setExpandedSections([]);
            }
        }
    }, [selectedStaffId, assignments, tables]);

    // Filter to only show active servers/waiters for section assignment
    const assignableStaff = staff.filter(s => s.isActive && (s.role === UserRole.SERVER || s.role === UserRole.MANAGER));

    const handleToggleSection = (sectionId: string) => {
        setSelectedSectionIds(prev => {
            if (prev.includes(sectionId)) {
                // When removing section, also remove all tables in that section
                const sectionTableIds = tables.filter(t => t.sectionId === sectionId).map(t => t.id);
                setSelectedTableIds(prevTables => prevTables.filter(id => !sectionTableIds.includes(id)));
                return prev.filter(id => id !== sectionId);
            } else {
                return [...prev, sectionId];
            }
        });
    };

    const handleToggleTable = (tableId: string) => {
        setSelectedTableIds(prev =>
            prev.includes(tableId)
                ? prev.filter(id => id !== tableId)
                : [...prev, tableId]
        );
    };

    const handleToggleSectionExpand = (sectionId: string) => {
        setExpandedSections(prev =>
            prev.includes(sectionId)
                ? prev.filter(id => id !== sectionId)
                : [...prev, sectionId]
        );
    };

    const handleSelectAllTablesInSection = (sectionId: string) => {
        const sectionTableIds = tables.filter(t => t.sectionId === sectionId).map(t => t.id);
        setSelectedTableIds(prev => {
            const otherTables = prev.filter(id => !sectionTableIds.includes(id));
            const allSelected = sectionTableIds.every(id => prev.includes(id));
            if (allSelected) {
                // Deselect all
                return otherTables;
            } else {
                // Select all
                return [...otherTables, ...sectionTableIds];
            }
        });
    };

    const handleAssign = async () => {
        const selectedStaff = assignableStaff.find(s => s.id === selectedStaffId);
        if (selectedStaff) {
            await assignStaff(selectedStaff.id, selectedStaff.name, selectedSectionIds, selectedTableIds, tenantId);
        }
    };

    const handleRemoveAssignment = async (userId: string) => {
        await removeStaffAssignment(userId, tenantId);
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

    // Get tables assigned to a staff member (either via section or direct table assignment)
    const getAssignedTablesForStaff = (assignment: typeof assignments[0]) => {
        const assignedTables: typeof tables = [];

        // Tables from assigned sections
        assignment.sectionIds.forEach(sectionId => {
            const sectionTables = tables.filter(t => t.sectionId === sectionId);
            assignedTables.push(...sectionTables);
        });

        // Directly assigned tables (not in assigned sections)
        assignment.tableIds.forEach(tableId => {
            const table = tables.find(t => t.id === tableId);
            if (table && !assignment.sectionIds.includes(table.sectionId)) {
                assignedTables.push(table);
            }
        });

        return assignedTables;
    };

    // Check if staff has any assignments
    const hasAssignments = selectedSectionIds.length > 0 || selectedTableIds.length > 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-foreground">Staff Assignments</h2>
                    <p className="text-sm text-muted-foreground">Assign servers to sections or specific tables</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Assignment Form */}
                <div className="neo-raised-lg rounded-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-surface-2 to-surface-3 px-6 py-4 border-b border-border">
                        <h3 className="font-bold text-lg text-foreground">New Assignment</h3>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Staff Selection */}
                        <div>
                            <label className="block text-sm font-semibold text-foreground/70 mb-2">Select Staff Member</label>
                            {assignableStaff.length === 0 ? (
                                <div className="neo-inset rounded-xl p-4 text-center text-muted-foreground">
                                    <p className="text-sm">No staff members available.</p>
                                    <p className="text-xs mt-1">Add staff in the Staff tab first.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {assignableStaff.map(member => {
                                        const isSelected = selectedStaffId === member.id;
                                        const hasExistingAssignment = assignments.some(a => a.userId === member.id);
                                        return (
                                            <button
                                                key={member.id}
                                                onClick={() => setSelectedStaffId(member.id)}
                                                className={`p-3 rounded-xl text-left transition-all ${
                                                    isSelected
                                                        ? 'bg-accent text-white shadow-lg scale-[1.02]'
                                                        : 'bg-surface-2 hover:bg-surface-3 text-foreground'
                                                }`}
                                            >
                                                <div className="font-semibold text-sm truncate">{member.name}</div>
                                                <div className={`text-xs ${isSelected ? 'text-white/70' : 'text-muted-foreground'}`}>
                                                    {getRoleLabel(member.role)}
                                                </div>
                                                {hasExistingAssignment && (
                                                    <div className={`text-xs mt-1 ${isSelected ? 'text-white/80' : 'text-accent'}`}>
                                                        Assigned
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Section & Table Selection */}
                        {selectedStaffId && sections.length > 0 && (
                            <div>
                                <label className="block text-sm font-semibold text-foreground/70 mb-2">
                                    Assign Areas & Tables
                                </label>
                                <p className="text-xs text-muted-foreground mb-3">
                                    Select entire sections or expand to pick specific tables
                                </p>

                                <div className="space-y-3">
                                    {sections.map(section => {
                                        const sectionTables = tables.filter(t => t.sectionId === section.id);
                                        const isExpanded = expandedSections.includes(section.id);
                                        const isSectionSelected = selectedSectionIds.includes(section.id);
                                        const selectedTablesInSection = selectedTableIds.filter(id =>
                                            sectionTables.some(t => t.id === id)
                                        );
                                        const allTablesSelected = sectionTables.length > 0 &&
                                            sectionTables.every(t => selectedTableIds.includes(t.id));

                                        return (
                                            <div
                                                key={section.id}
                                                className={`rounded-xl border transition-all ${
                                                    isSectionSelected
                                                        ? 'border-accent bg-accent/5'
                                                        : selectedTablesInSection.length > 0
                                                            ? 'border-accent/50 bg-accent/5'
                                                            : 'border-border bg-surface-2/50'
                                                }`}
                                            >
                                                {/* Section Header */}
                                                <div className="flex items-center gap-3 p-3">
                                                    <button
                                                        onClick={() => handleToggleSection(section.id)}
                                                        className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                                                            isSectionSelected
                                                                ? 'bg-accent text-white'
                                                                : 'border-2 border-border hover:border-accent'
                                                        }`}
                                                    >
                                                        {isSectionSelected && (
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                    </button>

                                                    <div className="flex-1">
                                                        <div className="font-semibold text-foreground">{section.name}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {sectionTables.length} tables
                                                            {isSectionSelected && ' (all assigned)'}
                                                            {!isSectionSelected && selectedTablesInSection.length > 0 &&
                                                                ` (${selectedTablesInSection.length} selected)`
                                                            }
                                                        </div>
                                                    </div>

                                                    {sectionTables.length > 0 && !isSectionSelected && (
                                                        <button
                                                            onClick={() => handleToggleSectionExpand(section.id)}
                                                            className="p-2 rounded-lg hover:bg-surface-3 transition-colors"
                                                        >
                                                            <svg
                                                                className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Expanded Tables */}
                                                {isExpanded && !isSectionSelected && sectionTables.length > 0 && (
                                                    <div className="px-3 pb-3 pt-0">
                                                        <div className="border-t border-border pt-3">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-xs font-medium text-muted-foreground">Select Tables</span>
                                                                <button
                                                                    onClick={() => handleSelectAllTablesInSection(section.id)}
                                                                    className="text-xs text-accent hover:text-accent/80"
                                                                >
                                                                    {allTablesSelected ? 'Deselect All' : 'Select All'}
                                                                </button>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {sectionTables.map(table => {
                                                                    const isTableSelected = selectedTableIds.includes(table.id);
                                                                    return (
                                                                        <button
                                                                            key={table.id}
                                                                            onClick={() => handleToggleTable(table.id)}
                                                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                                                                                isTableSelected
                                                                                    ? 'bg-accent text-white shadow-md'
                                                                                    : 'bg-surface-3 hover:bg-surface-2 text-foreground'
                                                                            }`}
                                                                        >
                                                                            <span className="font-semibold">#{table.tableNumber}</span>
                                                                            <span className={`text-xs ${isTableSelected ? 'text-white/70' : 'text-muted-foreground'}`}>
                                                                                ({table.capacity})
                                                                            </span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Summary */}
                        {selectedStaffId && hasAssignments && (
                            <div className="bg-accent/10 rounded-xl p-4">
                                <div className="text-sm font-semibold text-foreground mb-2">Assignment Summary</div>
                                <div className="text-sm text-muted-foreground">
                                    {selectedSectionIds.length > 0 && (
                                        <div>
                                            <span className="font-medium">Sections:</span>{' '}
                                            {selectedSectionIds.map(id => sections.find(s => s.id === id)?.name).join(', ')}
                                        </div>
                                    )}
                                    {selectedTableIds.length > 0 && (
                                        <div className="mt-1">
                                            <span className="font-medium">Additional Tables:</span>{' '}
                                            {selectedTableIds
                                                .filter(id => !selectedSectionIds.includes(tables.find(t => t.id === id)?.sectionId || ''))
                                                .map(id => {
                                                    const table = tables.find(t => t.id === id);
                                                    return table ? `#${table.tableNumber}` : null;
                                                })
                                                .filter(Boolean)
                                                .join(', ') || 'None'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <IndustrialButton
                                onClick={handleAssign}
                                fullWidth
                                variant="primary"
                                disabled={!hasAssignments || assignableStaff.length === 0 || !selectedStaffId}
                            >
                                Save Assignment
                            </IndustrialButton>
                        </div>
                    </div>
                </div>

                {/* Current Assignments List */}
                <div className="neo-raised-lg rounded-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-surface-2 to-surface-3 px-6 py-4 border-b border-border">
                        <h3 className="font-bold text-lg text-foreground">Current Assignments</h3>
                        <p className="text-sm text-muted-foreground">{assignments.length} staff assigned</p>
                    </div>

                    <div className="p-6">
                        {assignments.length === 0 ? (
                            <div className="text-center py-8">
                                <svg className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <p className="text-muted-foreground">No staff assignments yet</p>
                                <p className="text-sm text-muted-foreground/70 mt-1">Select a staff member and assign them to sections or tables</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {assignments.map((assignment) => {
                                    const assignedTables = getAssignedTablesForStaff(assignment);
                                    const staffMember = staff.find(s => s.id === assignment.userId);

                                    return (
                                        <div
                                            key={assignment.userId}
                                            className={`rounded-xl border p-4 transition-all ${
                                                selectedStaffId === assignment.userId
                                                    ? 'border-accent bg-accent/5'
                                                    : 'border-border bg-surface-2/50'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <div className="font-bold text-lg text-foreground">{assignment.userName}</div>
                                                    {staffMember && (
                                                        <div className="text-xs text-muted-foreground">
                                                            {getRoleLabel(staffMember.role)}
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveAssignment(assignment.userId)}
                                                    className="text-destructive hover:text-destructive/80 text-sm font-medium px-2 py-1 rounded hover:bg-destructive/10 transition-colors"
                                                >
                                                    Remove
                                                </button>
                                            </div>

                                            {/* Assigned Sections */}
                                            {assignment.sectionIds.length > 0 && (
                                                <div className="mb-3">
                                                    <div className="text-xs font-semibold text-muted-foreground mb-1.5">SECTIONS</div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {assignment.sectionIds.map(sectionId => {
                                                            const section = sections.find(s => s.id === sectionId);
                                                            return section ? (
                                                                <span
                                                                    key={sectionId}
                                                                    className="px-2 py-1 bg-accent/20 text-accent text-xs font-semibold rounded-lg"
                                                                >
                                                                    {section.name}
                                                                </span>
                                                            ) : null;
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Directly Assigned Tables (not via section) */}
                                            {assignment.tableIds.length > 0 && (
                                                <div className="mb-3">
                                                    <div className="text-xs font-semibold text-muted-foreground mb-1.5">SPECIFIC TABLES</div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {assignment.tableIds.map(tableId => {
                                                            const table = tables.find(t => t.id === tableId);
                                                            // Only show if not already covered by section assignment
                                                            if (table && !assignment.sectionIds.includes(table.sectionId)) {
                                                                return (
                                                                    <span
                                                                        key={tableId}
                                                                        className="px-2 py-1 bg-info/20 text-info text-xs font-semibold rounded-lg"
                                                                    >
                                                                        #{table.tableNumber}
                                                                    </span>
                                                                );
                                                            }
                                                            return null;
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Visual Table Preview */}
                                            {assignedTables.length > 0 && (
                                                <div>
                                                    <div className="text-xs font-semibold text-muted-foreground mb-2">
                                                        TOTAL: {assignedTables.length} TABLES
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {assignedTables.slice(0, 6).map(table => (
                                                            <div key={table.id} className="transform scale-75 origin-top-left">
                                                                <TableSVG
                                                                    tableNumber={table.tableNumber}
                                                                    capacity={table.capacity}
                                                                    status={table.status}
                                                                    size="sm"
                                                                />
                                                            </div>
                                                        ))}
                                                        {assignedTables.length > 6 && (
                                                            <div className="flex items-center justify-center w-12 h-12 bg-muted rounded-lg text-xs font-medium text-muted-foreground">
                                                                +{assignedTables.length - 6}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
