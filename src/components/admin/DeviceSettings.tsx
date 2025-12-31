import { useState, useRef } from 'react';
import { useDeviceStore, DeviceMode } from '../../stores/deviceStore';
import { useStaffStore } from '../../stores/staffStore';
import { useFloorPlanStore } from '../../stores/floorPlanStore';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { usePOSStore } from '../../stores/posStore';
import { useKDSStore } from '../../stores/kdsStore';
import { useAggregatorStore } from '../../stores/aggregatorStore';
import { orderSyncService } from '../../lib/orderSyncService';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';
import { IndustrialCard } from '../ui-industrial/IndustrialCard';
import { useNavigate } from 'react-router-dom';
import { AggregatorOrder, AggregatorSource } from '../../types/aggregator';

const ADMIN_PASSWORD = '6163';
const REQUIRED_CLICKS = 7;
const CLICK_TIMEOUT = 3000; // Reset counter after 3 seconds of no clicks

// Coorg Food Company menu items for mock orders
const COORG_MENU_ITEMS = [
    // Appetizers
    { name: 'Pandi Fry (Pork)', price: 390, category: 'APPETIZERS' },
    { name: 'Chicken Cutlets', price: 340, category: 'APPETIZERS' },
    { name: 'Chilli Chicken', price: 295, category: 'APPETIZERS' },
    { name: 'Bale Kai Fry (V)', price: 230, category: 'APPETIZERS' },
    { name: 'Crispy Bhendi Fry (V)', price: 235, category: 'APPETIZERS' },
    // Curries
    { name: 'Koli Curry (Chicken)', price: 390, category: 'CURRIES' },
    { name: 'Pandi Curry (Pork)', price: 510, category: 'CURRIES' },
    { name: 'Erachi Curry (Mutton)', price: 510, category: 'CURRIES' },
    { name: 'Kadle Curry (V)', price: 210, category: 'CURRIES' },
    // Rice & Ottis
    { name: 'Akki Otti (2pcs)', price: 80, category: 'RICE' },
    { name: 'Kadambuttu', price: 120, category: 'RICE' },
    { name: 'Neer Dosa', price: 120, category: 'RICE' },
    { name: 'Chicken Pulav', price: 290, category: 'RICE' },
    // Coolers
    { name: 'Buttermilk', price: 150, category: 'COOLERS' },
    { name: 'Kokum Juice', price: 150, category: 'COOLERS' },
    { name: 'Coke', price: 90, category: 'COOLERS' },
];

// Mock order generator with Coorg Food Company menu
function generateMockAggregatorOrder(aggregator: AggregatorSource): AggregatorOrder {
    const orderNum = Math.floor(Math.random() * 9000) + 1000;
    const orderId = `${aggregator}_${Date.now()}_${orderNum}`;

    // Select random items for a realistic order
    const selectedItems = [];

    // Pick 1-2 appetizers/curries
    const mainItems = COORG_MENU_ITEMS.filter(i => i.category === 'APPETIZERS' || i.category === 'CURRIES');
    const mainCount = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < mainCount; i++) {
        const item = mainItems[Math.floor(Math.random() * mainItems.length)];
        selectedItems.push({ ...item, quantity: Math.floor(Math.random() * 2) + 1 });
    }

    // Pick 1-2 rice items
    const riceItems = COORG_MENU_ITEMS.filter(i => i.category === 'RICE');
    const riceCount = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < riceCount; i++) {
        const item = riceItems[Math.floor(Math.random() * riceItems.length)];
        selectedItems.push({ ...item, quantity: Math.floor(Math.random() * 2) + 1 });
    }

    // Optionally add a drink
    if (Math.random() > 0.5) {
        const drinks = COORG_MENU_ITEMS.filter(i => i.category === 'COOLERS');
        const drink = drinks[Math.floor(Math.random() * drinks.length)];
        selectedItems.push({ ...drink, quantity: 1 });
    }

    const subtotal = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = Math.round(subtotal * 0.05);
    const deliveryFee = aggregator === 'swiggy' ? 40 : 35;
    const platformFee = aggregator === 'swiggy' ? 5 : 3;

    return {
        aggregator,
        aggregatorOrderId: `${aggregator.toUpperCase()}-${orderNum}`,
        aggregatorStatus: 'NEW',
        orderId,
        orderNumber: `#${orderNum}`,
        status: 'pending',
        orderType: 'delivery',
        createdAt: new Date().toISOString(),
        customer: {
            name: aggregator === 'swiggy' ? 'Swiggy Test Customer' : 'Zomato Test Customer',
            phone: '+91 98765 43210',
            address: '42, 1st Cross, HRBR Layout, Kalyan Nagar, Bengaluru, Karnataka 560043',
        },
        cart: {
            items: selectedItems.map((item, idx) => ({
                id: `item-${idx}`,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                total: item.price * item.quantity,
                variants: [],
                addons: [],
            })),
            subtotal,
            tax,
            deliveryFee,
            platformFee,
            discount: 0,
            total: subtotal + tax + deliveryFee + platformFee,
        },
        payment: {
            method: 'online',
            status: 'paid',
            isPrepaid: true,
        },
        specialInstructions: 'Test order - please ignore',
    };
}

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
    const [testOrderStatus, setTestOrderStatus] = useState<'idle' | 'creating' | 'success' | 'error'>('idle');
    const [lastTestOrder, setLastTestOrder] = useState<string | null>(null);

    // Get aggregator store actions
    const { addOrder: addAggregatorOrder, acceptOrder: acceptAggregatorOrder } = useAggregatorStore();

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

    const modes: { value: DeviceMode; label: string; desc: string }[] = [
        { value: 'generic', label: 'Generic / Full Access', desc: 'Default mode. Full dashboard access (Standard login required).' },
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
        alert("Device Unlocked. Returning to Generic mode.");
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

    // Generate and process a test aggregator order
    const handleGenerateTestOrder = async (aggregator: AggregatorSource, autoAccept: boolean = false) => {
        setTestOrderStatus('creating');
        console.log(`[DeviceSettings] Generating test ${aggregator} order...`);

        try {
            const mockOrder = generateMockAggregatorOrder(aggregator);

            // Add order to aggregator store (this will persist to local DB and trigger notifications)
            addAggregatorOrder(mockOrder);
            console.log(`[DeviceSettings] Added test order: ${mockOrder.orderNumber}`);

            if (autoAccept) {
                // Wait a bit for the order to be added, then accept it
                setTimeout(async () => {
                    console.log(`[DeviceSettings] Auto-accepting test order: ${mockOrder.orderId}`);
                    await acceptAggregatorOrder(mockOrder.orderId, 15);
                    console.log(`[DeviceSettings] Test order accepted and sent to KDS`);
                }, 500);
            }

            setLastTestOrder(`${aggregator.toUpperCase()} ${mockOrder.orderNumber}`);
            setTestOrderStatus('success');
            setTimeout(() => setTestOrderStatus('idle'), 3000);
        } catch (error) {
            console.error('[DeviceSettings] Test order generation failed:', error);
            setTestOrderStatus('error');
            setTimeout(() => setTestOrderStatus('idle'), 3000);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto relative">
            {/* Hidden admin access button - invisible in top-right corner */}
            <div
                onClick={handleHiddenClick}
                className="absolute top-0 right-0 w-12 h-12 cursor-default z-10"
                aria-hidden="true"
            />

            {/* Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-80 shadow-2xl">
                        <h3 className="text-lg font-bold mb-4 text-center">Admin Access</h3>
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
                            className={`w-full p-3 border-2 rounded-lg text-center text-2xl tracking-widest mb-4 ${
                                passwordError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                            }`}
                            autoFocus
                            maxLength={6}
                        />
                        {passwordError && (
                            <p className="text-red-500 text-sm text-center mb-4">Incorrect PIN</p>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={handlePasswordCancel}
                                className="flex-1 py-2 px-4 border-2 border-gray-300 rounded-lg font-bold hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePasswordSubmit}
                                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <IndustrialCard variant="raised" className="bg-white p-6">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 className="text-xl font-black uppercase">Operational Mode</h3>
                    {isAdminMode && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-bold">
                            ADMIN
                        </span>
                    )}
                </div>

                {!isAdminMode ? (
                    <div className="bg-gray-100 border-l-4 border-gray-400 p-4">
                        <p className="text-gray-600 text-sm">
                            Device mode changes are restricted. Contact your administrator.
                        </p>
                        <p className="text-gray-500 text-xs mt-2">
                            Current Mode: <span className="font-bold">{deviceMode.toUpperCase()}</span>
                            {isLocked && <span className="ml-2 text-orange-600">(LOCKED)</span>}
                        </p>
                    </div>
                ) : isLocked ? (
                    <div className="bg-orange-100 border-l-4 border-orange-500 p-4 mb-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-bold text-orange-900 uppercase">Device is LOCKED</p>
                                <p className="text-sm text-orange-800">Current Mode: <span className="font-black underline">{deviceMode.toUpperCase()}</span></p>
                            </div>
                            <IndustrialButton size="sm" variant="danger" onClick={handleUnlock}>
                                UNLOCK DEVICE
                            </IndustrialButton>
                        </div>
                    </div>
                ) : (
                    <div className="mb-6">
                        <p className="text-sm text-gray-500 mb-4 italic">
                            Configure this tablet or computer for a specific purpose.
                        </p>
                        <div className="space-y-3">
                            {modes.map(mode => (
                                <div
                                    key={mode.value}
                                    onClick={() => setDeviceMode(mode.value)}
                                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${deviceMode === mode.value
                                            ? 'border-blue-600 bg-blue-50 shadow-md ring-2 ring-blue-200'
                                            : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <div className="font-black uppercase text-slate-800">{mode.label}</div>
                                            <div className="text-xs text-slate-500 mt-1">{mode.desc}</div>
                                        </div>
                                        {deviceMode === mode.value && (
                                            <div className="bg-blue-600 text-white rounded-full p-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 border-t pt-6">
                            <IndustrialButton
                                fullWidth
                                variant="primary"
                                size="lg"
                                disabled={deviceMode === 'generic'}
                                onClick={handleLock}
                            >
                                LOCK DEVICE TO {deviceMode.toUpperCase()}
                            </IndustrialButton>
                        </div>
                    </div>
                )}
            </IndustrialCard>

            {/* Diagnostics Section */}
            <IndustrialCard variant="raised" className="bg-white p-6">
                <h3 className="text-xl font-black uppercase mb-4 border-b pb-2">Diagnostics & Reports</h3>
                <p className="text-sm text-gray-500 mb-4">
                    View sync status, error logs, and system health information.
                </p>
                <IndustrialButton
                    fullWidth
                    variant="secondary"
                    size="lg"
                    onClick={() => navigate('/diagnostics')}
                >
                    OPEN DIAGNOSTICS
                </IndustrialButton>
            </IndustrialCard>

            {/* Sync Section */}
            <IndustrialCard variant="raised" className="bg-white p-6">
                <h3 className="text-xl font-black uppercase mb-4 border-b pb-2">Device Sync</h3>
                <div className="space-y-4">
                    {/* Connection Status */}
                    <div className={`p-3 rounded-lg text-sm border-l-4 ${
                        connectionStatus === 'connected' ? 'bg-green-50 border-green-500' :
                        connectionStatus === 'connecting' ? 'bg-yellow-50 border-yellow-500' :
                        'bg-red-50 border-red-500'
                    }`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-600">WebSocket:</span>
                            <span className={`font-bold uppercase ${
                                connectionStatus === 'connected' ? 'text-green-700' :
                                connectionStatus === 'connecting' ? 'text-yellow-700' :
                                'text-red-700'
                            }`}>{connectionStatus}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600">Tenant ID:</span>
                            <span className={`font-mono text-xs ${effectiveTenantId ? 'text-gray-700' : 'text-red-600 font-bold'}`}>
                                {effectiveTenantId || 'NOT SET - Login required!'}
                            </span>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg text-sm">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-600">Current Mode:</span>
                            <span className="font-bold">{deviceMode.toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-600">Staff Members:</span>
                            <span className="font-bold">{staff.length}</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-600">Sections:</span>
                            <span className="font-bold">{sections.length}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600">Tables:</span>
                            <span className="font-bold">{tables.length}</span>
                        </div>
                    </div>

                    {syncStatus === 'syncing' && (
                        <div className="bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded-lg text-center">
                            Syncing...
                        </div>
                    )}
                    {syncStatus === 'success' && (
                        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-center">
                            Sync request sent!
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <IndustrialButton
                            fullWidth
                            variant="secondary"
                            onClick={handleRequestSync}
                            disabled={syncStatus === 'syncing'}
                        >
                            REQUEST SYNC
                        </IndustrialButton>
                        <IndustrialButton
                            fullWidth
                            variant="primary"
                            onClick={handleBroadcastSync}
                            disabled={syncStatus === 'syncing'}
                        >
                            BROADCAST SYNC
                        </IndustrialButton>
                    </div>
                    <p className="text-xs text-gray-500 text-center">
                        Request: Pull data from POS • Broadcast: Push data to other devices
                    </p>
                </div>
            </IndustrialCard>

            {/* Data Cleanup Section */}
            <IndustrialCard variant="raised" className="bg-white p-6">
                <h3 className="text-xl font-black uppercase mb-4 border-b pb-2">Data Cleanup</h3>
                <p className="text-sm text-gray-500 mb-4">
                    Clear orphaned orders and table sessions during testing.
                </p>

                <div className="bg-gray-50 p-3 rounded-lg text-sm mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600">Active Table Sessions:</span>
                        <span className={`font-bold ${activeTableCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                            {activeTableCount}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-600">KDS Orders (Active + Completed):</span>
                        <span className={`font-bold ${kdsOrderCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                            {kdsOrderCount}
                        </span>
                    </div>
                </div>

                {cleanupStatus === 'cleaning' && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded-lg text-center mb-4">
                        Cleaning up...
                    </div>
                )}
                {cleanupStatus === 'success' && (
                    <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-center mb-4">
                        Cleanup complete!
                    </div>
                )}
                {cleanupStatus === 'error' && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-center mb-4">
                        Cleanup failed. Check console for details.
                    </div>
                )}

                <IndustrialButton
                    fullWidth
                    variant="danger"
                    size="lg"
                    onClick={handleCleanup}
                    disabled={cleanupStatus === 'cleaning' || (activeTableCount === 0 && kdsOrderCount === 0)}
                >
                    CLEAR ALL ORDERS & TABLE SESSIONS
                </IndustrialButton>
                <p className="text-xs text-red-500 text-center mt-2">
                    Warning: This will permanently delete all active orders and table data.
                </p>
            </IndustrialCard>

            {/* Test Aggregator Orders Section */}
            <IndustrialCard variant="raised" className="bg-white p-6">
                <h3 className="text-xl font-black uppercase mb-4 border-b pb-2">Test Aggregator Orders</h3>
                <p className="text-sm text-gray-500 mb-4">
                    Generate mock Swiggy/Zomato orders to test KDS and billing flow.
                </p>

                {testOrderStatus === 'creating' && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded-lg text-center mb-4">
                        Creating test order...
                    </div>
                )}
                {testOrderStatus === 'success' && lastTestOrder && (
                    <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-center mb-4">
                        Created: {lastTestOrder}
                    </div>
                )}
                {testOrderStatus === 'error' && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-center mb-4">
                        Failed to create test order. Check console.
                    </div>
                )}

                <div className="space-y-4">
                    {/* Just create order (pending) */}
                    <div>
                        <p className="text-xs text-gray-500 mb-2 font-medium">Create Pending Order (manual accept required):</p>
                        <div className="grid grid-cols-2 gap-3">
                            <IndustrialButton
                                fullWidth
                                variant="secondary"
                                onClick={() => handleGenerateTestOrder('swiggy', false)}
                                disabled={testOrderStatus === 'creating'}
                                className="!bg-orange-100 !border-orange-300 hover:!bg-orange-200"
                            >
                                <span className="text-orange-700">SWIGGY ORDER</span>
                            </IndustrialButton>
                            <IndustrialButton
                                fullWidth
                                variant="secondary"
                                onClick={() => handleGenerateTestOrder('zomato', false)}
                                disabled={testOrderStatus === 'creating'}
                                className="!bg-red-100 !border-red-300 hover:!bg-red-200"
                            >
                                <span className="text-red-700">ZOMATO ORDER</span>
                            </IndustrialButton>
                        </div>
                    </div>

                    {/* Create and auto-accept (sends to KDS) */}
                    <div>
                        <p className="text-xs text-gray-500 mb-2 font-medium">Create & Auto-Accept (sends to KDS immediately):</p>
                        <div className="grid grid-cols-2 gap-3">
                            <IndustrialButton
                                fullWidth
                                variant="primary"
                                onClick={() => handleGenerateTestOrder('swiggy', true)}
                                disabled={testOrderStatus === 'creating'}
                                className="!bg-orange-500 hover:!bg-orange-600"
                            >
                                SWIGGY + KDS
                            </IndustrialButton>
                            <IndustrialButton
                                fullWidth
                                variant="primary"
                                onClick={() => handleGenerateTestOrder('zomato', true)}
                                disabled={testOrderStatus === 'creating'}
                                className="!bg-red-500 hover:!bg-red-600"
                            >
                                ZOMATO + KDS
                            </IndustrialButton>
                        </div>
                    </div>
                </div>

                <p className="text-xs text-gray-500 text-center mt-4">
                    Orders use Coorg Food Company menu (Pandi Curry, Koli Curry, Akki Otti, etc.)
                </p>
            </IndustrialCard>
        </div>
    );
};
