/**
 * LAN Devices Panel
 * Modern UI for discovering and managing LAN-connected POS devices
 * Shows all devices in the network with connection status
 */

import { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  MonitorSmartphone,
  Server,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Monitor,
  ChefHat,
  Package,
  Users,
} from 'lucide-react';
import {
  discoverLanServers,
  getLanServerStatus,
  getLanClientStatus,
  connectLanServer,
  disconnectLanServer,
  type DiscoveredServer,
  type LanServerStatus,
  type LanClientStatus,
  type DeviceType,
  type ClientInfo,
} from '../../lib/lanSyncService';
import { cn } from '../../lib/utils';
import { isTauri } from '../../lib/platform';

interface LANDevicesPanelProps {
  tenantId: string | undefined;
  onConnect?: (serverAddress: string) => void;
  onDisconnect?: () => void;
}

const deviceIcons: Record<DeviceType, typeof Monitor> = {
  pos: MonitorSmartphone,
  kds: ChefHat,
  bds: Package,
  manager: Users,
};

const deviceColors: Record<DeviceType, string> = {
  pos: 'text-blue-500',
  kds: 'text-orange-500',
  bds: 'text-purple-500',
  manager: 'text-green-500',
};

export function LANDevicesPanel({ tenantId, onConnect, onDisconnect }: LANDevicesPanelProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredServers, setDiscoveredServers] = useState<DiscoveredServer[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);

  const [serverStatus, setServerStatus] = useState<LanServerStatus | null>(null);
  const [clientStatus, setClientStatus] = useState<LanClientStatus | null>(null);

  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Check if running in Tauri
  const isTauriApp = isTauri();

  // Fetch LAN status periodically
  useEffect(() => {
    if (!isTauriApp) return;

    const fetchStatus = async () => {
      try {
        const [server, client] = await Promise.all([
          getLanServerStatus(),
          getLanClientStatus(),
        ]);
        setServerStatus(server);
        setClientStatus(client);
      } catch (error) {
        console.log('[LANDevicesPanel] Status fetch error:', error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [isTauriApp]);

  // Handle network scan
  const handleScan = async () => {
    if (!isTauriApp) {
      setScanError('LAN discovery is only available in desktop mode');
      return;
    }

    setIsScanning(true);
    setScanError(null);
    setDiscoveredServers([]);
    setScanProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setScanProgress((prev) => Math.min(prev + 10, 90));
    }, 500);

    try {
      const servers = await discoverLanServers(tenantId, 10);
      setDiscoveredServers(servers);
      setScanProgress(100);

      if (servers.length === 0) {
        setScanError('No POS devices found on the network');
      }
    } catch (error) {
      console.error('[LANDevicesPanel] Scan failed:', error);
      setScanError(error instanceof Error ? error.message : 'Network scan failed');
    } finally {
      clearInterval(progressInterval);
      setIsScanning(false);
      setTimeout(() => setScanProgress(0), 2000);
    }
  };

  // Handle connect to server
  const handleConnect = async (server: DiscoveredServer) => {
    if (!isTauriApp || !tenantId) return;

    const serverAddress = `${server.ipAddress}:${server.port}`;
    setConnecting(serverAddress);

    try {
      await connectLanServer(serverAddress, 'kds', tenantId);
      onConnect?.(serverAddress);

      // Refresh status
      const client = await getLanClientStatus();
      setClientStatus(client);
    } catch (error) {
      console.error('[LANDevicesPanel] Connect failed:', error);
      setScanError(error instanceof Error ? error.message : 'Connection failed');
    } finally {
      setConnecting(null);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    if (!isTauriApp) return;

    setDisconnecting(true);
    try {
      await disconnectLanServer();
      onDisconnect?.();

      // Refresh status
      const client = await getLanClientStatus();
      setClientStatus(client);
    } catch (error) {
      console.error('[LANDevicesPanel] Disconnect failed:', error);
    } finally {
      setDisconnecting(false);
    }
  };

  if (!isTauriApp) {
    return (
      <div className="bg-surface-2 border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <WifiOff size={24} />
          <p className="text-sm">LAN discovery is only available in desktop mode</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Status Card */}
      <div className="bg-gradient-to-br from-surface-1 to-surface-2 rounded-2xl border border-border overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={cn(
              "p-3 rounded-xl",
              serverStatus?.isRunning || clientStatus?.isConnected
                ? "bg-green-500/10"
                : "bg-muted/10"
            )}>
              {serverStatus?.isRunning || clientStatus?.isConnected ? (
                <Wifi className="text-green-500" size={24} />
              ) : (
                <WifiOff className="text-muted-foreground" size={24} />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground text-lg">Network Status</h3>
              <p className="text-sm text-muted-foreground">
                {serverStatus?.isRunning
                  ? 'Running as POS Server'
                  : clientStatus?.isConnected
                  ? 'Connected to POS'
                  : 'Not connected'}
              </p>
            </div>
          </div>

          {/* Server Mode Status */}
          {serverStatus?.isRunning && (
            <div className="bg-surface-2/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="font-bold text-green-500 text-sm">Server Active</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground block">IP Address</span>
                  <span className="font-mono text-foreground font-bold">
                    {serverStatus.ipAddress || 'Unknown'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Port</span>
                  <span className="font-mono text-foreground font-bold">{serverStatus.port}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">mDNS</span>
                  <span className={cn(
                    "font-bold",
                    serverStatus.mdnsRegistered ? "text-green-500" : "text-orange-500"
                  )}>
                    {serverStatus.mdnsRegistered ? 'Registered' : 'Not Registered'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Clients</span>
                  <span className="font-bold text-foreground">
                    {serverStatus.connectedClients.length}
                  </span>
                </div>
              </div>

              {/* Connected Clients */}
              {serverStatus.connectedClients.length > 0 && (
                <div className="pt-3 border-t border-border/50">
                  <span className="text-xs text-muted-foreground block mb-2">Connected Devices</span>
                  <div className="grid gap-2">
                    {serverStatus.connectedClients.map((client: ClientInfo) => {
                      const Icon = deviceIcons[client.deviceType];
                      const colorClass = deviceColors[client.deviceType];

                      return (
                        <div
                          key={client.clientId}
                          className="flex items-center gap-3 bg-surface-3 rounded-lg p-3"
                        >
                          <Icon className={cn(colorClass)} size={20} />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-foreground text-sm uppercase">
                              {client.deviceType}
                            </div>
                            <div className="font-mono text-xs text-muted-foreground truncate">
                              {client.ipAddress}
                            </div>
                          </div>
                          <CheckCircle2 className="text-green-500 flex-shrink-0" size={16} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Client Mode Status */}
          {clientStatus?.isConnected && (
            <div className="bg-blue-500/10 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="font-bold text-blue-500 text-sm">Connected to Server</span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Server</span>
                  <span className="font-mono text-foreground font-bold">
                    {clientStatus.serverAddress}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Device Type</span>
                  <span className="font-bold text-foreground uppercase">
                    {clientStatus.deviceType}
                  </span>
                </div>
                {clientStatus.serverInfo && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tenant</span>
                    <span className="font-mono text-xs text-foreground">
                      {clientStatus.serverInfo.tenantId.substring(0, 12)}...
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="w-full py-2 px-4 bg-destructive/10 hover:bg-destructive/20 text-destructive font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Scan Controls */}
      <div className="space-y-4">
        <button
          onClick={handleScan}
          disabled={isScanning}
          className={cn(
            "w-full py-4 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-3",
            isScanning
              ? "bg-surface-3 text-muted-foreground cursor-not-allowed"
              : "bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 text-white shadow-lg hover:shadow-xl"
          )}
        >
          <RefreshCw className={cn(isScanning && "animate-spin")} size={20} />
          {isScanning ? 'Scanning Network...' : 'Scan for Devices'}
        </button>

        {/* Scan Progress */}
        {isScanning && scanProgress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discovering devices...</span>
              <span className="font-mono text-foreground font-bold">{scanProgress}%</span>
            </div>
            <div className="w-full bg-surface-3 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-accent to-accent/80 h-full transition-all duration-300 rounded-full"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Scan Error */}
        {scanError && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="text-destructive flex-shrink-0" size={20} />
            <div className="flex-1">
              <p className="text-sm font-bold text-destructive mb-1">Scan Failed</p>
              <p className="text-xs text-destructive/80">{scanError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Discovered Devices */}
      {discoveredServers.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-bold text-foreground flex items-center gap-2">
            <Server size={18} />
            Found {discoveredServers.length} Device{discoveredServers.length > 1 ? 's' : ''}
          </h4>

          <div className="grid gap-3">
            {discoveredServers.map((server, index) => {
              const serverAddress = `${server.ipAddress}:${server.port}`;
              const isConnecting = connecting === serverAddress;
              const isConnected = clientStatus?.isConnected && clientStatus.serverAddress === serverAddress;

              return (
                <div
                  key={`${server.ipAddress}-${server.port}-${index}`}
                  className={cn(
                    "bg-gradient-to-br rounded-xl border p-4 transition-all",
                    isConnected
                      ? "from-green-500/10 to-green-500/5 border-green-500/30"
                      : "from-surface-1 to-surface-2 border-border hover:border-accent/50"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "p-3 rounded-xl flex-shrink-0",
                      isConnected ? "bg-green-500/20" : "bg-surface-3"
                    )}>
                      <MonitorSmartphone
                        className={isConnected ? "text-green-500" : "text-accent"}
                        size={24}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-bold text-foreground truncate">{server.name}</h5>
                        {isConnected && (
                          <CheckCircle2 className="text-green-500 flex-shrink-0" size={16} />
                        )}
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Server size={12} />
                          <span className="font-mono">{serverAddress}</span>
                        </div>

                        {server.tenantId && (
                          <div className="flex items-center gap-2">
                            <span className="bg-surface-3 px-2 py-0.5 rounded font-mono text-muted-foreground">
                              {server.tenantId.substring(0, 8)}...
                            </span>
                          </div>
                        )}
                      </div>

                      {!isConnected && !clientStatus?.isConnected && (
                        <button
                          onClick={() => handleConnect(server)}
                          disabled={isConnecting}
                          className="mt-3 w-full py-2 px-4 bg-accent/10 hover:bg-accent/20 text-accent font-bold rounded-lg transition-colors disabled:opacity-50 text-sm"
                        >
                          {isConnecting ? 'Connecting...' : 'Connect'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
        <p className="text-xs text-blue-500/80 leading-relaxed">
          <strong className="text-blue-500">How it works:</strong> This feature uses mDNS (multicast DNS) to discover POS devices on your local network.
          Make sure all devices are connected to the same WiFi network. The scan takes up to 10 seconds.
        </p>
      </div>
    </div>
  );
}
