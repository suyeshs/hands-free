import { useEffect, useMemo, useState } from 'react';
import { useFloorPlanStore } from '../../stores/floorPlanStore';
import { usePOSStore } from '../../stores/posStore';
import { useAuthStore } from '../../stores/authStore';
import { usePOSSessionStore } from '../../stores/posSessionStore';
import { useRestaurantSettingsStore } from '../../stores/restaurantSettingsStore';
import { cn } from '../../lib/utils';

interface TableSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (tableNumber: number, guestCount?: number) => void;
    currentTableNumber: number | null;
}

export function TableSelectorModal({
    isOpen,
    onClose,
    onSelect,
    currentTableNumber
}: TableSelectorModalProps) {
    const { user } = useAuthStore();
    const { sections, tables, loadFloorPlan, isLoaded, isLoading } = useFloorPlanStore();
    const { activeTables } = usePOSStore();
    const { assignedSectionIds, activeStaff } = usePOSSessionStore();
    const { settings } = useRestaurantSettingsStore();

    // Check if table filtering is enabled
    const filterByStaff = settings.posSettings?.requireStaffPinForPOS &&
                          settings.posSettings?.filterTablesByStaffAssignment;

    // State for guest count input
    const [pendingTable, setPendingTable] = useState<{ tableNumber: number; displayName: string; capacity: number } | null>(null);
    const [guestCount, setGuestCount] = useState(2);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setPendingTable(null);
            setGuestCount(2);
        }
    }, [isOpen]);

    // Load floor plan when modal opens
    useEffect(() => {
        if (isOpen && user?.tenantId && !isLoaded && !isLoading) {
            loadFloorPlan(user.tenantId);
        }
    }, [isOpen, user?.tenantId, isLoaded, isLoading, loadFloorPlan]);

    // Filter sections and tables based on staff assignment
    const { displaySections, displayTables } = useMemo(() => {
        // If no floor plan configured, provide fallback
        if (sections.length === 0) {
            return {
                displaySections: [{ id: 'default', name: 'Main Hall' }],
                displayTables: Array.from({ length: 20 }, (_, i) => ({
                    id: `tab-${i + 1}`,
                    sectionId: 'default',
                    tableNumber: (i + 1).toString(),
                    capacity: 4,
                    status: 'available'
                }))
            };
        }

        // If filtering by staff assignment is enabled
        if (filterByStaff && assignedSectionIds.length > 0) {
            const filteredSections = sections.filter(s => assignedSectionIds.includes(s.id));
            const filteredTables = tables.filter(t => assignedSectionIds.includes(t.sectionId));
            return {
                displaySections: filteredSections,
                displayTables: filteredTables
            };
        }

        // No filtering - show all
        return {
            displaySections: sections,
            displayTables: tables
        };
    }, [sections, tables, filterByStaff, assignedSectionIds]);

    if (!isOpen) return null;

    const hasNoAccessibleTables = filterByStaff && displaySections.length === 0;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fade-in"
                onClick={onClose}
            />

            <div className="relative w-full max-w-4xl bg-card border border-border rounded-3xl shadow-2xl flex flex-col max-h-[80vh] animate-slide-in-bottom">
                {/* Header */}
                <div className="p-6 border-b border-border flex justify-between items-center bg-white/5">
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-widest">Select Table</h2>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mt-1">Pick an active table to manage its tab</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-all"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* No accessible tables message */}
                    {hasNoAccessibleTables && (
                        <div className="text-center py-12">
                            <div className="text-5xl mb-4">🚫</div>
                            <h3 className="text-lg font-bold mb-2">No Tables Assigned</h3>
                            <p className="text-sm text-muted-foreground">
                                {activeStaff?.name || 'You'} don't have any tables assigned.
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Contact your manager to assign sections/tables.
                            </p>
                        </div>
                    )}

                    {displaySections.map((section) => {
                        const sectionTables = displayTables.filter(t => t.sectionId === section.id);

                        return (
                            <div key={section.id} className="space-y-4">
                                <h3 className="text-xs font-black uppercase text-accent tracking-widest flex items-center gap-2">
                                    <span className="w-4 h-[2px] bg-accent" />
                                    {section.name}
                                </h3>

                                {sectionTables.length === 0 ? (
                                    <div className="text-center py-6 bg-white/5 rounded-xl border border-dashed border-white/10">
                                        <p className="text-sm text-muted-foreground">No tables in this section</p>
                                        <p className="text-xs text-muted-foreground mt-1">Add tables in Floor Plan Manager</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                                        {sectionTables.map((table) => {
                                            // Try to parse as number, or extract number from string like "Table1"
                                            let tableNum = parseInt(table.tableNumber, 10);
                                            if (isNaN(tableNum)) {
                                                // Try to extract number from string like "Table1" -> 1
                                                const match = table.tableNumber.match(/\d+/);
                                                tableNum = match ? parseInt(match[0], 10) : 0;
                                            }

                                            // Use tableNumber string as display, but numeric for lookup
                                            const displayName = table.tableNumber;
                                            const isActive = tableNum > 0 && activeTables[tableNum];
                                            const isSelected = tableNum > 0 && currentTableNumber === tableNum;

                                            return (
                                                <button
                                                    key={table.id}
                                                    onClick={() => {
                                                        // If no valid number, use the raw table number string
                                                        const selectValue = tableNum > 0 ? tableNum : parseInt(table.tableNumber.replace(/\D/g, '') || '0', 10);
                                                        console.log('[TableSelector] Selected table:', selectValue, 'display:', displayName, 'isActive:', isActive);
                                                        if (selectValue > 0) {
                                                            if (isActive) {
                                                                // Already active table - just select it
                                                                onSelect(selectValue);
                                                                onClose();
                                                            } else {
                                                                // New table - show guest count input
                                                                setPendingTable({
                                                                    tableNumber: selectValue,
                                                                    displayName,
                                                                    capacity: table.capacity || 4
                                                                });
                                                                setGuestCount(2);
                                                            }
                                                        }
                                                    }}
                                                    className={cn(
                                                        "aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition-all relative group",
                                                        isSelected
                                                            ? "bg-accent border-accent text-white shadow-lg shadow-accent/30 scale-105 z-10"
                                                            : isActive
                                                                ? "bg-green-500/10 border-green-500/50 text-green-500 hover:bg-green-500/20"
                                                                : "bg-white/5 border-white/5 text-muted-foreground hover:border-white/20 hover:bg-white/10"
                                                    )}
                                                >
                                                    <span className="text-[10px] font-black uppercase opacity-60 mb-1">Table</span>
                                                    <span className="text-2xl font-black">{displayName}</span>

                                                    {isActive && !isSelected && (
                                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-card animate-pulse" />
                                                    )}

                                                    {isActive && tableNum > 0 && (
                                                        <span className="text-[8px] font-black uppercase mt-1 opacity-80">
                                                            ₹{activeTables[tableNum].order.total.toFixed(0)}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border bg-white/5 flex justify-between items-center">
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-white/10 border border-white/10" />
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Available</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                            <span className="text-[10px] font-bold uppercase text-green-500">Occupied</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-accent" />
                            <span className="text-[10px] font-bold uppercase text-accent">Selected</span>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-xl bg-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                        Cancel
                    </button>
                </div>

                {/* Guest Count Input Overlay */}
                {pendingTable && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
                        <div className="bg-card border border-border rounded-2xl p-6 w-80 shadow-2xl animate-slide-in-bottom">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-4">
                                    <span className="text-3xl">🪑</span>
                                </div>
                                <h3 className="text-lg font-black uppercase tracking-widest">Table {pendingTable.displayName}</h3>
                                <p className="text-xs text-muted-foreground mt-1">How many guests?</p>
                            </div>

                            {/* Guest Count Selector */}
                            <div className="flex items-center justify-center gap-4 mb-6">
                                <button
                                    onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                                    className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-2xl font-black hover:bg-white/10 transition-all"
                                >
                                    −
                                </button>
                                <div className="w-20 text-center">
                                    <span className="text-4xl font-black text-accent">{guestCount}</span>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                        {guestCount === 1 ? 'Guest' : 'Guests'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setGuestCount(Math.min(pendingTable.capacity || 20, guestCount + 1))}
                                    className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-2xl font-black hover:bg-white/10 transition-all"
                                >
                                    +
                                </button>
                            </div>

                            {/* Quick Select Buttons */}
                            <div className="grid grid-cols-4 gap-2 mb-6">
                                {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                                    <button
                                        key={num}
                                        onClick={() => setGuestCount(num)}
                                        className={cn(
                                            "h-10 rounded-lg font-bold text-sm transition-all",
                                            guestCount === num
                                                ? "bg-accent text-white"
                                                : "bg-white/5 text-muted-foreground hover:bg-white/10"
                                        )}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setPendingTable(null)}
                                    className="flex-1 py-3 rounded-xl bg-white/5 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={() => {
                                        onSelect(pendingTable.tableNumber, guestCount);
                                        onClose();
                                    }}
                                    className="flex-1 py-3 rounded-xl bg-accent text-white text-xs font-black uppercase tracking-widest hover:bg-accent/80 transition-all shadow-lg shadow-accent/30"
                                >
                                    Open Table
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
