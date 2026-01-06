/**
 * Remote Print Settings
 * Allows client devices (KDS, Aggregator tablets) to discover and connect to
 * a POS device for printing bills and KOTs via mDNS
 */

import { useState, useEffect } from 'react';
import { useRemotePrintStore, useRemotePrintAvailable } from '../../stores/remotePrintStore';
import { mdnsPrintService, DiscoveredPrintService } from '../../lib/mdnsPrintService';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';
import { IndustrialCard } from '../ui-industrial/IndustrialCard';
import { Printer, Search, Wifi, WifiOff, Check, X, RefreshCw } from 'lucide-react';

export function RemotePrintSettings() {
  const {
    config,
    isDiscovering,
    setEnabled,
    setPosService,
    clearPosService,
    discoverServices,
  } = useRemotePrintStore();

  const isRemotePrintAvailable = useRemotePrintAvailable();
  const [discoveredServices, setDiscoveredServices] = useState<DiscoveredPrintService[]>([]);
  const [checkingHealth, setCheckingHealth] = useState<string | null>(null);
  const [serviceHealth, setServiceHealth] = useState<Record<string, boolean>>({});

  // Load cached discovered services on mount
  useEffect(() => {
    if (config.discoveredServices.length > 0) {
      setDiscoveredServices(config.discoveredServices);
    }
  }, []);

  // Discover POS print services on the network
  const handleDiscover = async () => {
    try {
      const services = await discoverServices();
      setDiscoveredServices(services);

      // Check health of each service
      for (const service of services) {
        checkServiceHealth(service);
      }
    } catch (error) {
      console.error('[RemotePrintSettings] Discovery failed:', error);
    }
  };

  // Check if a service is reachable
  const checkServiceHealth = async (service: DiscoveredPrintService) => {
    const ip = service.ip_addresses[0] || service.host;
    const key = `${ip}:${service.port}`;
    setCheckingHealth(key);

    try {
      const url = `http://${ip}:${service.port}`;
      const isHealthy = await mdnsPrintService.checkServiceHealth(url);
      setServiceHealth(prev => ({ ...prev, [key]: isHealthy }));
    } catch {
      setServiceHealth(prev => ({ ...prev, [key]: false }));
    } finally {
      setCheckingHealth(null);
    }
  };

  // Select a POS service for printing
  const handleSelectService = (service: DiscoveredPrintService) => {
    const ip = service.ip_addresses[0] || service.host;
    setPosService(ip, service.port, service.name);
    setEnabled(true);
  };

  // Disconnect from current service
  const handleDisconnect = () => {
    clearPosService();
    setEnabled(false);
  };

  return (
    <IndustrialCard variant="raised" className="bg-white p-6">
      <div className="flex items-center gap-3 mb-4 border-b pb-2">
        <Printer size={24} className="text-blue-600" />
        <div>
          <h3 className="text-xl font-black uppercase">Remote Printing</h3>
          <p className="text-sm text-gray-500">
            Print bills and KOTs via a connected POS device
          </p>
        </div>
      </div>

      {/* Current Connection Status */}
      <div className={`p-4 rounded-lg mb-4 border-l-4 ${
        isRemotePrintAvailable
          ? 'bg-green-50 border-green-500'
          : 'bg-gray-50 border-gray-300'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isRemotePrintAvailable ? (
              <Wifi size={20} className="text-green-600" />
            ) : (
              <WifiOff size={20} className="text-gray-400" />
            )}
            <div>
              <div className="font-bold">
                {isRemotePrintAvailable ? 'Connected' : 'Not Connected'}
              </div>
              {isRemotePrintAvailable && (
                <div className="text-sm text-gray-600">
                  {config.posName} ({config.posHost}:{config.posPort})
                </div>
              )}
            </div>
          </div>
          {isRemotePrintAvailable && (
            <IndustrialButton
              size="sm"
              variant="danger"
              onClick={handleDisconnect}
            >
              <X size={16} className="mr-1" />
              DISCONNECT
            </IndustrialButton>
          )}
        </div>
      </div>

      {/* Discovery Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-gray-700">Available POS Devices</h4>
          <IndustrialButton
            size="sm"
            variant="secondary"
            onClick={handleDiscover}
            disabled={isDiscovering}
          >
            {isDiscovering ? (
              <>
                <RefreshCw size={16} className="mr-1 animate-spin" />
                SCANNING...
              </>
            ) : (
              <>
                <Search size={16} className="mr-1" />
                SCAN NETWORK
              </>
            )}
          </IndustrialButton>
        </div>

        {/* Discovered Services */}
        {discoveredServices.length > 0 ? (
          <div className="space-y-2">
            {discoveredServices.map((service, index) => {
              const ip = service.ip_addresses[0] || service.host;
              const key = `${ip}:${service.port}`;
              const isSelected = config.posHost === ip && config.posPort === service.port;
              const isHealthy = serviceHealth[key];
              const isChecking = checkingHealth === key;

              return (
                <div
                  key={index}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        isChecking ? 'bg-yellow-400 animate-pulse' :
                        isHealthy === true ? 'bg-green-500' :
                        isHealthy === false ? 'bg-red-500' :
                        'bg-gray-300'
                      }`} />
                      <div>
                        <div className="font-bold">{service.name}</div>
                        <div className="text-sm text-gray-500">
                          {ip}:{service.port}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSelected ? (
                        <span className="flex items-center gap-1 text-blue-600 font-bold text-sm">
                          <Check size={16} />
                          SELECTED
                        </span>
                      ) : (
                        <IndustrialButton
                          size="sm"
                          variant="primary"
                          onClick={() => handleSelectService(service)}
                          disabled={isHealthy === false}
                        >
                          SELECT
                        </IndustrialButton>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Printer size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No POS devices found</p>
            <p className="text-sm mt-1">
              Make sure the POS device is on the same network and has print service enabled
            </p>
          </div>
        )}

        {/* Last Discovery Time */}
        {config.lastDiscoveryTime && (
          <p className="text-xs text-gray-400 text-center">
            Last scanned: {new Date(config.lastDiscoveryTime).toLocaleString()}
          </p>
        )}
      </div>

      {/* Help Text */}
      <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-800">
          <strong>How it works:</strong> When you print a bill or KOT from this device,
          the print job is sent to the selected POS device which prints it using its
          configured printer.
        </p>
      </div>
    </IndustrialCard>
  );
}

export default RemotePrintSettings;
