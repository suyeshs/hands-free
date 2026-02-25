'use client';

import { useState, useEffect } from 'react';
import { ServiceRequestService, ServiceRequest } from '../services/ServiceRequestService';

interface ServiceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableId: string;
  tenantId: string;
}

const SERVICE_REQUEST_TYPES = [
  { type: 'call_waiter' as const, label: 'Call Waiter', icon: '🔔', description: 'Request assistance from wait staff' },
  { type: 'request_bill' as const, label: 'Request Bill', icon: '💳', description: 'Ready to pay and leave' },
  { type: 'need_help' as const, label: 'Need Help', icon: '🆘', description: 'General assistance needed' },
  { type: 'refill' as const, label: 'Refill Water', icon: '💧', description: 'Request water or beverage refill' },
  { type: 'clean_table' as const, label: 'Clean Table', icon: '🧹', description: 'Table needs cleaning' },
];

export default function ServiceRequestModal({ isOpen, onClose, tableId, tenantId }: ServiceRequestModalProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [service, setService] = useState<ServiceRequestService | null>(null);

  // Initialize service when modal opens
  useEffect(() => {
    if (isOpen && !service) {
      const newService = new ServiceRequestService(tenantId);

      // Set up acknowledgment callback
      newService.onAcknowledgment((ack) => {
        console.log('[ServiceRequestModal] Acknowledged:', ack);
        setShowSuccess(true);
        setIsLoading(false);

        // Auto-close after 2 seconds
        setTimeout(() => {
          handleClose();
        }, 2000);
      });

      // Connect to WebSocket
      newService.connect()
        .then(() => {
          console.log('[ServiceRequestModal] Connected to service');
          setService(newService);
        })
        .catch(err => {
          console.error('[ServiceRequestModal] Failed to connect:', err);
          setError('Failed to connect. Please try again.');
        });
    }

    // Cleanup on unmount
    return () => {
      if (service) {
        service.disconnect();
      }
    };
  }, [isOpen, tenantId]);

  const handleClose = () => {
    setSelectedType(null);
    setCustomMessage('');
    setIsLoading(false);
    setShowSuccess(false);
    setError(null);
    if (service) {
      service.disconnect();
      setService(null);
    }
    onClose();
  };

  const handleSendRequest = async () => {
    if (!selectedType) {
      setError('Please select a request type');
      return;
    }

    if (!service || !service.isConnected()) {
      setError('Not connected. Please close and try again.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const request: ServiceRequest = {
        type: selectedType as any,
        tableNumber: tableId,
        customMessage: customMessage || undefined,
        timestamp: Date.now()
      };

      await service.sendServiceRequest(request);

      // Show success immediately (don't wait for acknowledgment)
      setShowSuccess(true);

      // Auto-close after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      console.error('[ServiceRequestModal] Failed to send request:', err);
      setError(err.message || 'Failed to send request. Please try again.');
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Request Service</h2>
              <p className="text-sm text-gray-500 mt-1">
                Table {tableId.replace('tab-', '#')}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isLoading}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {showSuccess ? (
            // Success State
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Request Sent!</h3>
              <p className="text-gray-600">
                A staff member will be with you shortly.
              </p>
            </div>
          ) : (
            <>
              {/* Request Type Selection */}
              <div className="space-y-3 mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What do you need?
                </label>
                {SERVICE_REQUEST_TYPES.map((type) => (
                  <button
                    key={type.type}
                    onClick={() => setSelectedType(type.type)}
                    disabled={isLoading}
                    className={`w-full flex items-start p-4 rounded-xl border-2 transition-all ${
                      selectedType === type.type
                        ? 'border-accent bg-accent bg-opacity-5'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className="text-2xl mr-3">{type.icon}</span>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-gray-900">{type.label}</div>
                      <div className="text-sm text-gray-500 mt-0.5">{type.description}</div>
                    </div>
                    {selectedType === type.type && (
                      <svg className="w-5 h-5 text-accent flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              {/* Custom Message (Optional) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional notes (optional)
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Any specific requests or details..."
                  disabled={isLoading}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent transition-all resize-none disabled:opacity-50"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendRequest}
                  disabled={isLoading || !selectedType}
                  className="flex-1 px-6 py-3 bg-accent text-white rounded-xl font-medium hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </>
                  ) : (
                    'Send Request'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
