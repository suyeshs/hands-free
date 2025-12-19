import { useDeviceStore, DeviceMode } from '../../stores/deviceStore';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';
import { IndustrialCard } from '../ui-industrial/IndustrialCard';

export const DeviceSettings = () => {
    const { deviceMode, isLocked, setDeviceMode, setLocked } = useDeviceStore();

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

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <IndustrialCard variant="raised" className="bg-white p-6">
                <h3 className="text-xl font-black uppercase mb-4 border-b pb-2">Operational Mode</h3>

                {isLocked ? (
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
        </div>
    );
};
