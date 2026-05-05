/**
 * Parcel Dispatch Screen
 *
 * Manage delivery allocation and tracking for subscription orders
 *
 * Features:
 * - View ready parcels grouped by time slot
 * - Assign delivery personnel to parcels
 * - Optimized route by tower/apartment distance
 * - Update delivery status (out for delivery, delivered)
 * - Scan/search parcels
 * - Real-time status tracking
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck,
  Package,
  MapPin,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Building2,
  Navigation,
  Camera,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface ParcelDispatchScreenProps {
  tenantId: string;
  deliveryDate: string;
}

interface Parcel {
  id: string;
  deliveryId: string;
  subscriptionId: string;
  customerName: string;
  customerPhone: string;
  towerNumber: string;
  apartmentNumber: string;
  distanceFromKitchen: number;
  timeSlot: string;
  itemCount: number;
  status: 'ready' | 'assigned' | 'out_for_delivery' | 'delivered' | 'failed';
  assignedDriver: string | null;
  assignedAt: string | null;
  deliveredAt: string | null;
  deliveryProof: string | null;
  specialInstructions?: string;
}

interface DeliveryPerson {
  id: string;
  name: string;
  phone: string;
  activeDeliveries: number;
  completedToday: number;
  status: 'available' | 'busy';
}

export function ParcelDispatchScreen({ tenantId, deliveryDate }: ParcelDispatchScreenProps) {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [deliveryPersonnel, setDeliveryPersonnel] = useState<DeliveryPerson[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('ready');
  const [selectedTower, setSelectedTower] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParcels, setSelectedParcels] = useState<Set<string>>(new Set());
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Load parcels and delivery personnel
  useEffect(() => {
    loadParcels();
    loadDeliveryPersonnel();
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadParcels();
      loadDeliveryPersonnel();
    }, 30000);
    return () => clearInterval(interval);
  }, [tenantId, deliveryDate]);

  const loadParcels = async () => {
    try {
      const response = await fetch(
        `/api/subscriptions/parcels?tenantId=${tenantId}&date=${deliveryDate}`
      );
      const data = await response.json();
      setParcels(data.parcels || []);
    } catch (error) {
      console.error('Failed to load parcels:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDeliveryPersonnel = async () => {
    try {
      const response = await fetch(`/api/subscriptions/delivery-personnel?tenantId=${tenantId}`);
      const data = await response.json();
      setDeliveryPersonnel(data.personnel || []);
    } catch (error) {
      console.error('Failed to load delivery personnel:', error);
    }
  };

  // Assign driver to selected parcels
  const assignDriver = async () => {
    if (!selectedDriver || selectedParcels.size === 0) return;

    try {
      await fetch(`/api/subscriptions/parcels/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcelIds: Array.from(selectedParcels),
          driverId: selectedDriver,
        }),
      });

      await loadParcels();
      setSelectedParcels(new Set());
      setAssignModalOpen(false);
      setSelectedDriver('');
    } catch (error) {
      console.error('Failed to assign driver:', error);
    }
  };

  // Update parcel status
  const updateParcelStatus = async (
    parcelId: string,
    status: Parcel['status'],
    proof?: string
  ) => {
    try {
      await fetch(`/api/subscriptions/parcels/${parcelId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, deliveryProof: proof }),
      });

      setParcels(prev =>
        prev.map(p =>
          p.id === parcelId
            ? { ...p, status, deliveredAt: status === 'delivered' ? new Date().toISOString() : p.deliveredAt }
            : p
        )
      );
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  // Toggle parcel selection
  const toggleParcelSelection = (parcelId: string) => {
    setSelectedParcels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(parcelId)) {
        newSet.delete(parcelId);
      } else {
        newSet.add(parcelId);
      }
      return newSet;
    });
  };

  // Filter parcels
  const filteredParcels = parcels.filter(parcel => {
    if (selectedTimeSlot !== 'all' && parcel.timeSlot !== selectedTimeSlot) return false;
    if (selectedStatus !== 'all' && parcel.status !== selectedStatus) return false;
    if (selectedTower !== 'all' && parcel.towerNumber !== selectedTower) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !parcel.customerName.toLowerCase().includes(query) &&
        !parcel.customerPhone.includes(query) &&
        !parcel.apartmentNumber.includes(query)
      ) {
        return false;
      }
    }
    return true;
  });

  // Sort by distance (for route optimization)
  const sortedParcels = [...filteredParcels].sort((a, b) => a.distanceFromKitchen - b.distanceFromKitchen);

  // Group by time slot
  const parcelsByTimeSlot = sortedParcels.reduce((acc, parcel) => {
    if (!acc[parcel.timeSlot]) acc[parcel.timeSlot] = [];
    acc[parcel.timeSlot].push(parcel);
    return acc;
  }, {} as Record<string, Parcel[]>);

  // Get unique time slots and towers
  const timeSlots = Array.from(new Set(parcels.map(p => p.timeSlot)));
  const towers = Array.from(new Set(parcels.map(p => p.towerNumber))).sort();

  // Stats
  const readyCount = parcels.filter(p => p.status === 'ready').length;
  const assignedCount = parcels.filter(p => p.status === 'assigned').length;
  const outForDeliveryCount = parcels.filter(p => p.status === 'out_for_delivery').length;
  const deliveredCount = parcels.filter(p => p.status === 'delivered').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-lg">Loading parcels...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Truck className="w-8 h-8 text-blue-400" />
              <div>
                <h1 className="text-2xl font-bold text-white">Parcel Dispatch</h1>
                <p className="text-sm text-muted-foreground">
                  {new Date(deliveryDate).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Bulk Assign Button */}
          {selectedParcels.size > 0 && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={() => setAssignModalOpen(true)}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold shadow-lg flex items-center gap-2"
            >
              <User className="w-5 h-5" />
              Assign {selectedParcels.size} Parcels
            </motion.button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Ready</p>
                <p className="text-2xl font-bold text-orange-400">{readyCount}</p>
              </div>
              <Package className="w-8 h-8 text-orange-400 opacity-50" />
            </div>
          </div>

          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Assigned</p>
                <p className="text-2xl font-bold text-yellow-400">{assignedCount}</p>
              </div>
              <User className="w-8 h-8 text-yellow-400 opacity-50" />
            </div>
          </div>

          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Out for Delivery</p>
                <p className="text-2xl font-bold text-blue-400">{outForDeliveryCount}</p>
              </div>
              <Truck className="w-8 h-8 text-blue-400 opacity-50" />
            </div>
          </div>

          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Delivered</p>
                <p className="text-2xl font-bold text-green-400">{deliveredCount}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400 opacity-50" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mt-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, or apartment..."
              className="w-full pl-10 pr-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Time Slot Filter */}
          <select
            value={selectedTimeSlot}
            onChange={(e) => setSelectedTimeSlot(e.target.value)}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Time Slots</option>
            {timeSlots.map(slot => (
              <option key={slot} value={slot}>{slot}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="ready">Ready</option>
            <option value="assigned">Assigned</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
          </select>

          {/* Tower Filter */}
          <select
            value={selectedTower}
            onChange={(e) => setSelectedTower(e.target.value)}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Towers</option>
            {towers.map(tower => (
              <option key={tower} value={tower}>Tower {tower}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Parcels List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {Object.entries(parcelsByTimeSlot).map(([timeSlot, slotParcels]) => (
            <div key={timeSlot} className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-bold text-white">{timeSlot}</h3>
                <span className="text-sm text-muted-foreground">({slotParcels.length} parcels)</span>
              </div>

              <div className="space-y-2">
                {slotParcels.map((parcel, index) => (
                  <motion.div
                    key={parcel.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      'bg-gray-700 rounded-lg p-4 border-2 transition-all',
                      selectedParcels.has(parcel.id) && 'border-blue-500 bg-blue-500/10',
                      !selectedParcels.has(parcel.id) && 'border-transparent hover:border-gray-600'
                    )}
                  >
                    <div className="flex items-start gap-4">
                      {/* Selection Checkbox */}
                      {parcel.status === 'ready' && (
                        <input
                          type="checkbox"
                          checked={selectedParcels.has(parcel.id)}
                          onChange={() => toggleParcelSelection(parcel.id)}
                          className="w-5 h-5 mt-1 accent-blue-500"
                        />
                      )}

                      {/* Parcel Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-bold text-white text-lg">{parcel.customerName}</h4>
                            <p className="text-sm text-muted-foreground">{parcel.customerPhone}</p>
                          </div>

                          {/* Status Badge */}
                          <span
                            className={cn(
                              'px-3 py-1 rounded-full text-xs font-semibold',
                              parcel.status === 'ready' && 'bg-orange-500/20 text-orange-400',
                              parcel.status === 'assigned' && 'bg-yellow-500/20 text-yellow-400',
                              parcel.status === 'out_for_delivery' && 'bg-blue-500/20 text-blue-400',
                              parcel.status === 'delivered' && 'bg-green-500/20 text-green-400',
                              parcel.status === 'failed' && 'bg-red-500/20 text-red-400'
                            )}
                          >
                            {parcel.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mb-3">
                          <div className="flex items-center gap-2 text-sm">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            <span className="text-foreground">
                              Tower {parcel.towerNumber}, Apt {parcel.apartmentNumber}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <Navigation className="w-4 h-4 text-muted-foreground" />
                            <span className="text-foreground">{parcel.distanceFromKitchen}m away</span>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <Package className="w-4 h-4 text-muted-foreground" />
                            <span className="text-foreground">{parcel.itemCount} items</span>
                          </div>

                          {parcel.assignedDriver && (
                            <div className="flex items-center gap-2 text-sm">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className="text-foreground">{parcel.assignedDriver}</span>
                            </div>
                          )}
                        </div>

                        {parcel.specialInstructions && (
                          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 mb-3">
                            <p className="text-xs text-yellow-400">
                              📝 {parcel.specialInstructions}
                            </p>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          {parcel.status === 'ready' && !selectedParcels.has(parcel.id) && (
                            <button
                              onClick={() => {
                                setSelectedParcels(new Set([parcel.id]));
                                setAssignModalOpen(true);
                              }}
                              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                              Assign Driver
                            </button>
                          )}

                          {parcel.status === 'assigned' && (
                            <button
                              onClick={() => updateParcelStatus(parcel.id, 'out_for_delivery')}
                              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                              Mark Out for Delivery
                            </button>
                          )}

                          {parcel.status === 'out_for_delivery' && (
                            <button
                              onClick={() => updateParcelStatus(parcel.id, 'delivered')}
                              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Mark Delivered
                            </button>
                          )}

                          {parcel.status === 'delivered' && parcel.deliveredAt && (
                            <div className="text-sm text-muted-foreground">
                              ✓ Delivered at {new Date(parcel.deliveredAt).toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {sortedParcels.length === 0 && (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Parcels Found</h3>
              <p className="text-muted-foreground">
                {searchQuery || selectedTimeSlot !== 'all' || selectedStatus !== 'all' || selectedTower !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No parcels ready for dispatch'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Assign Driver Modal */}
      <AnimatePresence>
        {assignModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setAssignModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-700"
            >
              <h2 className="text-2xl font-bold text-white mb-4">Assign Delivery Personnel</h2>

              <p className="text-muted-foreground mb-4">
                Assigning {selectedParcels.size} parcel(s) to a delivery person
              </p>

              <div className="space-y-3 mb-6">
                {deliveryPersonnel.map(person => (
                  <button
                    key={person.id}
                    onClick={() => setSelectedDriver(person.id)}
                    className={cn(
                      'w-full p-4 rounded-lg border-2 transition-all text-left',
                      selectedDriver === person.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-white">{person.name}</h4>
                        <p className="text-sm text-muted-foreground">{person.phone}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Active: {person.activeDeliveries}</p>
                        <p className="text-sm text-green-400">Today: {person.completedToday}</p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <span
                        className={cn(
                          'px-2 py-1 rounded text-xs font-semibold',
                          person.status === 'available'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        )}
                      >
                        {person.status.toUpperCase()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setAssignModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={assignDriver}
                  disabled={!selectedDriver}
                  className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Assign
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
