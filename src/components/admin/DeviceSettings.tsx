import { useState, useRef, useEffect } from 'react';
import { useDeviceStore, DeviceMode } from '../../stores/deviceStore';
import { useStaffStore } from '../../stores/staffStore';
import { useFloorPlanStore } from '../../stores/floorPlanStore';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { usePOSStore } from '../../stores/posStore';
import { useKDSStore } from '../../stores/kdsStore';
import { orderSyncService } from '../../lib/orderSyncService';
import { RemotePrintSettings } from './RemotePrintSettings';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
    discoverLanServers,
    getLanServerStatus,
    getLanClientStatus,
    type DiscoveredServer,
    type LanServerStatus,
    type LanClientStatus,
} from '../../lib/lanSyncService';

const ADMIN_PASSWORD = '6163';
const REQUIRED_CLICKS = 7;
const CLICK_TIMEOUT = 3000; // Reset counter after 3 seconds of no clicks

export const DeviceSettings = () => {
    const navigate = useNavigate();
    const { deviceMode, isLocked, setDeviceMode, setLocked } = useDeviceStore();
    const staff = useStaffStore((state) => state.staff);
    const { sections, tables } = useFloorPlanStore();
    const { user } = useAuthStore();
    const { tenant } = useTenantStore();
    const activeTables = usePOSStore((state) => state.activeTables);
    const { activeOrders, completedOrders } = useKDSStore();
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
    const [cleanupStatus, setCleanupStatus] = useState<'idle' | 'cleaning' | 'success' | 'error'>('idle');

    // LAN Discovery state
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [discoveredServers, setDiscoveredServers] = useState<DiscoveredServer[]>([]);
    const [discoveryError, setDiscoveryError] = useState<string | null>(null);
    const [lanServerStatus, setLanServerStatus] = useState<LanServerStatus | null>(null);
    const [lanClientStatus, setLanClientStatus] = useState<LanClientStatus | null>(null);
    const [discoveryProgress, setDiscoveryProgress] = useState(0);

    // Get effective tenant ID and connection status
    const effectiveTenantId = user?.tenantId || tenant?.tenantId;
    const connectionStatus = orderSyncService.getConnectionStatus();

    // Order counts for cleanup section
    const activeTableCount = Object.keys(activeTables).length;
    const kdsOrderCount = activeOrders.length + completedOrders.length;

    // Hidden admin access state
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState(false);
    const clickCountRef = useRef(0);
    const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Handle hidden button clicks
    const handleHiddenClick = () => {
        // Clear previous timeout
        if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
        }

        clickCountRef.current += 1;

        if (clickCountRef.current >= REQUIRED_CLICKS) {
            clickCountRef.current = 0;
            setShowPasswordModal(true);
        }

        // Reset counter after timeout
        clickTimeoutRef.current = setTimeout(() => {
            clickCountRef.current = 0;
        }, CLICK_TIMEOUT);
    };

    // Handle password submission
    const handlePasswordSubmit = () => {
        if (password === ADMIN_PASSWORD) {
            setIsAdminMode(true);
            setShowPasswordModal(false);
            setPassword('');
            setPasswordError(false);
        } else {
            setPasswordError(true);
            setPassword('');
        }
    };

    // Handle password modal close
    const handlePasswordCancel = () => {
        setShowPasswordModal(false);
        setPassword('');
        setPasswordError(false);
    };

    // Fetch LAN status on mount and periodically
    useEffect(() => {
        const fetchLanStatus = async () => {
            try {
                // Check if we're running in Tauri
                if (typeof window !== 'undefined' && '__TAURI__' in window) {
                    const serverStatus = await getLanServerStatus();
                    setLanServerStatus(serverStatus);

                    const clientStatus = await getLanClientStatus();
                    setLanClientStatus(clientStatus);
                }
            } catch (error) {
                console.log('[DeviceSettings] LAN status fetch skipped (not in Tauri):', error);
            }
        };

        fetchLanStatus();
        const interval = setInterval(fetchLanStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    // Handle LAN discovery
    const handleDiscoverServers = async () => {
        setIsDiscovering(true);
        setDiscoveryError(null);
        setDiscoveredServers([]);
        setDiscoveryProgress(0);

        // Simulate progress
        const progressInterval = setInterval(() => {
            setDiscoveryProgress((prev) => Math.min(prev + 10, 90));
        }, 500);

        try {
            const servers = await discoverLanServers(effectiveTenantId || undefined, 10);
            setDiscoveredServers(servers);
            setDiscoveryProgress(100);
        } catch (error) {
            console.error('[DeviceSettings] Discovery failed:', error);
            setDiscoveryError(error instanceof Error ? error.message : 'Discovery failed');
        } finally {
            clearInterval(progressInterval);
            setIsDiscovering(false);
            setTimeout(() => setDiscoveryProgress(0), 2000);
        }
    };

    const modes: { value: DeviceMode; label: string; desc: string }[] = [
        { value: 'owner', label: 'Owner / Full Access', desc: 'Default mode. Full dashboard access (Standard login required).' },
        { value: 'pos', label: 'Dedicated POS Mode', desc: 'Locks device to the POS Interface. Bypasses general login if session is active.' },
        { value: 'kds', label: 'Dedicated KDS Mode', desc: 'Locks device to the Kitchen Display System interface.' },
        { value: 'aggregator', label: 'Aggregator Mode', desc: 'Locks device to the Order Aggregator dashboard.' },
        { value: 'customer', label: 'Self-Service Kiosk', desc: 'Locks device to the Customer Ordering interface.' },
    ];

    const handleLock = () => {
        if (confirm(`Lock this device to ${deviceMode.toUpperCase()} mode? The app will boot directly into this view.`)) {
            setLocked(true);
            window.location.reload();
        }
    };

    const handleUnlock = () => {
        setLocked(false);
        alert("Device Unlocked. Returning to Owner mode.");
    };

    // Request sync from other devices (for KDS/non-POS modes)
    const handleRequestSync = () => {
        setSyncStatus('syncing');
        console.log('[DeviceSettings] Requesting sync from other devices...');
        orderSyncService.requestSync();
        // Set success after a short delay (sync happens asynchronously)
        setTimeout(() => {
            setSyncStatus('success');
            setTimeout(() => setSyncStatus('idle'), 3000);
        }, 1000);
    };

    // Broadcast current state to other devices (for POS/Manager modes)
    const handleBroadcastSync = () => {
        setSyncStatus('syncing');
        console.log('[DeviceSettings] Broadcasting staff and floor plan to other devices...');
        console.log(`[DeviceSettings] Staff: ${staff.length}, Sections: ${sections.length}, Tables: ${tables.length}`);

        const floorPlanStore = useFloorPlanStore.getState();
        orderSyncService.broadcastStaffSync(staff);
        orderSyncService.broadcastFloorPlanSync(
            floorPlanStore.sections,
            floorPlanStore.tables,
            floorPlanStore.assignments
        );

        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 3000);
    };

    // Cleanup orphaned orders and table sessions
    const handleCleanup = async () => {
        if (!confirm('This will clear ALL active table sessions and KDS orders. This action cannot be undone. Continue?')) {
            return;
        }

        setCleanupStatus('cleaning');
        console.log('[DeviceSettings] Starting cleanup...');

        try {
            // Clear all KDS orders
            useKDSStore.getState().clearAllOrders();
            console.log('[DeviceSettings] Cleared KDS orders');

            // Clear all table sessions
            await usePOSStore.getState().clearAllTables(effectiveTenantId || undefined);
            console.log('[DeviceSettings] Cleared table sessions');

            setCleanupStatus('success');
            setTimeout(() => setCleanupStatus('idle'), 3000);
        } catch (error) {
            console.error('[DeviceSettings] Cleanup failed:', error);
            setCleanupStatus('error');
            setTimeout(() => setCleanupStatus('idle'), 3000);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto relative p-6 bg-background">
            {/* Hidden admin access button - invisible in top-right corner */}
            <div
                onClick={handleHiddenClick}
                className="absolute top-0 right-0 w-12 h-12 cursor-default z-10"
                aria-hidden="true"
            />

            {/* Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-card rounded-xl p-6 w-80 shadow-2xl border border-border">
                        <h3 className="text-lg font-bold mb-4 text-center text-foreground">Admin Access</h3>
                        <input
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setPasswordError(false);
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                            placeholder="Enter PIN"
                            className={cn(
                                'w-full p-3 border-2 rounded-lg text-center text-2xl tracking-widest mb-4 bg-surface-2 text-foreground',
                                passwordError ? 'border-destructive bg-destructive/10' : 'border-border'
                            )}
                            autoFocus
                            maxLength={6}
                        />
                        {passwordError && (
                            <p className="text-destructive text-sm text-center mb-4">Incorrect PIN</p>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={handlePasswordCancel}
                                className="flex-1 py-2 px-4 border-2 border-border rounded-lg font-bold hover:bg-surface-2 text-foreground transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePasswordSubmit}
                                className="flex-1 py-2 px-4 bg-accent text-white rounded-lg font-bold hover:opacity-90 transition-colors"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Operational Mode Section */}
            <div className="settings-section">
                <div className="flex justify-between items-center mb-4 border-b border-border pb-2">
                    <h3 className="text-xl font-black uppercase text-foreground">Operational Mode</h3>
                    {isAdminMode && (
                        <span className="text-xs bg-success/20 text-success px-2 py-1 rounded-full font-bold">
                            ADMIN
                        </span>
                    )}
                </div>

                {!isAdminMode ? (
                    <div className="bg-surface-2 border-l-4 border-muted-foreground p-4 rounded-r-lg">
                        <p className="text-muted-foreground text-sm">
                            Device mode changes are restricted. Contact your administrator.
                        </p>
                        <p className="text-muted-foreground/70 text-xs mt-2">
                            Current Mode: <span className="font-bold text-foreground">{deviceMode.toUpperCase()}</span>
                            {isLocked && <span className="ml-2 text-warning">(LOCKED)</span>}
                        </p>
                    </div>
                ) : isLocked ? (
                    <div className="bg-warning/10 border-l-4 border-warning p-4 mb-6 rounded-r-lg">
                        <div className="flex justify-between items-center flex-wrap gap-3">
                            <div>
                                <p className="font-bold text-warning uppercase">Device is LOCKED</p>
                                <p className="text-sm text-foreground/80">Current Mode: <span className="font-black underline">{deviceMode.toUpperCase()}</span></p>
                            </div>
                            <button
                                onClick={handleUnlock}
                                className="px-4 py-2 bg-destructive text-white font-bold rounded-lg hover:opacity-90 transition-colors"
                            >
                                UNLOCK DEVICE
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="mb-6">
                        <p className="text-sm text-muted-foreground mb-4 italic">
                            Configure this tablet or computer for a specific purpose.
                        </p>
                        <div className="space-y-3">
                            {modes.map(mode => (
                                <div
                                    key={mode.value}
                                    onClick={() => setDeviceMode(mode.value)}
                                    className={cn(
                                        'p-4 border-2 rounded-lg cursor-pointer transition-all',
                                        deviceMode === mode.value
                                            ? 'border-accent bg-accent/10 shadow-md ring-2 ring-accent/30'
                                            : 'border-border hover:border-muted-foreground bg-surface-2'
                                    )}
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <div className="font-black uppercase text-foreground">{mode.label}</div>
                                            <div className="text-xs text-muted-foreground mt-1">{mode.desc}</div>
                                        </div>
                                        {deviceMode === mode.value && (
                                            <div className="bg-accent text-white rounded-full p-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 border-t border-border pt-6">
                            <button
                                className={cn(
                                    'w-full py-3 px-6 font-bold rounded-lg transition-colors',
                                    deviceMode === 'owner'
                                        ? 'bg-surface-3 text-muted-foreground cursor-not-allowed'
                                        : 'bg-accent text-white hover:opacity-90'
                                )}
                                disabled={deviceMode === 'owner'}
                                onClick={handleLock}
                            >
                                LOCK DEVICE TO {deviceMode.toUpperCase()}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Diagnostics Section */}
            <div className="settings-section">
                <h3 className="text-xl font-black uppercase mb-4 border-b border-border pb-2 text-foreground">Diagnostics & Reports</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    View sync status, error logs, and system health information.
                </p>
                <button
                    className="w-full py-3 px-6 bg-surface-3 text-foreground font-bold rounded-lg hover:bg-surface-2 transition-colors"
                    onClick={() => navigate('/diagnostics')}
                >
                    OPEN DIAGNOSTICS
                </button>
            </div>

            {/* Sync Section */}
            <div className="settings-section">
                <h3 className="text-xl font-black uppercase mb-4 border-b border-border pb-2 text-foreground">Device Sync</h3>
                <div className="space-y-4">
                    {/* Connection Status */}
                    <div className={cn(
                        'p-3 rounded-lg text-sm border-l-4',
                        connectionStatus === 'connected' ? 'bg-success/10 border-success' :
                        connectionStatus === 'connecting' ? 'bg-warning/10 border-warning' :
                        'bg-destructive/10 border-destructive'
                    )}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-muted-foreground">WebSocket:</span>
                            <span className={cn(
                                'font-bold uppercase',
                                connectionStatus === 'connected' ? 'text-success' :
                                connectionStatus === 'connecting' ? 'text-warning' :
                                'text-destructive'
                            )}>{connectionStatus}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Tenant ID:</span>
                            <span className={cn(
                                'font-mono text-xs',
                                effectiveTenantId ? 'text-foreground/70' : 'text-destructive font-bold'
                            )}>
                                {effectiveTenantId || 'NOT SET - Login required!'}
                            </span>
                        </div>
                    </div>

                    <div className="bg-surface-2 p-3 rounded-lg text-sm">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-muted-foreground">Current Mode:</span>
                            <span className="font-bold text-foreground">{deviceMode.toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-muted-foreground">Staff Members:</span>
                            <span className="font-bold text-foreground">{staff.length}</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-muted-foreground">Sections:</span>
                            <span className="font-bold text-foreground">{sections.length}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Tables:</span>
                            <span className="font-bold text-foreground">{tables.length}</span>
                        </div>
                    </div>

                    {syncStatus === 'syncing' && (
                        <div className="bg-info/10 border border-info/30 text-info p-3 rounded-lg text-center">
                            Syncing...
                        </div>
                    )}
                    {syncStatus === 'success' && (
                        <div className="bg-success/10 border border-success/30 text-success p-3 rounded-lg text-center">
                            Sync request sent!
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            className="w-full py-2 px-4 bg-surface-3 text-foreground font-bold rounded-lg hover:bg-surface-2 disabled:opacity-50 transition-colors"
                            onClick={handleRequestSync}
                            disabled={syncStatus === 'syncing'}
                        >
                            REQUEST SYNC
                        </button>
                        <button
                            className="w-full py-2 px-4 bg-accent text-white font-bold rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors"
                            onClick={handleBroadcastSync}
                            disabled={syncStatus === 'syncing'}
                        >
                            BROADCAST SYNC
                        </button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                        Request: Pull data from POS • Broadcast: Push data to other devices
                    </p>
                </div>
            </div>

            {/* LAN Discovery Section */}
            <div className="settings-section">
                <h3 className="text-xl font-black uppercase mb-4 border-b border-border pb-2 text-foreground">LAN Discovery</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Discover POS devices on your local network via mDNS.
                </p>

                {/* Current LAN Status */}
                <div className="space-y-3 mb-4">
                    {/* Server Status (if POS mode) */}
                    {lanServerStatus?.isRunning && (
                        <div className="bg-success/10 border border-success/30 p-3 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                                <span className="font-bold text-success text-sm">LAN Server Running</span>
                            </div>
                            <div className="text-xs space-y-1 text-foreground/80">
                                <div className="flex justify-between">
                                    <span>IP Address:</span>
                                    <span className="font-mono">{lanServerStatus.ipAddress || 'Unknown'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Port:</span>
                                    <span className="font-mono">{lanServerStatus.port}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>mDNS Registered:</span>
                                    <span className={lanServerStatus.mdnsRegistered ? 'text-success' : 'text-warning'}>
                                        {lanServerStatus.mdnsRegistered ? 'Yes' : 'No'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Connected Clients:</span>
                                    <span className="font-bold">{lanServerStatus.connectedClients.length}</span>
                                </div>
                            </div>
                            {lanServerStatus.connectedClients.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-success/20">
                                    <span className="text-xs text-muted-foreground">Clients:</span>
                                    <div className="space-y-1 mt-1">
                                        {lanServerStatus.connectedClients.map((client) => (
                                            <div key={client.clientId} className="flex justify-between text-xs bg-surface-2 p-1 rounded">
                                                <span className="font-mono">{client.ipAddress}</span>
                                                <span className="uppercase text-accent font-bold">{client.deviceType}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Client Status (if KDS/BDS/Manager mode) */}
                    {lanClientStatus?.isConnected && (
                        <div className="bg-info/10 border border-info/30 p-3 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-2 h-2 bg-info rounded-full animate-pulse" />
                                <span className="font-bold text-info text-sm">Connected to POS</span>
                            </div>
                            <div className="text-xs space-y-1 text-foreground/80">
                                <div className="flex justify-between">
                                    <span>Server Address:</span>
                                    <span className="font-mono">{lanClientStatus.serverAddress}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Device Type:</span>
                                    <span className="uppercase font-bold">{lanClientStatus.deviceType}</span>
                                </div>
                                {lanClientStatus.serverInfo && (
                                    <div className="flex justify-between">
                                        <span>Server Tenant:</span>
                                        <span className="font-mono text-xs">{lanClientStatus.serverInfo.tenantId}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Not connected state */}
                    {!lanServerStatus?.isRunning && !lanClientStatus?.isConnected && (
                        <div className="bg-surface-2 border border-border p-3 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-2 h-2 bg-muted-foreground rounded-full" />
                                <span className="font-bold text-muted-foreground text-sm">No LAN Connection</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Set device to POS mode to start a LAN server, or KDS/BDS mode to discover and connect to a POS.
                            </p>
                        </div>
                    )}
                </div>

                {/* Discovery Progress */}
                {isDiscovering && (
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-foreground">Scanning network...</span>
                            <span className="text-sm font-mono text-muted-foreground">{discoveryProgress}%</span>
                        </div>
                        <div className="w-full bg-surface-3 rounded-full h-2">
                            <div
                                className="bg-accent h-2 rounded-full transition-all duration-300"
                                style={{ width: `${discoveryProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Discovery Error */}
                {discoveryError && (
                    <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-lg text-sm mb-4">
                        {discoveryError}
                    </div>
                )}

                {/* Discovered Servers List */}
                {discoveredServers.length > 0 && (
                    <div className="mb-4">
                        <span className="text-sm font-bold text-foreground mb-2 block">
                            Found {discoveredServers.length} POS Device{discoveredServers.length > 1 ? 's' : ''}:
                        </span>
                        <div className="space-y-2">
                            {discoveredServers.map((server, index) => (
                                <div
                                    key={`${server.ipAddress}-${server.port}-${index}`}
                                    className="bg-success/10 border border-success/30 p-3 rounded-lg"
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-foreground">{server.name}</div>
                                            <div className="text-xs text-muted-foreground font-mono">
                                                {server.ipAddress}:{server.port}
                                            </div>
                                        </div>
                                        {server.tenantId && (
                                            <div className="text-xs bg-surface-2 px-2 py-1 rounded font-mono">
                                                {server.tenantId.substring(0, 8)}...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Discovery Button */}
                <button
                    className={cn(
                        'w-full py-3 px-6 font-bold rounded-lg transition-colors',
                        isDiscovering
                            ? 'bg-surface-3 text-muted-foreground cursor-not-allowed'
                            : 'bg-accent text-white hover:opacity-90'
                    )}
                    onClick={handleDiscoverServers}
                    disabled={isDiscovering}
                >
                    {isDiscovering ? 'SCANNING...' : 'SCAN FOR POS DEVICES'}
                </button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                    Uses mDNS to find POS devices on your local network (10 second scan)
                </p>
            </div>

            {/* Remote Print Settings - For any device that needs to print via POS */}
            <RemotePrintSettings />

            {/* Data Cleanup Section */}
            <div className="settings-section">
                <h3 className="text-xl font-black uppercase mb-4 border-b border-border pb-2 text-foreground">Data Cleanup</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Clear orphaned orders and table sessions during testing.
                </p>

                <div className="bg-surface-2 p-3 rounded-lg text-sm mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-muted-foreground">Active Table Sessions:</span>
                        <span className={cn('font-bold', activeTableCount > 0 ? 'text-warning' : 'text-success')}>
                            {activeTableCount}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">KDS Orders (Active + Completed):</span>
                        <span className={cn('font-bold', kdsOrderCount > 0 ? 'text-warning' : 'text-success')}>
                            {kdsOrderCount}
                        </span>
                    </div>
                </div>

                {cleanupStatus === 'cleaning' && (
                    <div className="bg-info/10 border border-info/30 text-info p-3 rounded-lg text-center mb-4">
                        Cleaning up...
                    </div>
                )}
                {cleanupStatus === 'success' && (
                    <div className="bg-success/10 border border-success/30 text-success p-3 rounded-lg text-center mb-4">
                        Cleanup complete!
                    </div>
                )}
                {cleanupStatus === 'error' && (
                    <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-lg text-center mb-4">
                        Cleanup failed. Check console for details.
                    </div>
                )}

                <button
                    className={cn(
                        'w-full py-3 px-6 font-bold rounded-lg transition-colors',
                        cleanupStatus === 'cleaning' || (activeTableCount === 0 && kdsOrderCount === 0)
                            ? 'bg-surface-3 text-muted-foreground cursor-not-allowed'
                            : 'bg-destructive text-white hover:opacity-90'
                    )}
                    onClick={handleCleanup}
                    disabled={cleanupStatus === 'cleaning' || (activeTableCount === 0 && kdsOrderCount === 0)}
                >
                    CLEAR ALL ORDERS & TABLE SESSIONS
                </button>
                <p className="text-xs text-destructive text-center mt-2">
                    Warning: This will permanently delete all active orders and table data.
                </p>
            </div>

        </div>
    );
};
