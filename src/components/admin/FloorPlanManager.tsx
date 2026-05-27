import { useState, useEffect } from 'react';
import { useFloorPlanStore } from '../../stores/floorPlanStore';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { useStaffStore } from '../../stores/staffStore';
import { useQROrderingStore } from '../../stores/qrOrderingStore';
import { QRCode } from 'react-qrcode-logo';
import { TableSVG } from '../floor/TableSVG';
import { Table, TableStatus } from '../../types/floor-plan';
import { UserRole } from '../../types/auth';

// QR Code Modal Component
const QRCodeModal = ({ table, onClose, tenantId, userId }: { table: Table; onClose: () => void; tenantId?: string; userId?: string }) => {
    const [showTest, setShowTest] = useState(false);
    const [isActivating, setIsActivating] = useState(false);
    const [isDeactivating, setIsDeactivating] = useState(false);
    const [sessionData, setSessionData] = useState<{
        qrUrl: string;
        sessionToken: string;
        expiresAt: number;
        isActive: boolean;
    } | null>(null);

    // Load existing session on open
    useEffect(() => {
        if (!tenantId) return;
        fetch(`https://handsfree-tenant-router.suyesh.workers.dev/api/orders/${tenantId}/tables/${table.id}/session`)
            .then(r => r.json())
            .then((data: any) => {
                if (data.active && data.session) {
                    setSessionData({
                        qrUrl: data.session.qrUrl,
                        sessionToken: data.session.sessionToken,
                        expiresAt: data.session.expiresAt,
                        isActive: true,
                    });
                }
            })
            .catch(() => {}); // Non-fatal — modal still works without it
    }, [tenantId, table.id]);
    const testUrl = "https://google.com";

    // Check if QR code is using tunnel URL
    const isTunnelUrl = table.qrCodeUrl?.includes('trycloudflare.com');
    const isCloudUrl = table.qrCodeUrl?.includes('handsfree.tech');

    // Create a properly encoded URL (handle empty URL case)
    const encodedTableUrl = sessionData?.qrUrl || (table.qrCodeUrl ? table.qrCodeUrl.replace('#', '%23') : '');

    // Check if session is active and not expired
    const isSessionActive = sessionData?.isActive && sessionData.expiresAt > Date.now();

    // Activate table session
    const handleActivateTable = async () => {
        if (!tenantId || !userId) {
            alert('Missing tenant or user information');
            return;
        }

        setIsActivating(true);
        try {
            const response = await fetch(`https://handsfree-tenant-router.suyesh.workers.dev/api/orders/${tenantId}/tables/${table.id}/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activatedBy: userId,
                    durationMs: 4 * 60 * 60 * 1000, // 4 hours
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({})) as any;
                console.error('[FloorPlan] Activate table error response:', errData);
                throw new Error(errData.message || errData.error || `HTTP ${response.status}`);
            }

            const data = await response.json() as any;
            setSessionData({
                qrUrl: data.session.qrUrl,
                sessionToken: data.session.sessionToken,
                expiresAt: data.session.expiresAt,
                isActive: true,
            });
            useFloorPlanStore.getState().updateTableStatus(table.id, 'occupied' as TableStatus, tenantId);
            alert('✅ Table activated! Session expires in 4 hours.');
        } catch (error: any) {
            console.error('[FloorPlan] Failed to activate table:', error);
            alert(`Failed to activate table: ${error.message}`);
        } finally {
            setIsActivating(false);
        }
    };

    // Deactivate table session
    const handleDeactivateTable = async () => {
        if (!tenantId || !userId) {
            alert('Missing tenant or user information');
            return;
        }

        setIsDeactivating(true);
        try {
            const response = await fetch(`https://handsfree-tenant-router.suyesh.workers.dev/api/orders/${tenantId}/tables/${table.id}/deactivate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ closedBy: userId }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({})) as any;
                throw new Error(errData.message || errData.error || `HTTP ${response.status}`);
            }

            setSessionData(null);
            useFloorPlanStore.getState().updateTableStatus(table.id, 'available' as TableStatus, tenantId);
            alert('✅ Table deactivated.');
        } catch (error: any) {
            console.error('[FloorPlan] Failed to deactivate table:', error);
            alert(`Failed to deactivate table: ${error.message}`);
        } finally {
            setIsDeactivating(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-card rounded-2xl p-5 shadow-2xl max-w-md w-full mx-4 animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="text-center">
                    <h3 className="text-lg font-bold text-foreground mb-0.5">
                        Table #{table.tableNumber}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                        {table.capacity} seats • {table.status}
                    </p>

                    {/* Table Preview */}
                    <div className="flex justify-center mb-3">
                        <TableSVG
                            tableNumber={table.tableNumber}
                            capacity={table.capacity}
                            status={table.status}
                            size="md"
                        />
                    </div>

                    {/* URL Type Indicator */}
                    {!showTest && (
                        <div className="mb-3">
                            {isTunnelUrl ? (
                                <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-300-blue-700 px-3 py-1.5 text-center">
                                    <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                                        ⚡ Tunnel URL - Instant Ordering
                                    </p>
                                    <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                                        10-100ms latency via local server
                                    </p>
                                </div>
                            ) : isCloudUrl ? (
                                <div className="bg-orange-100 dark:bg-orange-900/30 border border-orange-300-orange-700 px-3 py-1.5 text-center">
                                    <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">
                                        ☁️ Cloud URL - Standard Ordering
                                    </p>
                                    <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-0.5">
                                        5-10s latency • Use "🔄 Use Tunnel URLs" button to upgrade
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-surface-3/30 border border px-3 py-1.5 text-center">
                                    <p className="text-xs font-semibold text-foreground">
                                        🏠 Local URL
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        Development mode
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Toggle buttons */}
                    <div className="flex gap-2 mb-3">
                        <button
                            onClick={() => setShowTest(false)}
                            className={`flex-1 px-2 py-1.5  text-[10px] font-medium transition-all ${
                                !showTest
                                    ? 'bg-accent text-white'
                                    : 'bg-muted text-muted-foreground'
                            }`}
                        >
                            Table URL
                        </button>
                        <button
                            onClick={() => setShowTest(true)}
                            className={`flex-1 px-2 py-1.5  text-[10px] font-medium transition-all ${
                                showTest
                                    ? 'bg-accent text-white'
                                    : 'bg-muted text-muted-foreground'
                            }`}
                        >
                            Test (Google)
                        </button>
                    </div>

                    {/* QR Code */}
                    <div className="flex justify-center">
                        <div className="bg-card p-6 shadow-inner">
                            <QRCode
                                value={showTest ? testUrl : encodedTableUrl}
                                size={256}
                                ecLevel="M"
                                quietZone={20}
                                qrStyle="squares"
                                eyeRadius={0}
                                bgColor="#FFFFFF"
                                fgColor="#000000"
                                removeQrCodeBehindLogo={true}
                                enableCORS={false}
                            />
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-3 mb-2 text-center">
                        {showTest ? '✅ Test QR - Opens Google' : 'Scan to view menu & order'}
                    </p>

                    {/* Session Status & Activation Controls */}
                    {!showTest && (
                        <div className="mb-3 p-3 border-2 border-dashed" style={{
                            borderColor: isSessionActive ? '#10b981' : '#94a3b8',
                            backgroundColor: isSessionActive ? '#d1fae5' : '#f1f5f9'
                        }}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold" style={{
                                    color: isSessionActive ? '#065f46' : '#475569'
                                }}>
                                    {isSessionActive ? '🟢 Active Session' : '⚪ No Active Session'}
                                </span>
                                {sessionData?.expiresAt && (
                                    <span className="text-[10px] text-muted-foreground">
                                        Expires: {new Date(sessionData.expiresAt).toLocaleTimeString()}
                                    </span>
                                )}
                            </div>

                            {isSessionActive ? (
                                <button
                                    onClick={handleDeactivateTable}
                                    disabled={isDeactivating}
                                    className="w-full px-3 py-1.5 bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                                >
                                    {isDeactivating ? '⏳ Deactivating...' : '🔒 Close Table Session'}
                                </button>
                            ) : (
                                <button
                                    onClick={handleActivateTable}
                                    disabled={isActivating}
                                    className="w-full px-3 py-1.5 bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                                >
                                    {isActivating ? '⏳ Activating...' : '🔓 Activate for Ordering (4h)'}
                                </button>
                            )}

                            <p className="text-[9px] text-muted-foreground mt-2 leading-relaxed">
                                {isSessionActive
                                    ? '✅ Customers can scan and order. Close when they leave.'
                                    : '⚠️ Table must be activated before customers can order.'}
                            </p>
                        </div>
                    )}

                    {/* Display QR Code URL for debugging */}
                    <div className="bg-slate-50 px-3 py-2 mb-3 max-h-32 overflow-y-auto">
                        <p className="text-[8px] text-slate-400 mb-1 font-semibold">
                            {showTest ? 'TEST URL:' : sessionData?.qrUrl ? 'SECURE SESSION URL:' : 'TABLE URL:'}
                        </p>
                        <p className="text-[9px] text-slate-700 font-mono break-all leading-relaxed">
                            {showTest ? testUrl : (sessionData?.qrUrl || table.qrCodeUrl)}
                        </p>
                        <div className="mt-2 pt-2 border-t border-slate-200-border">
                            <p className="text-[8px] text-slate-400">
                                {sessionData?.qrUrl ? '🔒 HMAC-signed secure URL' : (
                                    table.qrCodeUrl?.includes('trycloudflare.com')
                                        ? '⚡ Tunnel URL (instant local ordering)'
                                        : table.qrCodeUrl?.includes('handsfree.tech')
                                        ? '☁️ Cloud URL (5-10s latency)'
                                        : 'Length: ' + (showTest ? testUrl : table.qrCodeUrl || '').length + ' chars'
                                )} |
                                Size: 256px | EC: M | Quiet: 20px
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                const url = showTest ? testUrl : table.qrCodeUrl;
                                navigator.clipboard.writeText(url);
                                alert(`✅ URL copied!\n\nPaste in your phone's browser to test:\n${url}`);
                            }}
                            className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                            📋 Copy URL
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 px-3 py-1.5 bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
                        >
                            Close
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="flex-1 px-3 py-1.5 bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
                        >
                            Print
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const FloorPlanManager = () => {
    const { user } = useAuthStore();
    const { tenant } = useTenantStore();
    const { sections, tables, addSection, removeSection, addTable, removeTable, loadFloorPlan, syncToCloud, isLoading, isLoaded, isSyncing, lastSyncedAt, assignments, assignStaff, removeStaffAssignment, regenerateQRCodesWithTunnelUrl } = useFloorPlanStore();
    const { staff, loadStaffFromDatabase, isLoaded: staffLoaded, isLoading: staffLoading } = useStaffStore();
    const tunnelUrl = useQROrderingStore((state) => state.tunnelUrl);
    const isTunnelActive = useQROrderingStore((state) => state.isTunnelActive);
    const [newSectionName, setNewSectionName] = useState('');
    const [newTableNumber, setNewTableNumber] = useState('');
    const [newTableCapacity, setNewTableCapacity] = useState('4');
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
    const [selectedTable, setSelectedTable] = useState<Table | null>(null);
    const [showQRModal, setShowQRModal] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'floor'>('floor');
    const [isFixingQRCodes, setIsFixingQRCodes] = useState(false);
    const [isRegeneratingQRCodes, setIsRegeneratingQRCodes] = useState(false);

    // Staff assignment state
    const [showStaffAssignModal, setShowStaffAssignModal] = useState(false);
    const [assignmentSectionId, setAssignmentSectionId] = useState<string | null>(null);
    const [selectedStaffId, setSelectedStaffId] = useState<string>('');
    const [assignToWholeSectionMode, setAssignToWholeSectionMode] = useState(true);

    // Drag and drop state
    const [draggedTableId, setDraggedTableId] = useState<string | null>(null);
    const [dragOverTableId, setDragOverTableId] = useState<string | null>(null);
    const [tableOrder, setTableOrder] = useState<Record<string, string[]>>({});

    const tenantId = tenant?.tenantId || user?.tenantId;

    // Debug user state on mount
    useEffect(() => {
        console.log('[FloorPlanManager] Component mounted');
        console.log('[FloorPlanManager] User:', user);
        console.log('[FloorPlanManager] Tenant ID:', tenantId);
        console.log('[FloorPlanManager] Staff loaded:', staff.length, 'members');
    }, [user, tenantId, staff.length]);

    // Fix existing QR code URLs (add #/ for HashRouter)
    const handleFixQRCodes = async () => {
        if (!tenantId) return;

        setIsFixingQRCodes(true);
        try {
            const { fixExistingQRCodeURLs } = await import('../../lib/fixQRCodes');
            const result = await fixExistingQRCodeURLs(tenantId);

            if (result.errors.length > 0) {
                alert(`Fixed ${result.fixed} QR codes with ${result.errors.length} errors. Check console for details.`);
                console.error('[FloorPlanManager] QR fix errors:', result.errors);
            } else {
                alert(`✅ Successfully fixed ${result.fixed} QR code URLs!`);
            }

            // Reload floor plan to get updated URLs
            await loadFloorPlan(tenantId);

            // Push fixed URLs to cloud to prevent cloud sync from overwriting them
            console.log('[FloorPlanManager] Syncing fixed URLs to cloud...');
            await syncToCloud(tenantId);
            console.log('[FloorPlanManager] ✅ Fixed URLs synced to cloud');

            // If a table is currently selected in the QR modal, refresh it with updated data
            if (selectedTable) {
                // Get the fresh tables array from the store (after loadFloorPlan updated it)
                const freshTables = useFloorPlanStore.getState().tables;
                const updatedTable = freshTables.find(t => t.id === selectedTable.id);
                if (updatedTable) {
                    console.log('[FloorPlanManager] Refreshing selected table with updated URL:', updatedTable.qrCodeUrl);
                    setSelectedTable(updatedTable);
                } else {
                    console.warn('[FloorPlanManager] Could not find selected table in updated data');
                }
            }
        } catch (error) {
            console.error('[FloorPlanManager] Failed to fix QR codes:', error);
            alert(`Failed to fix QR codes: ${error}`);
        } finally {
            setIsFixingQRCodes(false);
        }
    };

    // Load floor plan and staff on mount
    useEffect(() => {
        const initFloorPlan = async () => {
            // Auto-detect tenant ID if missing
            let effectiveTenantId: string | undefined = tenantId;
            if (!effectiveTenantId && user) {
                console.log('[FloorPlanManager] No tenant ID, attempting auto-detection...');
                try {
                    const { autoDetectAndSetTenant } = await import('../../services/autoDetectTenant');
                    const detected = await autoDetectAndSetTenant();
                    if (detected) {
                        effectiveTenantId = detected;
                        console.log('[FloorPlanManager] ✅ Auto-detected tenant:', effectiveTenantId);
                        // Force re-render by updating a dummy state or just continue
                    } else {
                        console.warn('[FloorPlanManager] ⚠️  Could not auto-detect tenant ID');
                        console.warn('[FloorPlanManager] Open: http://localhost:1420/auto-detect-tenant.html');
                        return;
                    }
                } catch (err) {
                    console.error('[FloorPlanManager] Auto-detection failed:', err);
                    return;
                }
            }

            if (!effectiveTenantId) return;

            // First load from local SQLite (fast, offline-first)
            if (!isLoaded && !isLoading) {
                await loadFloorPlan(effectiveTenantId);
            }

            // Load staff for assignments
            await loadStaffFromDatabase(effectiveTenantId);

            // Floor plans are stored locally by table ID - cloud sync not needed
            // Data is already in the local database and doesn't need cloud sync
            // syncFromCloud(effectiveTenantId).catch(e =>
            //     console.warn('[FloorPlanManager] Cloud sync failed:', e)
            // );
        };

        initFloorPlan();
    }, [tenantId, user, isLoaded, isLoading, loadFloorPlan, loadStaffFromDatabase]);

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

    // Staff assignment handlers
    const handleOpenStaffAssignment = (sectionId: string) => {
        setAssignmentSectionId(sectionId);
        setSelectedStaffId('');
        setShowStaffAssignModal(true);
        // Ensure staff is loaded — covers the case where the modal opens before the mount effect completes
        if (tenantId && !staffLoaded && !staffLoading) {
            loadStaffFromDatabase(tenantId);
        }
    };

    const handleAssignStaff = async () => {
        if (!selectedStaffId || !assignmentSectionId || !tenantId) return;

        const selectedStaff = staff.find(s => s.id === selectedStaffId);
        if (!selectedStaff) return;

        try {
            if (assignToWholeSectionMode) {
                // Assign to entire section
                await assignStaff(selectedStaffId, selectedStaff.name, [assignmentSectionId], [], tenantId);
            } else {
                // Assign to specific tables in section
                const sectionTables = tables.filter(t => t.sectionId === assignmentSectionId);
                const tableIds = sectionTables.map(t => t.id);
                await assignStaff(selectedStaffId, selectedStaff.name, [], tableIds, tenantId);
            }

            setShowStaffAssignModal(false);
            setSelectedStaffId('');
            setAssignmentSectionId(null);
        } catch (error) {
            console.error('[FloorPlanManager] Failed to assign staff:', error);
            alert('Failed to assign staff: ' + (error as Error).message);
        }
    };

    const handleRemoveStaffAssignment = async (staffId: string) => {
        if (!tenantId) return;

        if (confirm('Remove this staff assignment?')) {
            try {
                await removeStaffAssignment(staffId, tenantId);
            } catch (error) {
                console.error('[FloorPlanManager] Failed to remove staff assignment:', error);
                alert('Failed to remove staff assignment: ' + (error as Error).message);
            }
        }
    };

    // Get assigned staff for a section
    const getAssignedStaffForSection = (sectionId: string) => {
        return assignments.filter(a => a.sectionIds.includes(sectionId));
    };

    // Regenerate QR codes with tunnel URL
    const handleRegenerateQRCodes = async () => {
        if (!tenantId) {
            alert('Tenant ID not available');
            return;
        }

        if (!tunnelUrl) {
            alert('Tunnel is not running. Please start the tunnel first in Settings → QR Code Ordering.');
            return;
        }

        const confirm = window.confirm(
            `Regenerate all ${tables.length} QR codes with tunnel URL?\n\n` +
            `New URL: ${tunnelUrl}\n\n` +
            `This will update all table QR codes to use the local cloudflared tunnel ` +
            `instead of the cloud subdomain, providing instant order notifications (<100ms latency).`
        );

        if (!confirm) return;

        setIsRegeneratingQRCodes(true);
        try {
            const result = await regenerateQRCodesWithTunnelUrl(tenantId);

            if (result.errors.length > 0) {
                alert(
                    `✅ Updated ${result.updated} QR codes\n\n` +
                    `⚠️ ${result.errors.length} errors:\n${result.errors.join('\n')}`
                );
            } else {
                alert(`✅ Successfully updated ${result.updated} QR codes with tunnel URL!`);
            }
        } catch (error) {
            console.error('[FloorPlanManager] Failed to regenerate QR codes:', error);
            alert('Failed to regenerate QR codes: ' + (error as Error).message);
        } finally {
            setIsRegeneratingQRCodes(false);
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
                    {/* Regenerate QR Codes with Tunnel URL button */}
                    {isTunnelActive() && (
                        <button
                            onClick={handleRegenerateQRCodes}
                            disabled={isRegeneratingQRCodes || !tenantId}
                            className={`px-3 py-1.5  text-xs font-medium transition-all flex items-center gap-1.5 ${
                                isRegeneratingQRCodes
                                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                            title="Regenerate all QR codes to use cloudflared tunnel URL (instant local ordering)"
                        >
                            {isRegeneratingQRCodes ? (
                                <>
                                    <span className="animate-spin">⟳</span>
                                    Updating...
                                </>
                            ) : (
                                <>
                                    🔄 Use Tunnel URLs
                                </>
                            )}
                        </button>
                    )}

                    {/* Fix QR Codes button (for existing tables with old URLs) */}
                    <button
                        onClick={handleFixQRCodes}
                        disabled={isFixingQRCodes || !tenantId}
                        className={`px-3 py-1.5  text-xs font-medium transition-all flex items-center gap-1.5 ${
                            isFixingQRCodes
                                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                        title="Fix QR code URLs for existing tables (adds #/ for HashRouter)"
                    >
                        {isFixingQRCodes ? (
                            <>
                                <span className="animate-spin">⟳</span>
                                Fixing...
                            </>
                        ) : (
                            <>
                                🔧 Fix QR Codes
                            </>
                        )}
                    </button>
                    <div className="flex items-center gap-2 neo-inset-sm p-1">
                    <button
                        onClick={() => setViewMode('floor')}
                        className={`px-3 py-1.5  text-xs font-medium transition-all ${
                            viewMode === 'floor'
                                ? 'bg-accent text-white shadow-md'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Floor View
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`px-3 py-1.5  text-xs font-medium transition-all ${
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
            <div className="bg-card shadow-sm border border-slate-200-border px-4 py-3">
                <div className="flex flex-wrap items-center gap-5">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status:</span>
                    {statusLegend.map(({ status, label, color }) => (
                        <div key={status} className="flex items-center gap-2">
                            <div
                                className="w-3.5 h-3.5 rounded-full shadow-sm"
                                style={{
                                    background: `linear-gradient(135deg, ${color}40 0%, ${color} 100%)`,
                                    border: `2px solid ${color}`
                                }}
                            />
                            <span className="text-xs font-medium text-muted-foreground/80">{label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add Section Form - Sophisticated */}
            <div className="flex gap-3 items-center bg-card shadow-sm border border-slate-200-border p-4">
                <input
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="Enter section name (e.g., Main Hall, Patio, VIP Area)"
                    className="flex-1 text-sm py-2.5 px-4 bg-slate-50 border border-slate-200-border text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all"
                />
                <button
                    onClick={handleAddSection}
                    disabled={!newSectionName.trim()}
                    className="px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
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
                            <div key={section.id} className="rounded-2xl overflow-hidden shadow-lg border border-slate-200-slate-700 bg-card">
                                {/* Section Header - Sophisticated gradient */}
                                <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-surface-2 dark:via-card dark:to-surface-2 px-5 py-3 border-b border-slate-200-border">
                                    <div className="flex justify-between items-center gap-3">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm flex-shrink-0" />
                                            <h3 className="text-base font-bold text-slate-800 tracking-tight truncate">{section.name}</h3>
                                            <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                {orderedTables.length} tables
                                            </span>

                                            {/* Assigned Staff Display */}
                                            {getAssignedStaffForSection(section.id).length > 0 && (
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    {getAssignedStaffForSection(section.id).map(assignment => (
                                                        <div
                                                            key={assignment.userId}
                                                            className="flex items-center gap-1.5 bg-green-100 dark:bg-green-500/20 px-2 py-0.5 rounded-full"
                                                        >
                                                            <span className="text-xs font-medium text-green-700 dark:text-green-300">
                                                                👤 {assignment.userName}
                                                            </span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRemoveStaffAssignment(assignment.userId);
                                                                }}
                                                                className="text-green-700 dark:text-green-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                                                title="Remove assignment"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => handleOpenStaffAssignment(section.id)}
                                                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-xs font-semibold px-2.5 py-1 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors whitespace-nowrap"
                                                title="Assign service staff to this section"
                                            >
                                                👤 Assign Staff
                                            </button>
                                            <button
                                                onClick={() => removeSection(section.id, tenantId)}
                                                className="text-red-500 hover:text-red-600 text-xs font-semibold px-2.5 py-1 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </div>
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
                                                    className={`relative group flex flex-col items-center p-2  transition-all select-none table-item-neo ${
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
                                                    <div className="text-[10px] font-semibold text-muted-foreground mt-1 pointer-events-none select-none tracking-wide">
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
                                <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-surface-2/50 dark:to-surface-3/50 px-5 py-3 border-t border-slate-200-border">
                                    <div className="flex gap-3 items-center">
                                        <input
                                            className="flex-1 min-w-0 text-sm py-2 px-3 bg-card border border-slate-200-border text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all"
                                            placeholder="Table #"
                                            type="text"
                                            value={selectedSectionId === section.id ? newTableNumber : ''}
                                            onChange={(e) => {
                                                setSelectedSectionId(section.id);
                                                setNewTableNumber(e.target.value);
                                            }}
                                        />
                                        <select
                                            className="text-sm py-2 px-3 w-20 bg-card border border-slate-200-border text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all"
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
                                            className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                            <div key={section.id} className="bg-card rounded-2xl shadow-lg border border-slate-200-border p-4 overflow-hidden">
                                {/* Section Header */}
                                <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200-border gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500" />
                                        <h3 className="text-sm font-bold text-slate-800 truncate">{section.name}</h3>
                                    </div>
                                    <button
                                        onClick={() => removeSection(section.id, tenantId)}
                                        className="text-red-500 hover:text-red-600 text-xs font-semibold px-2 py-1 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors whitespace-nowrap flex-shrink-0"
                                    >
                                        Delete
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {/* Tables Grid */}
                                    {sectionTables.length === 0 ? (
                                        <div className="text-center py-6 text-slate-400 text-sm">
                                            No tables yet
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-2">
                                            {sectionTables.map(table => (
                                                <div
                                                    key={table.id}
                                                    className="border border-slate-200-border p-2.5 bg-slate-50/50 relative group cursor-pointer hover:bg-slate-100 dark:hover:bg-surface-2 transition-all hover:shadow-md overflow-hidden"
                                                    onClick={() => handleTableClick(table)}
                                                >
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className="font-bold text-xs text-slate-700">#{table.tableNumber}</span>
                                                        <span className="text-[10px] text-slate-400 font-medium">
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
                                                        <span className="text-[10px] text-muted-foreground capitalize truncate font-medium">
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
                                    <div className="pt-3 border-t border-slate-200-border">
                                        <div className="flex gap-2">
                                            <input
                                                className="flex-1 min-w-0 text-xs py-2 px-2.5 bg-slate-50 border border-slate-200-border text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                                                placeholder="Table #"
                                                type="text"
                                                value={selectedSectionId === section.id ? newTableNumber : ''}
                                                onChange={(e) => {
                                                    setSelectedSectionId(section.id);
                                                    setNewTableNumber(e.target.value);
                                                }}
                                            />
                                            <input
                                                className="w-14 text-xs py-2 px-2 text-center bg-slate-50 border border-slate-200-border text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
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
                                                className="px-3 py-2 text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="bg-card rounded-2xl shadow-lg border border-slate-200-border p-12 text-center">
                    <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-surface-2 dark:to-surface-3 flex items-center justify-center">
                        <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">No Floor Sections Yet</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        Create your first section to start adding tables. Try "Main Hall", "Patio", or "Private Dining".
                    </p>
                </div>
            )}

            {/* QR Code Modal */}
            {showQRModal && selectedTable && <QRCodeModal table={selectedTable} onClose={() => setShowQRModal(false)} tenantId={tenantId} userId={user?.id} />}

            {/* Staff Assignment Modal */}
            {(() => {
                console.log('[FloorPlanManager] Modal render check:', { showStaffAssignModal, assignmentSectionId, staffCount: staff.length });
                return null;
            })()}
            {showStaffAssignModal && assignmentSectionId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowStaffAssignModal(false)}>
                    <div className="bg-card rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4 animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-foreground mb-4">Assign Service Staff</h3>

                        {/* Section Info */}
                        <div className="bg-accent/10 p-3 mb-4">
                            <p className="text-sm text-muted-foreground">Assigning to section:</p>
                            <p className="text-lg font-bold text-foreground">
                                {sections.find(s => s.id === assignmentSectionId)?.name}
                            </p>
                        </div>

                        {/* Staff Selection */}
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-foreground mb-2">
                                Select Staff Member
                            </label>
                            {staffLoading && !staffLoaded ? (
                                <div className="w-full px-4 py-3 bg-surface-2 border border-border text-muted-foreground text-sm">
                                    Loading staff…
                                </div>
                            ) : (
                                <select
                                    value={selectedStaffId}
                                    onChange={(e) => setSelectedStaffId(e.target.value)}
                                    className="w-full px-4 py-3 bg-surface-2 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                                >
                                    <option value="">-- Select Staff --</option>
                                    {staff.filter(s => s.isActive && (s.role === UserRole.SERVER || s.role === UserRole.MANAGER)).map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} ({s.role})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Assignment Mode */}
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-foreground mb-2">
                                Assignment Mode
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setAssignToWholeSectionMode(true)}
                                    className={`flex-1 px-3 py-2  text-sm font-medium transition-all ${
                                        assignToWholeSectionMode
                                            ? 'bg-accent text-white'
                                            : 'bg-surface-2 text-muted-foreground'
                                    }`}
                                >
                                    Entire Section
                                </button>
                                <button
                                    onClick={() => setAssignToWholeSectionMode(false)}
                                    className={`flex-1 px-3 py-2  text-sm font-medium transition-all ${
                                        !assignToWholeSectionMode
                                            ? 'bg-accent text-white'
                                            : 'bg-surface-2 text-muted-foreground'
                                    }`}
                                >
                                    Specific Tables
                                </button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                {assignToWholeSectionMode
                                    ? 'Staff will be assigned to all tables in this section'
                                    : 'Staff will be assigned to individual tables you select'}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowStaffAssignModal(false)}
                                className="flex-1 px-4 py-2.5 bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAssignStaff}
                                disabled={!selectedStaffId}
                                className="flex-1 px-4 py-2.5 bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Assign Staff
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
