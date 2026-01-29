/**
 * Multi-Location Manager Component
 * Manage all locations in a multi-location restaurant business
 */

import { useState, useEffect } from 'react';
import {
  MapPin,
  Plus,
  Edit2,
  Power,
  Download,
  Store,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  Smartphone,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { useChainStore, LocationTenantMetadata } from '../../stores/chainStore';
import { usePOSDeviceStore } from '../../stores/posDeviceStore';
import { useRestaurantSettingsStore } from '../../stores/restaurantSettingsStore';
import { LocationCreationModal, LocationFormData } from './LocationCreationModal';
import { LocationProvisioningProgress } from './LocationProvisioningProgress';
import { LocationSuccessModal } from './LocationSuccessModal';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface MultiLocationManagerProps {
  chainId: string;
  masterTenantId: string;
}

export function MultiLocationManager({ chainId, masterTenantId: _masterTenantId }: MultiLocationManagerProps) {
  const {
    locations,
    isLoading,
    error,
    loadLocations,
    provisionLocationTenant,
    ensureChainExists,
    pullMasterMenu
  } = useChainStore();

  const { fetchDevices, devices } = usePOSDeviceStore();
  const { settings } = useRestaurantSettingsStore();

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pullingMenu, setPullingMenu] = useState<string | null>(null);
  const [provisioningStep, setProvisioningStep] = useState(0);
  const [provisioningProgress, setProvisioningProgress] = useState(0);
  const [newLocationData, setNewLocationData] = useState<LocationTenantMetadata | null>(null);

  // Load locations on mount
  useEffect(() => {
    if (chainId) {
      loadLocations(chainId);
    }
  }, [chainId, loadLocations]);

  // Load device counts for each location
  useEffect(() => {
    locations.forEach(location => {
      fetchDevices(location.locationTenantId);
    });
  }, [locations, fetchDevices]);

  // Get device count for a location
  const getDeviceCount = (tenantId: string): number => {
    return devices.filter(d => d.status === 'active' && d.tenantId === tenantId).length;
  };

  // Handle add location
  const handleAddLocation = async (locationData: LocationFormData) => {
    try {
      // Ensure chain exists (auto-create if first location)
      const activeChainId = await ensureChainExists();

      // Close location modal and show progress modal
      setShowLocationModal(false);
      setShowProgressModal(true);

      // Reset progress
      setProvisioningStep(0);
      setProvisioningProgress(0);

      // Provision location tenant with progress tracking
      const locationMetadata = await provisionLocationTenant(
        activeChainId,
        locationData,
        (_step, progress) => {
          // Map progress percentage to step index (0-4)
          const stepIndex = Math.floor(progress / 20);
          setProvisioningStep(Math.min(stepIndex, 4));
          setProvisioningProgress(progress);
        }
      );

      // Close progress modal and show success modal
      setShowProgressModal(false);
      setNewLocationData(locationMetadata);
      setShowSuccessModal(true);

      // Reload locations
      await loadLocations(activeChainId);
    } catch (error) {
      console.error('Failed to create location:', error);
      setShowProgressModal(false);
      toast.error('Failed to create location: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Handle copy activation code
  const handleCopyActivationCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Activation code copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy activation code');
    }
  };

  // Handle pull master menu
  const handlePullMasterMenu = async (tenantId: string, locationName: string) => {
    if (!confirm(`Pull master menu to ${locationName}? This will override any local menu changes.`)) {
      return;
    }

    setPullingMenu(tenantId);
    try {
      await pullMasterMenu(tenantId, chainId);
      toast.success(`Master menu pulled to ${locationName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to pull menu');
    } finally {
      setPullingMenu(null);
    }
  };

  if (error) {
    return (
      <div className="glass-panel p-6 rounded-2xl border border-border">
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
      <div className="glass-panel p-6 rounded-2xl border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent/20 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Locations</h2>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                {locations.length} {locations.length === 1 ? 'Location' : 'Locations'} Active
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowLocationModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-accent text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Location
          </button>
        </div>
      </div>

      {/* New Modals */}
      <LocationCreationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onSubmit={handleAddLocation}
        defaultRestaurantType={settings.restaurantType}
      />

      <LocationProvisioningProgress
        isOpen={showProgressModal}
        locationName={newLocationData?.locationName || ''}
        currentStep={provisioningStep}
        progress={provisioningProgress}
      />

      <LocationSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        locationData={{
          locationName: newLocationData?.locationName || '',
          subdomain: newLocationData?.subdomain || '',
          activationCode: newLocationData?.activationCode || '',
          googleRating: newLocationData?.googleRating,
          googleTotalReviews: newLocationData?.googleTotalReviews,
        }}
      />

      {/* Locations Grid */}
      {isLoading && locations.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl border border-border text-center">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading locations...</p>
        </div>
      ) : locations.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl border border-border border-dashed text-center">
          <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-10 h-10 text-accent" />
          </div>
          <h3 className="text-xl font-bold text-muted-foreground mb-2">No Locations Yet</h3>
          <p className="text-sm text-muted-foreground mb-6">Add your first location to get started</p>
          <button
            onClick={() => setShowLocationModal(true)}
            className="px-6 py-3 bg-accent text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20"
          >
            Add First Location
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {locations.map((location) => {
            const deviceCount = getDeviceCount(location.locationTenantId);
            const isActive = location.status === 'active';

            return (
              <div
                key={location.id}
                className={cn(
                  "glass-panel p-6 rounded-2xl border transition-all hover:border-accent/30 group",
                  isActive ? "border-border" : "border-red-500/30 opacity-60"
                )}
              >
                {/* Location Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12  flex items-center justify-center",
                      isActive ? "bg-green-500/20" : "bg-red-500/20"
                    )}>
                      <Store className={cn(
                        "w-6 h-6",
                        isActive ? "text-green-400" : "text-red-400"
                      )} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg leading-tight group-hover:text-accent transition-colors">
                        {location.locationName}
                      </h3>
                      {location.googleRating && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-yellow-400 text-sm">⭐ {location.googleRating}</span>
                          {location.googleTotalReviews && (
                            <span className="text-[10px] text-muted-foreground">
                              ({location.googleTotalReviews.toLocaleString()} reviews)
                            </span>
                          )}
                        </div>
                      )}
                      <div className={cn(
                        "text-[10px] font-black uppercase px-2 py-0.5 rounded-full border mt-1 inline-block",
                        isActive
                          ? "bg-green-500/20 text-green-300 border-green-500/30"
                          : "bg-red-500/20 text-red-300 border-red-500/30"
                      )}>
                        {isActive ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Location Details */}
                <div className="space-y-2 mb-4 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="flex-1">
                      {location.address}
                      {location.city && `, ${location.city}`}
                      {location.state && `, ${location.state}`}
                    </span>
                  </div>
                  {location.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      <span>{location.phone}</span>
                    </div>
                  )}
                  {location.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      <span>{location.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    <span>{deviceCount} Active Device{deviceCount !== 1 ? 's' : ''}</span>
                  </div>
                  {location.googleMapsUrl && (
                    <div className="pt-2">
                      <a
                        href={location.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        🗺️ View on Google Maps
                        <span className="text-[10px]">↗</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Subdomain & Activation Code */}
                {(location.subdomain || location.activationCode) && (
                  <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/30 space-y-2">
                    {location.subdomain && (
                      <div>
                        <p className="text-[9px] text-orange-300 font-black uppercase tracking-widest mb-1">
                          Subdomain
                        </p>
                        <p className="text-xs text-orange-200 font-mono break-all">
                          {location.subdomain}
                        </p>
                      </div>
                    )}
                    {location.activationCode && (
                      <div>
                        <p className="text-[9px] text-orange-300 font-black uppercase tracking-widest mb-1">
                          Activation Code
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="flex-1 text-sm font-bold text-orange-100 font-mono tracking-wider">
                            {location.activationCode}
                          </p>
                          <button
                            onClick={() => handleCopyActivationCode(location.activationCode!)}
                            className="p-1.5 bg-orange-600/50 hover:bg-orange-600 transition-colors"
                            title="Copy activation code"
                          >
                            <Copy className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-border">
                  <button
                    onClick={() => handlePullMasterMenu(location.locationTenantId, location.locationName)}
                    disabled={pullingMenu === location.locationTenantId}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors text-xs font-bold uppercase disabled:opacity-50"
                  >
                    <Download className="w-3 h-3" />
                    {pullingMenu === location.locationTenantId ? 'Pulling...' : 'Pull Menu'}
                  </button>
                  <button
                    className="px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    title="Edit location"
                  >
                    <Edit2 className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button
                    className="px-3 py-2 bg-yellow-500/20 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors"
                    title="Toggle status"
                  >
                    <Power className="w-4 h-4 text-yellow-400" />
                  </button>
                </div>

                {/* Tenant ID */}
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Tenant: {location.locationTenantId}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
