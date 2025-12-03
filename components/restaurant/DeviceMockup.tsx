import React from 'react';
import { motion } from 'framer-motion';

interface DeviceMockupProps {
  type: 'browser' | 'tablet' | 'phone';
  children: React.ReactNode;
  className?: string;
  floating?: boolean;
}

export function DeviceMockup({ type, children, className = '', floating = false }: DeviceMockupProps) {
  const floatingAnimation = floating
    ? {
        animate: { y: [0, -10, 0] },
        transition: { repeat: Infinity, duration: 4, ease: 'easeInOut' },
      }
    : {};

  if (type === 'browser') {
    return (
      <motion.div
        {...floatingAnimation}
        className={`rounded-xl border border-white/20 bg-black/40 overflow-hidden shadow-2xl ${className}`}
      >
        {/* Browser Header */}
        <div className="h-10 bg-black/60 flex items-center px-4 gap-2 border-b border-white/10">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="flex-1 mx-4">
            <div className="h-5 bg-white/10 rounded-md text-xs text-gray-400 flex items-center justify-center">
              https://yourrestaurant.handsfree.tech
            </div>
          </div>
        </div>
        {/* Content */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800">
          {children}
        </div>
      </motion.div>
    );
  }

  if (type === 'tablet') {
    return (
      <motion.div
        {...floatingAnimation}
        className={`rounded-[2rem] border-8 border-gray-800 bg-black overflow-hidden shadow-2xl ${className}`}
      >
        {/* Tablet Frame */}
        <div className="relative bg-gradient-to-br from-gray-900 to-gray-800">
          {/* Camera */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-gray-700" />
          {/* Content */}
          <div className="pt-4">
            {children}
          </div>
        </div>
      </motion.div>
    );
  }

  // Phone
  return (
    <motion.div
      {...floatingAnimation}
      className={`rounded-[3rem] border-8 border-gray-800 bg-black overflow-hidden shadow-2xl ${className}`}
    >
      {/* Phone Frame */}
      <div className="relative bg-gradient-to-br from-gray-900 to-gray-800">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-b-2xl" />
        {/* Content */}
        <div className="pt-6">
          {children}
        </div>
        {/* Home Indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-600 rounded-full" />
      </div>
    </motion.div>
  );
}

// POS Terminal Mockup
export function POSTerminalMockup({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
      className={`relative ${className}`}
    >
      {/* Terminal Body */}
      <div className="rounded-2xl border-4 border-gray-700 bg-gray-800 overflow-hidden shadow-2xl">
        {/* Screen */}
        <div className="bg-gradient-to-br from-gray-900 to-black p-1">
          <div className="rounded-lg overflow-hidden">
            {children}
          </div>
        </div>
        {/* Card Reader Slot */}
        <div className="h-8 bg-gray-700 flex items-center justify-center border-t border-gray-600">
          <div className="w-16 h-1 bg-gray-500 rounded" />
        </div>
      </div>
      {/* Stand */}
      <div className="mx-auto w-16 h-4 bg-gradient-to-b from-gray-700 to-gray-800 rounded-b-lg" />
      <div className="mx-auto w-24 h-2 bg-gray-800 rounded-full" />
    </motion.div>
  );
}
