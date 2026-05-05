'use client';

import { VoiceMenuItemCard } from './VoiceMenuItemCard';

interface MenuItem {
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  category?: string;
  type?: string;
  rating?: number;
  spiceLevel?: number;
  dietary?: string[];
  available?: boolean;
}

interface MenuGridModalProps {
  title: string;
  dishes: MenuItem[];
  totalCount: number;
  onClose: () => void;
  onAction?: (action: string, data: any) => void;
}

export function MenuGridModal({ title, dishes, totalCount, onClose, onAction }: MenuGridModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in">
      {/* Full screen modal */}
      <div className="h-full w-full bg-gradient-to-br from-white to-gray-50 overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-gray-200 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold neu-text">{title}</h2>
              <p className="text-sm neu-text-secondary mt-1">
                {totalCount} {totalCount === 1 ? 'dish' : 'dishes'} available
              </p>
            </div>
            <button
              onClick={onClose}
              className="neu-button rounded-full w-12 h-12 flex items-center justify-center hover-lift"
              aria-label="Close"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Grid of dishes */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {dishes.map((dish, index) => (
              <div
                key={`${dish.name}-${index}`}
                className="animate-scale-in"
                style={{
                  animationDelay: `${Math.min(index * 50, 500)}ms`,
                  animationFillMode: 'backwards'
                }}
              >
                <VoiceMenuItemCard
                  data={dish}
                  onAction={onAction}
                />
              </div>
            ))}
          </div>

          {/* Empty state */}
          {dishes.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-2xl font-bold neu-text mb-2">No dishes found</h3>
              <p className="neu-text-secondary">Try adjusting your filters or search query</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
