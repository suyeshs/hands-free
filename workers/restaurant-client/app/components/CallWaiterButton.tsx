'use client';

import { useState } from 'react';
import ServiceRequestModal from './ServiceRequestModal';

interface CallWaiterButtonProps {
  tableId: string;
}

export default function CallWaiterButton({ tableId }: CallWaiterButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tenantId, setTenantId] = useState<string>('');

  // Extract tenant ID from hostname on mount
  useState(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      // Extract subdomain (e.g., "coorg-food-company-6163" from "coorg-food-company-6163.handsfree.tech")
      const extractedTenantId = hostname.split('.')[0];
      setTenantId(extractedTenantId);
      console.log('[CallWaiterButton] Tenant ID:', extractedTenantId);
    }
  });

  const handleClick = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={handleClick}
        className="fixed bottom-6 right-6 w-14 h-14 bg-accent hover:bg-accent-dark text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-40 group animate-pulse hover:animate-none md:bottom-8 md:right-8 md:w-16 md:h-16"
        aria-label="Call Waiter"
        title="Call Waiter"
      >
        {/* Bell Icon */}
        <svg
          className="w-6 h-6 md:w-7 md:h-7 group-hover:scale-110 transition-transform"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Ripple effect on hover */}
        <span className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 group-hover:animate-ping"></span>
      </button>

      {/* Service Request Modal */}
      <ServiceRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tableId={tableId}
        tenantId={tenantId}
      />
    </>
  );
}
