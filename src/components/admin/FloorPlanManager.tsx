import { useState, useEffect } from 'react';
import { useFloorPlanStore } from '../../stores/floorPlanStore';
import { useAuthStore } from '../../stores/authStore';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';
import { IndustrialInput } from '../ui-industrial/IndustrialInput';
import { QRCodeSVG } from 'qrcode.react';
import { TableSVG } from '../floor/TableSVG';
import { Table, TableStatus } from '../../types/floor-plan';

export const FloorPlanManager = () => {
    const { user } = useAuthStore();
    const { sections, tables, addSection, removeSection, addTable, removeTable, loadFloorPlan, syncFromCloud, isLoading, isLoaded, isSyncing, lastSyncedAt } = useFloorPlanStore();
    const [newSectionName, setNewSectionName] = useState('');
    const [newTableNumber, setNewTableNumber] = useState('');
    const [newTableCapacity, setNewTableCapacity] = useState('4');
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
    const [selectedTable, setSelectedTable] = useState<Table | null>(null);
    const [showQRModal, setShowQRModal] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'floor'>('floor');

    // Drag and drop state
    const [draggedTableId, setDraggedTableId] = useState<string | null>(null);
    const [dragOverTableId, setDragOverTableId] = useState<string | null>(null);
    const [tableOrder, setTableOrder] = useState<Record<string, string[]>>({});

    const tenantId = user?.tenantId;

    // Load floor plan on mount - first from local SQLite, then sync from cloud
    useEffect(() => {
        const initFloorPlan = async () => {
            if (!tenantId) return;

            // First load from local SQLite (fast, offline-first)
            if (!isLoaded && !isLoading) {
                await loadFloorPlan(tenantId);
            }

            // Then sync from cloud (may have updates from other devices)
            syncFromCloud(tenantId).catch(e =>
                console.warn('[FloorPlanManager] Cloud sync failed:', e)
            );
        };

        initFloorPlan();
    }, [tenantId, isLoaded, isLoading, loadFloorPlan, syncFromCloud]);

    // Initialize table order when sections/tables change
    useEffect(() => {
        setTableOrder(prev => {
            const newOrder: Record<string, string[]> = {};
            sections.forEach(section => {
                const sectionTableIds = tables
                    .filter(t => t.sectionId === section.id)
                    .map(t => t.id);
                // Preserve existing order if available
                if (prev[section.id]) {
                    const existingIds = prev[section.id].filter(id => sectionTableIds.includes(id));
                    const newIds = sectionTableIds.filter(id => !prev[section.id].includes(id));
                    newOrder[section.id] = [...existingIds, ...newIds];
                } else {
                    newOrder[section.id] = sectionTableIds;
                }
            });
            return newOrder;
        });
    }, [sections, tables]);

    const handleAddSection = () => {
        if (newSectionName.trim()) {
            addSection(newSectionName, tenantId);
            setNewSectionName('');
        }
    };

    const handleAddTable = (sectionId: string) => {
        if (newTableNumber.trim()) {
            addTable(sectionId, newTableNumber, parseInt(newTableCapacity), tenantId);
            setNewTableNumber('');
        }
    };

    const handleTableClick = (table: Table) => {
        if (!draggedTableId) {
            setSelectedTable(table);
            setShowQRModal(true);
        }
    };

    // Drag and drop handlers
    const handleDragStart = (e: React.DragEvent, tableId: string, sectionId: string) => {
        e.stopPropagation();
        setDraggedTableId(tableId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({ tableId, sectionId }));
        // Set a custom drag image (optional - helps with SVG drag issues)
        const dragElement = e.currentTarget as HTMLElement;
        if (dragElement) {
            e.dataTransfer.setDragImage(dragElement, 30, 30);
        }
    };

    const handleDragEnd = () => {
        setDraggedTableId(null);
        setDragOverTableId(null);
    };

    const handleDragOver = (e: React.DragEvent, tableId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedTableId && tableId !== draggedTableId) {
            setDragOverTableId(tableId);
        }
    };

    const handleDragLeave = () => {
        setDragOverTableId(null);
    };

    const handleDrop = (e: React.DragEvent, targetTableId: string, sectionId: string) => {
        e.preventDefault();
        e.stopPropagation();

        const data = e.dataTransfer.getData('text/plain');
        let sourceTableId = draggedTableId;

        try {
            const parsed = JSON.parse(data);
            sourceTableId = parsed.tableId;
        } catch {
            // Use draggedTableId as fallback
        }

        if (!sourceTableId || sourceTableId === targetTableId) {
            setDraggedTableId(null);
            return;
        }

        const currentOrder = tableOrder[sectionId] || [];
        const draggedIndex = currentOrder.indexOf(sourceTableId);
        const targetIndex = currentOrder.indexOf(targetTableId);

        if (draggedIndex === -1 || targetIndex === -1) {
            setDraggedTableId(null);
            return;
        }

        const newOrder = [...currentOrder];
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, sourceTableId);

        setTableOrder(prev => ({
            ...prev,
            [sectionId]: newOrder
        }));

        setDraggedTableId(null);
        setDragOverTableId(null);
    };

    // Get ordered tables for a section
    const getOrderedTables = (sectionId: string) => {
        const order = tableOrder[sectionId] || [];
        const sectionTables = tables.filter(t => t.sectionId === sectionId);
        return order
            .map(id => sectionTables.find(t => t.id === id))
            .filter((t): t is Table => t !== undefined);
    };

    // Status legend items
    const statusLegend: { status: TableStatus; label: string; color: string }[] = [
        { status: 'available', label: 'Available', color: '#10b981' },
        { status: 'occupied', label: 'Occupied', color: '#ff8c00' },
        { status: 'reserved', label: 'Reserved', color: '#3b82f6' },
        { status: 'cleaning', label: 'Cleaning', color: '#94a3b8' },
    ];

    return (
        <div className="space-y-4">
            {/* Header with view toggle */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h2 className="text-lg font-bold text-foreground">Floor Plan</h2>
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">Drag tables to rearrange</p>
                        {isSyncing && (
                            <span className="text-xs text-amber-500 flex items-center gap-1">
                                <span className="animate-spin">⟳</span> Syncing...
                            </span>
                        )}
                        {!isSyncing && lastSyncedAt && (
                            <span className="text-xs text-green-500">✓ Synced</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Refresh from Cloud button */}
                    <button
                        onClick={async () => {
                            if (tenantId && confirm('This will refresh floor plan from cloud and replace local data. Continue?')) {
                                await syncFromCloud(tenantId);
                            }
                        }}
                        disabled={isSyncing || !tenantId}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                            isSyncing
                                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                    >
                        {isSyncing ? (
                            <>
                                <span className="animate-spin">⟳</span>
                                Syncing...
                            </>
                        ) : (
                            <>
                                ⟳ Refresh from Cloud
                            </>
                        )}
                    </button>
                    <div className="flex items-center gap-2 neo-inset-sm rounded-lg p-1">
                    <button
                        onClick={() => setViewMode('floor')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            viewMode === 'floor'
                                ? 'bg-accent text-white shadow-md'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Floor View
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            viewMode === 'grid'
                                ? 'bg-accent text-white shadow-md'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Grid View
                    </button>
                    </div>
                </div>
            </div>

            {/* Status Legend - Compact */}
            <div className="glass-panel border border-border px-3 py-2 rounded-lg">
                <div className="flex flex-wrap items-center gap-4">
                    {statusLegend.map(({ status, label, color }) => (
                        <div key={status} className="flex items-center gap-1.5">
                            <div
                                className="w-3 h-3 rounded-full border"
                                style={{ backgroundColor: `${color}30`, borderColor: color }}
                            />
                            <span className="text-xs text-foreground/70">{label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add Section Form - Compact */}
            <div className="flex gap-2 items-center glass-panel border border-border p-3 rounded-lg">
                <IndustrialInput
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="New section name..."
                    className="flex-1 text-sm"
                />
                <IndustrialButton onClick={handleAddSection} size="sm">
                    Add
                </IndustrialButton>
            </div>

            {/* Sections */}
            {viewMode === 'floor' ? (
                // Floor Plan View - Compact with drag-drop
                <div className="space-y-4">
                    {sections.map((section) => {
                        const orderedTables = getOrderedTables(section.id);
                        return (
                            <div key={section.id} className="neo-raised rounded-xl overflow-hidden">
                                {/* Section Header - Compact */}
                                <div className="bg-gradient-to-r from-surface-2 to-surface-3 px-4 py-2 border-b border-border">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-accent" />
                                            <h3 className="text-sm font-bold text-foreground">{section.name}</h3>
                                            <span className="text-xs text-muted-foreground">
                                                ({orderedTables.length})
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => removeSection(section.id, tenantId)}
                                            className="text-destructive hover:text-destructive/80 text-xs font-medium px-2 py-0.5 rounded hover:bg-destructive/10 transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>

                                {/* Floor Area - Compact grid */}
                                <div
                                    className="p-4 min-h-[150px] relative"
                                    style={{
                                        backgroundColor: '#fafbfc',
                                        backgroundImage: `
                                            linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px),
                                            linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px)
                                        `,
                                        backgroundSize: '16px 16px'
                                    }}
                                >
                                    {orderedTables.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-[100px] text-muted-foreground">
                                            <p className="text-xs">No tables yet</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
                                            {orderedTables.map(table => (
                                                <div
                                                    key={table.id}
                                                    draggable={true}
                                                    onDragStart={(e) => handleDragStart(e, table.id, section.id)}
                                                    onDragEnd={handleDragEnd}
                                                    onDragOver={(e) => handleDragOver(e, table.id)}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={(e) => handleDrop(e, table.id, section.id)}
                                                    onClick={() => !draggedTableId && handleTableClick(table)}
                                                    className={`relative group flex flex-col items-center p-1.5 rounded-lg transition-all select-none ${
                                                        draggedTableId === table.id
                                                            ? 'opacity-40 scale-90 ring-2 ring-accent cursor-grabbing'
                                                            : dragOverTableId === table.id
                                                                ? 'bg-accent/30 ring-2 ring-accent scale-110 shadow-lg'
                                                                : draggedTableId
                                                                    ? 'cursor-copy hover:bg-accent/20'
                                                                    : 'cursor-grab hover:bg-surface-2/50'
                                                    }`}
                                                >
                                                    <div className="pointer-events-none select-none">
                                                        <TableSVG
                                                            tableNumber={table.tableNumber}
                                                            capacity={table.capacity}
                                                            status={table.status}
                                                            isSelected={selectedTable?.id === table.id}
                                                            size="xs"
                                                            isDragging={draggedTableId === table.id}
                                                        />
                                                    </div>
                                                    {/* Compact label */}
                                                    <div className="text-[10px] font-medium text-muted-foreground mt-0.5 pointer-events-none select-none">
                                                        {table.capacity}p
                                                    </div>
                                                    {/* Delete button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            removeTable(table.id, tenantId);
                                                        }}
                                                        className="absolute -top-1 -right-1 z-20 bg-destructive hover:bg-destructive/80 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow text-[10px]"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Add Table Form - Inline compact */}
                                <div className="bg-surface-2/50 px-4 py-2 border-t border-border">
                                    <div className="flex gap-2 items-center">
                                        <input
                                            className="input-neo flex-1 min-w-0 text-xs py-1.5 px-2"
                                            placeholder="Table #"
                                            type="text"
                                            value={selectedSectionId === section.id ? newTableNumber : ''}
                                            onChange={(e) => {
                                                setSelectedSectionId(section.id);
                                                setNewTableNumber(e.target.value);
                                            }}
                                        />
                                        <select
                                            className="input-neo text-xs py-1.5 px-2 w-14"
                                            value={selectedSectionId === section.id ? newTableCapacity : '4'}
                                            onChange={(e) => {
                                                setSelectedSectionId(section.id);
                                                setNewTableCapacity(e.target.value);
                                            }}
                                        >
                                            {[2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                                                <option key={n} value={n}>{n}p</option>
                                            ))}
                                        </select>
                                        <IndustrialButton
                                            size="sm"
                                            onClick={() => handleAddTable(section.id)}
                                            disabled={selectedSectionId !== section.id || !newTableNumber}
                                        >
                                            +
                                        </IndustrialButton>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                // Grid View - Compact List
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {sections.map((section) => {
                        const sectionTables = tables.filter(t => t.sectionId === section.id);
                        return (
                            <div key={section.id} className="glass-panel border border-border rounded-xl p-3 overflow-hidden">
                                {/* Section Header */}
                                <div className="flex justify-between items-center mb-3 pb-2 border-b border-border gap-2">
                                    <h3 className="text-sm font-bold text-foreground truncate">{section.name}</h3>
                                    <button
                                        onClick={() => removeSection(section.id, tenantId)}
                                        className="text-destructive hover:text-destructive/80 text-xs font-medium px-1.5 py-0.5 rounded hover:bg-destructive/10 transition-colors whitespace-nowrap flex-shrink-0"
                                    >
                                        Delete
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {/* Tables Grid */}
                                    {sectionTables.length === 0 ? (
                                        <div className="text-center py-4 text-muted-foreground text-xs">
                                            No tables
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {sectionTables.map(table => (
                                                <div
                                                    key={table.id}
                                                    className="border border-border p-2 rounded-lg bg-surface-2/50 relative group cursor-pointer hover:bg-surface-2 transition-colors overflow-hidden"
                                                    onClick={() => handleTableClick(table)}
                                                >
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className="font-bold text-xs text-foreground">#{table.tableNumber}</span>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {table.capacity}p
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-0.5">
                                                        <div
                                                            className="w-2 h-2 rounded-full flex-shrink-0"
                                                            style={{
                                                                backgroundColor: statusLegend.find(s => s.status === table.status)?.color
                                                            }}
                                                        />
                                                        <span className="text-[10px] text-muted-foreground capitalize truncate">
                                                            {table.status}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            removeTable(table.id, tenantId);
                                                        }}
                                                        className="absolute -top-1 -right-1 bg-destructive hover:bg-destructive/80 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-[10px] shadow"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Add Table Form */}
                                    <div className="pt-2 border-t border-border">
                                        <div className="flex gap-1.5">
                                            <input
                                                className="input-neo flex-1 min-w-0 text-xs py-1.5 px-2"
                                                placeholder="Table #"
                                                type="text"
                                                value={selectedSectionId === section.id ? newTableNumber : ''}
                                                onChange={(e) => {
                                                    setSelectedSectionId(section.id);
                                                    setNewTableNumber(e.target.value);
                                                }}
                                            />
                                            <input
                                                className="input-neo w-12 text-xs py-1.5 px-1 text-center"
                                                placeholder="Cap"
                                                type="number"
                                                min="1"
                                                max="20"
                                                value={selectedSectionId === section.id ? newTableCapacity : '4'}
                                                onChange={(e) => {
                                                    setSelectedSectionId(section.id);
                                                    setNewTableCapacity(e.target.value);
                                                }}
                                            />
                                            <IndustrialButton
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleAddTable(section.id)}
                                                disabled={selectedSectionId !== section.id || !newTableNumber}
                                            >
                                                +
                                            </IndustrialButton>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Empty State */}
            {sections.length === 0 && (
                <div className="neo-raised rounded-xl p-8 text-center">
                    <svg className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <h3 className="text-sm font-semibold text-foreground mb-1">No Sections Yet</h3>
                    <p className="text-xs text-muted-foreground">Add a section like "Main Hall" or "Patio"</p>
                </div>
            )}

            {/* QR Code Modal */}
            {showQRModal && selectedTable && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                    onClick={() => setShowQRModal(false)}
                >
                    <div
                        className="bg-card rounded-2xl p-5 shadow-2xl max-w-xs w-full mx-4 animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-foreground mb-0.5">
                                Table #{selectedTable.tableNumber}
                            </h3>
                            <p className="text-xs text-muted-foreground mb-3">
                                {selectedTable.capacity} seats • {selectedTable.status}
                            </p>

                            {/* Table Preview */}
                            <div className="flex justify-center mb-3">
                                <TableSVG
                                    tableNumber={selectedTable.tableNumber}
                                    capacity={selectedTable.capacity}
                                    status={selectedTable.status}
                                    size="md"
                                />
                            </div>

                            {/* QR Code */}
                            <div className="bg-white p-3 rounded-xl inline-block shadow-inner">
                                <QRCodeSVG
                                    value={selectedTable.qrCodeUrl}
                                    size={140}
                                    level="H"
                                    includeMargin
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-2 mb-3">
                                Scan to view menu & order
                            </p>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowQRModal(false)}
                                    className="flex-1 px-3 py-1.5 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => window.print()}
                                    className="flex-1 px-3 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
                                >
                                    Print
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
