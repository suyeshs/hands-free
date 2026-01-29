/**
 * Device Management Panel
 * List, monitor, and manage POS devices for the restaurant
 */

import { useEffect, useState } from 'react';
import { usePOSDeviceStore, type POSDevice } from '../../stores/posDeviceStore';
import { useTenantStore } from '../../stores/tenantStore';
import { useAuthStore } from '../../stores/authStore';
import {
  Smartphone,
  Circle,
  Ban,
  RotateCw,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Wifi,
  WifiOff,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

export function DeviceManagementPanel() {
  const { tenant } = useTenantStore();
  const { user } = useAuthStore();
  const {
    devices,
    isLoading,
    error,
    fetchDevices,
    suspendDevice,
    revokeDevice,
    reactivateDevice,
    updateDeviceName,
  } = usePOSDeviceStore();

  const [selectedDevice, setSelectedDevice] = useState<POSDevice | null>(null);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const [newName, setNewName] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (tenant?.tenantId) {
      fetchDevices(tenant.tenantId);
    }
  }, [tenant?.tenantId, fetchDevices]);

  const handleSuspend = async () => {
    if (!selectedDevice || !tenant || !user) return;

    if (!suspendReason.trim()) {
      toast.error('Please provide a reason for suspending');
      return;
    }

    setActionLoading(true);
    try {
      await suspendDevice(tenant.tenantId, selectedDevice.deviceId, suspendReason, user.id);
      toast.success(`Device ${selectedDevice.deviceName || selectedDevice.deviceId} suspended`);
      setShowSuspendDialog(false);
      setSuspendReason('');
      setSelectedDevice(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to suspend device');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!selectedDevice || !tenant || !user) return;

    if (!revokeReason.trim()) {
      toast.error('Please provide a reason for revoking');
      return;
    }

    setActionLoading(true);
    try {
      await revokeDevice(tenant.tenantId, selectedDevice.deviceId, revokeReason, user.id);
      toast.success(`Device ${selectedDevice.deviceName || selectedDevice.deviceId} revoked permanently`);
      setShowRevokeDialog(false);
      setRevokeReason('');
      setSelectedDevice(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to revoke device');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async (device: POSDevice) => {
    if (!tenant || !user) return;

    setActionLoading(true);
    try {
      await reactivateDevice(tenant.tenantId, device.deviceId, user.id);
      toast.success(`Device ${device.deviceName || device.deviceId} reactivated`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reactivate device');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRename = async () => {
    if (!selectedDevice || !tenant) return;

    if (!newName.trim()) {
      toast.error('Please enter a device name');
      return;
    }

    setActionLoading(true);
    try {
      await updateDeviceName(tenant.tenantId, selectedDevice.deviceId, newName);
      toast.success('Device name updated');
      setShowRenameDialog(false);
      setNewName('');
      setSelectedDevice(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update device name');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: POSDevice['status']) => {
    const styles = {
      active: 'bg-green-500/20 text-green-300 border-green-500/30',
      suspended: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      revoked: 'bg-red-500/20 text-red-300 border-red-500/30',
    };

    const icons = {
      active: <CheckCircle2 className="w-3 h-3" />,
      suspended: <AlertCircle className="w-3 h-3" />,
      revoked: <Ban className="w-3 h-3" />,
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getOnlineStatus = (lastSeenAt: string | null) => {
    if (!lastSeenAt) return { online: false, text: 'Never seen' };

    const now = new Date().getTime();
    const lastSeen = new Date(lastSeenAt).getTime();
    const diffMinutes = (now - lastSeen) / 1000 / 60;

    if (diffMinutes < 5) {
      return { online: true, text: 'Online' };
    } else if (diffMinutes < 60) {
      return { online: false, text: `${Math.floor(diffMinutes)}m ago` };
    } else if (diffMinutes < 1440) {
      return { online: false, text: `${Math.floor(diffMinutes / 60)}h ago` };
    } else {
      return { online: false, text: `${Math.floor(diffMinutes / 1440)}d ago` };
    }
  };

  if (error) {
    return (
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Device Management</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor and manage all POS devices connected to your restaurant
            </p>
          </div>
          <button
            onClick={() => tenant && fetchDevices(tenant.tenantId)}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground hover:bg-accent/80 transition-colors disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Devices Grid */}
      {isLoading && devices.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading devices...</p>
        </div>
      ) : devices.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center">
          <Smartphone className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Devices Registered</h3>
          <p className="text-sm text-muted-foreground">
            Devices will appear here once they activate with the restaurant
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((device) => {
            const onlineStatus = getOnlineStatus(device.lastSeenAt);

            return (
              <div key={device.id} className="glass-panel p-6 rounded-2xl">
                {/* Device Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-accent/20 flex items-center justify-center">
                      <Smartphone className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {device.deviceName || 'Unnamed Device'}
                      </h3>
                      <p className="text-xs text-muted-foreground font-mono">
                        {device.deviceId.substring(0, 20)}...
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(device.status)}
                </div>

                {/* Online Status */}
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
                  {onlineStatus.online ? (
                    <Wifi className="w-4 h-4 text-green-400" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className={`text-sm ${onlineStatus.online ? 'text-green-400' : 'text-muted-foreground'}`}>
                    {onlineStatus.text}
                  </span>
                </div>

                {/* Device Info */}
                <div className="space-y-2 text-sm mb-4">
                  {device.hardwareInfo && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Circle className="w-3 h-3" />
                      <span>
                        {device.hardwareInfo.model || 'Unknown Model'}
                        {device.hardwareInfo.os && ` • ${device.hardwareInfo.os}`}
                      </span>
                    </div>
                  )}
                  {device.ipAddress && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Circle className="w-3 h-3" />
                      <span>IP: {device.ipAddress}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>Registered {new Date(device.registeredAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {device.status === 'active' && (
                    <>
                      <button
                        onClick={() => {
                          setSelectedDevice(device);
                          setNewName(device.deviceName || '');
                          setShowRenameDialog(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors text-sm"
                      >
                        <Edit2 className="w-3 h-3" />
                        Rename
                      </button>
                      <button
                        onClick={() => {
                          setSelectedDevice(device);
                          setShowSuspendDialog(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition-colors text-sm"
                      >
                        <Ban className="w-3 h-3" />
                        Suspend
                      </button>
                      <button
                        onClick={() => {
                          setSelectedDevice(device);
                          setShowRevokeDialog(true);
                        }}
                        className="px-3 py-2 bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                        title="Revoke permanently"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                  {device.status === 'suspended' && (
                    <>
                      <button
                        onClick={() => handleReactivate(device)}
                        disabled={actionLoading}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-colors text-sm disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Reactivate
                      </button>
                      <button
                        onClick={() => {
                          setSelectedDevice(device);
                          setShowRevokeDialog(true);
                        }}
                        className="px-3 py-2 bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                        title="Revoke permanently"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                  {device.status === 'revoked' && (
                    <div className="flex-1 text-center text-sm text-muted-foreground py-2">
                      Permanently revoked
                    </div>
                  )}
                </div>

                {/* Suspension/Revocation Info */}
                {device.status === 'suspended' && device.suspensionReason && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold">Reason:</span> {device.suspensionReason}
                    </p>
                  </div>
                )}
                {device.status === 'revoked' && device.revocationReason && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold">Reason:</span> {device.revocationReason}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Suspend Dialog */}
      {showSuspendDialog && selectedDevice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-md w-full">
            <h3 className="text-lg font-semibold text-foreground mb-4">Suspend Device</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Suspending <span className="font-semibold">{selectedDevice.deviceName || selectedDevice.deviceId}</span> will temporarily block it from accessing the system. You can reactivate it later.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                Reason for suspension *
              </label>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                className="w-full px-3 py-2 bg-background/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                rows={3}
                placeholder="e.g., Device lost, security breach, etc."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSuspendDialog(false);
                  setSuspendReason('');
                  setSelectedDevice(null);
                }}
                className="flex-1 px-4 py-2 bg-background/50 text-foreground hover:bg-background/70 transition-colors"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleSuspend}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-yellow-500 text-white hover:bg-yellow-600 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Suspending...' : 'Suspend Device'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Dialog */}
      {showRevokeDialog && selectedDevice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-md w-full">
            <h3 className="text-lg font-semibold text-red-400 mb-4">Revoke Device Permanently</h3>
            <p className="text-sm text-muted-foreground mb-4">
              <strong>Warning:</strong> Revoking <span className="font-semibold">{selectedDevice.deviceName || selectedDevice.deviceId}</span> is <strong>permanent and cannot be undone</strong>. The device will be completely blocked from the system.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                Reason for revocation *
              </label>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                className="w-full px-3 py-2 bg-background/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={3}
                placeholder="e.g., Stolen device, security compromise, etc."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRevokeDialog(false);
                  setRevokeReason('');
                  setSelectedDevice(null);
                }}
                className="flex-1 px-4 py-2 bg-background/50 text-foreground hover:bg-background/70 transition-colors"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Revoking...' : 'Revoke Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Dialog */}
      {showRenameDialog && selectedDevice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-md w-full">
            <h3 className="text-lg font-semibold text-foreground mb-4">Rename Device</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                Device Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 bg-background/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="e.g., Front Counter iPad"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRenameDialog(false);
                  setNewName('');
                  setSelectedDevice(null);
                }}
                className="flex-1 px-4 py-2 bg-background/50 text-foreground hover:bg-background/70 transition-colors"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-accent text-accent-foreground hover:bg-accent/80 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Updating...' : 'Update Name'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
