import { useFloorPlanStore } from '../../stores/floorPlanStore';
import { usePOSStore } from '../../stores/posStore';
import { cn } from '../../lib/utils';

interface TableSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (tableNumber: number) => void;
    currentTableNumber: number | null;
}

export function TableSelectorModal({
    isOpen,
    onClose,
    onSelect,
    currentTableNumber
}: TableSelectorModalProps) {
    const { sections, tables } = useFloorPlanStore();
    const { activeTables } = usePOSStore();

    if (!isOpen) return null;

    // If no sections/tables exist, provide a fallback grid
    const displaySections = sections.length > 0 ? sections : [{ id: 'default', name: 'Main Hall' }];
    const displayTables = tables.length > 0 ? tables : Array.from({ length: 20 }, (_, i) => ({
        id: `tab-${i + 1}`,
        sectionId: 'default',
        tableNumber: (i + 1).toString(),
        capacity: 4,
        status: 'available'
    }));

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
                    {displaySections.map((section) => {
                        const sectionTables = displayTables.filter(t => t.sectionId === section.id);
                        if (sectionTables.length === 0 && sections.length > 0) return null;

                        return (
                            <div key={section.id} className="space-y-4">
                                <h3 className="text-xs font-black uppercase text-accent tracking-widest flex items-center gap-2">
                                    <span className="w-4 h-[2px] bg-accent" />
                                    {section.name}
                                </h3>

                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                                    {sectionTables.map((table) => {
                                        const tableNum = parseInt(table.tableNumber, 10);
                                        // Skip tables with invalid numbers
                                        if (isNaN(tableNum) || tableNum < 1) return null;

                                        const isActive = activeTables[tableNum];
                                        const isSelected = currentTableNumber === tableNum;

                                        return (
                                            <button
                                                key={table.id}
                                                onClick={() => {
                                                    console.log('[TableSelector] Selected table:', tableNum);
                                                    onSelect(tableNum);
                                                    onClose();
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
                                                <span className="text-2xl font-black">{table.tableNumber}</span>

                                                {isActive && !isSelected && (
                                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-card animate-pulse" />
                                                )}

                                                {isActive && (
                                                    <span className="text-[8px] font-black uppercase mt-1 opacity-80">
                                                        ₹{activeTables[tableNum].order.total.toFixed(0)}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
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
            </div>
        </div>
    );
}
