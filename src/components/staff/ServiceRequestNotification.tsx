/**
 * Service Request Notification
 * Toast notification for new service requests
 */

import { useEffect, useState } from 'react';
import { Bell, X, MapPin } from 'lucide-react';
import { useServiceRequestStore, formatRequestType } from '../../stores/serviceRequestStore';
import { useNotificationStore } from '../../stores/notificationStore';
import type { ServiceRequest } from '../../types/guest-order';

interface ServiceRequestNotificationProps {
  onViewQueue?: () => void;
}

export function ServiceRequestNotification({ onViewQueue }: ServiceRequestNotificationProps) {
  const [visibleNotification, setVisibleNotification] = useState<ServiceRequest | null>(null);
  const [lastSeenRequestId, setLastSeenRequestId] = useState<string | null>(null);
  const requests = useServiceRequestStore((state) => state.requests);
  const playSound = useNotificationStore((state) => state.playSound);

  // Watch for new pending requests
  useEffect(() => {
    const pendingRequests = requests.filter((r) => r.status === 'pending');
    if (pendingRequests.length === 0) {
      setVisibleNotification(null);
      return;
    }

    // Find the newest request that we haven't shown yet
    const newestRequest = pendingRequests[0];
    if (newestRequest && newestRequest.id !== lastSeenRequestId) {
      setVisibleNotification(newestRequest);
      setLastSeenRequestId(newestRequest.id);

      // Play notification sound
      playSound('service_request');
    }
  }, [requests, lastSeenRequestId, playSound]);

  // Auto-hide after 10 seconds
  useEffect(() => {
    if (!visibleNotification) return;

    const timeout = setTimeout(() => {
      setVisibleNotification(null);
    }, 10000);

    return () => clearTimeout(timeout);
  }, [visibleNotification]);

  if (!visibleNotification) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <div className="bg-white rounded-lg shadow-lg border-l-4 border-red-500 p-4 min-w-[300px] max-w-[400px]">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <Bell className="w-5 h-5 text-red-600" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <p className="font-semibold text-gray-900">
                {formatRequestType(visibleNotification.type)}
              </p>
              <button
                onClick={() => setVisibleNotification(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
              <MapPin className="w-4 h-4" />
              <span className="font-medium">Table {visibleNotification.tableNumber}</span>
              {visibleNotification.sectionName && (
                <>
                  <span className="text-gray-400">|</span>
                  <span>{visibleNotification.sectionName}</span>
                </>
              )}
            </div>

            {/* Action button */}
            {onViewQueue && (
              <button
                onClick={() => {
                  onViewQueue();
                  setVisibleNotification(null);
                }}
                className="mt-3 text-sm text-orange-600 font-medium hover:text-orange-700"
              >
                View all requests
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// CSS for animation (add to global styles or component)
const animationStyle = `
  @keyframes slide-in-right {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  .animate-slide-in-right {
    animation: slide-in-right 0.3s ease-out;
  }
`;

// Inject styles on first render
if (typeof document !== 'undefined') {
  const styleId = 'service-request-notification-styles';
  if (!document.getElementById(styleId)) {
    const styleSheet = document.createElement('style');
    styleSheet.id = styleId;
    styleSheet.textContent = animationStyle;
    document.head.appendChild(styleSheet);
  }
}
