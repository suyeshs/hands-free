import { useState, useEffect } from 'react';
import { useFloorPlanStore } from '../../stores/floorPlanStore';
import { useAuthStore } from '../../stores/authStore';
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

            {/* Status Legend - Sophisticated card */}
            <div className="bg-white dark:bg-card rounded-xl shadow-sm border border-slate-200 dark:border-border px-4 py-3">
                <div className="flex flex-wrap items-center gap-5">
                    <span className="text-xs font-semibold text-slate-500 dark:text-muted-foreground uppercase tracking-wider">Status:</span>
                    {statusLegend.map(({ status, label, color }) => (
                        <div key={status} className="flex items-center gap-2">
                            <div
                                className="w-3.5 h-3.5 rounded-full shadow-sm"
                                style={{
                                    background: `linear-gradient(135deg, ${color}40 0%, ${color} 100%)`,
                                    border: `2px solid ${color}`
                                }}
                            />
                            <span className="text-xs font-medium text-slate-600 dark:text-foreground/80">{label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add Section Form - Sophisticated */}
            <div className="flex gap-3 items-center bg-white dark:bg-card rounded-xl shadow-sm border border-slate-200 dark:border-border p-4">
                <input
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="Enter section name (e.g., Main Hall, Patio, VIP Area)"
                    className="flex-1 text-sm py-2.5 px-4 rounded-lg bg-slate-50 dark:bg-surface-2 border border-slate-200 dark:border-border text-slate-800 dark:text-foreground placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all"
                />
                <button
                    onClick={handleAddSection}
                    disabled={!newSectionName.trim()}
                    className="px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                >
                    + Add Section
                </button>
            </div>

            {/* Sections */}
            {viewMode === 'floor' ? (
                // Floor Plan View - Compact with drag-drop
                <div className="space-y-4">
                    {sections.map((section) => {
                        const orderedTables = getOrderedTables(section.id);
                        return (
                            <div key={section.id} className="rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-card">
                                {/* Section Header - Sophisticated gradient */}
                                <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-surface-2 dark:via-card dark:to-surface-2 px-5 py-3 border-b border-slate-200 dark:border-border">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm" />
                                            <h3 className="text-base font-bold text-slate-800 dark:text-foreground tracking-tight">{section.name}</h3>
                                            <span className="text-xs font-medium text-slate-400 dark:text-muted-foreground bg-slate-100 dark:bg-surface-3 px-2 py-0.5 rounded-full">
                                                {orderedTables.length} tables
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => removeSection(section.id, tenantId)}
                                            className="text-red-500 hover:text-red-600 text-xs font-semibold px-2.5 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>

                                {/* Floor Area - Neomorphic depth with sophisticated styling */}
                                <div
                                    className="p-5 min-h-[180px] relative floor-plan-area"
                                >
                                    {orderedTables.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-[100px] text-muted-foreground">
                                            <p className="text-xs">No tables yet</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-4 justify-start items-end">
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
                                                    className={`relative group flex flex-col items-center p-2 rounded-xl transition-all select-none table-item-neo ${
                                                        draggedTableId === table.id
                                                            ? 'opacity-40 scale-90 ring-2 ring-accent cursor-grabbing shadow-xl'
                                                            : dragOverTableId === table.id
                                                                ? 'ring-2 ring-accent scale-105 shadow-2xl bg-accent/10'
                                                                : draggedTableId
                                                                    ? 'cursor-copy hover:shadow-lg'
                                                                    : 'cursor-grab hover:shadow-lg hover:scale-[1.02]'
                                                    }`}
                                                >
                                                    <div className="pointer-events-none select-none">
                                                        {/* TableSVG handles size internally based on capacity */}
                                                        <TableSVG
                                                            tableNumber={table.tableNumber}
                                                            capacity={table.capacity}
                                                            status={table.status}
                                                            isSelected={selectedTable?.id === table.id}
                                                            isDragging={draggedTableId === table.id}
                                                        />
                                                    </div>
                                                    {/* Subtle capacity label */}
                                                    <div className="text-[10px] font-semibold text-slate-500 mt-1 pointer-events-none select-none tracking-wide">
                                                        {table.capacity} seats
                                                    </div>
                                                    {/* Delete button - more refined */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            removeTable(table.id, tenantId);
                                                        }}
                                                        className="absolute -top-2 -right-2 z-20 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg text-xs font-medium"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Add Table Form - Refined styling */}
                                <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-surface-2/50 dark:to-surface-3/50 px-5 py-3 border-t border-slate-200 dark:border-border">
                                    <div className="flex gap-3 items-center">
                                        <input
                                            className="flex-1 min-w-0 text-sm py-2 px-3 rounded-lg bg-white dark:bg-card border border-slate-200 dark:border-border text-slate-800 dark:text-foreground placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all"
                                            placeholder="Table #"
                                            type="text"
                                            value={selectedSectionId === section.id ? newTableNumber : ''}
                                            onChange={(e) => {
                                                setSelectedSectionId(section.id);
                                                setNewTableNumber(e.target.value);
                                            }}
                                        />
                                        <select
                                            className="text-sm py-2 px-3 w-20 rounded-lg bg-white dark:bg-card border border-slate-200 dark:border-border text-slate-800 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all"
                                            value={selectedSectionId === section.id ? newTableCapacity : '4'}
                                            onChange={(e) => {
                                                setSelectedSectionId(section.id);
                                                setNewTableCapacity(e.target.value);
                                            }}
                                        >
                                            {[2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                                                <option key={n} value={n}>{n} seats</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => handleAddTable(section.id)}
                                            disabled={selectedSectionId !== section.id || !newTableNumber}
                                            className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            + Add
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                // Grid View - Sophisticated Cards
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                    {sections.map((section) => {
                        const sectionTables = tables.filter(t => t.sectionId === section.id);
                        return (
                            <div key={section.id} className="bg-white dark:bg-card rounded-2xl shadow-lg border border-slate-200 dark:border-border p-4 overflow-hidden">
                                {/* Section Header */}
                                <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200 dark:border-border gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500" />
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-foreground truncate">{section.name}</h3>
                                    </div>
                                    <button
                                        onClick={() => removeSection(section.id, tenantId)}
                                        className="text-red-500 hover:text-red-600 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors whitespace-nowrap flex-shrink-0"
                                    >
                                        Delete
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {/* Tables Grid */}
                                    {sectionTables.length === 0 ? (
                                        <div className="text-center py-6 text-slate-400 dark:text-muted-foreground text-sm">
                                            No tables yet
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-2">
                                            {sectionTables.map(table => (
                                                <div
                                                    key={table.id}
                                                    className="border border-slate-200 dark:border-border p-2.5 rounded-xl bg-slate-50 dark:bg-surface-2/50 relative group cursor-pointer hover:bg-slate-100 dark:hover:bg-surface-2 transition-all hover:shadow-md overflow-hidden"
                                                    onClick={() => handleTableClick(table)}
                                                >
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className="font-bold text-xs text-slate-700 dark:text-foreground">#{table.tableNumber}</span>
                                                        <span className="text-[10px] text-slate-400 dark:text-muted-foreground font-medium">
                                                            {table.capacity}p
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <div
                                                            className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                                                            style={{
                                                                background: `linear-gradient(135deg, ${statusLegend.find(s => s.status === table.status)?.color}60 0%, ${statusLegend.find(s => s.status === table.status)?.color} 100%)`
                                                            }}
                                                        />
                                                        <span className="text-[10px] text-slate-500 dark:text-muted-foreground capitalize truncate font-medium">
                                                            {table.status}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            removeTable(table.id, tenantId);
                                                        }}
                                                        className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-xs shadow-lg font-medium"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Add Table Form - Grid view */}
                                    <div className="pt-3 border-t border-slate-200 dark:border-border">
                                        <div className="flex gap-2">
                                            <input
                                                className="flex-1 min-w-0 text-xs py-2 px-2.5 rounded-lg bg-slate-50 dark:bg-surface-2 border border-slate-200 dark:border-border text-slate-800 dark:text-foreground placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                                                placeholder="Table #"
                                                type="text"
                                                value={selectedSectionId === section.id ? newTableNumber : ''}
                                                onChange={(e) => {
                                                    setSelectedSectionId(section.id);
                                                    setNewTableNumber(e.target.value);
                                                }}
                                            />
                                            <input
                                                className="w-14 text-xs py-2 px-2 text-center rounded-lg bg-slate-50 dark:bg-surface-2 border border-slate-200 dark:border-border text-slate-800 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/50"
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
                                            <button
                                                onClick={() => handleAddTable(section.id)}
                                                disabled={selectedSectionId !== section.id || !newTableNumber}
                                                className="px-3 py-2 text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Empty State - Sophisticated */}
            {sections.length === 0 && (
                <div className="bg-white dark:bg-card rounded-2xl shadow-lg border border-slate-200 dark:border-border p-12 text-center">
                    <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-surface-2 dark:to-surface-3 flex items-center justify-center">
                        <svg className="w-10 h-10 text-slate-400 dark:text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-foreground mb-2">No Floor Sections Yet</h3>
                    <p className="text-sm text-slate-500 dark:text-muted-foreground max-w-xs mx-auto">
                        Create your first section to start adding tables. Try "Main Hall", "Patio", or "Private Dining".
                    </p>
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
