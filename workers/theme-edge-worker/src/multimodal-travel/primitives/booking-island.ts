/**
 * Booking Island Primitive
 * Floating booking summary indicator
 */

import type { BookingIslandConfig } from '../types';
import { TravelDesignTokens } from '../design-tokens';

export function createBookingIsland(overrides?: Partial<BookingIslandConfig>): BookingIslandConfig {
  return {
    id: 'booking-island',
    name: 'Booking Island',
    type: 'interactive',
    componentType: 'booking-island',
    position: 'bottom-right',
    size: 'medium',
    showItemCount: true,
    showTotalPrice: true,
    expandable: true,
    pulseOnAdd: true,
    dimensions: { width: 'auto', height: 'auto' },
    padding: { top: TravelDesignTokens.spacing.md, right: TravelDesignTokens.spacing.lg, bottom: TravelDesignTokens.spacing.md, left: TravelDesignTokens.spacing.lg },
    backgroundColor: TravelDesignTokens.colors.primary[500],
    borderRadius: TravelDesignTokens.borderRadius.full,
    shadow: { offsetX: 0, offsetY: 8, blur: 24, spread: 0, color: 'rgba(255, 90, 95, 0.3)', inset: false },
    ...overrides,
  };
}

export function renderBookingIsland(config: BookingIslandConfig = createBookingIsland(), itemCount: number = 0, totalPrice: string = '$0'): string {
  return `
    <div style="
      position: fixed;
      ${config.position.includes('bottom') ? 'bottom: 24px;' : 'top: 24px;'}
      ${config.position.includes('left') ? 'left: 24px;' : 'right: 24px;'}
      padding: ${config.padding?.top} ${config.padding?.right} ${config.padding?.bottom} ${config.padding?.left};
      background: ${config.backgroundColor};
      border-radius: ${config.borderRadius};
      box-shadow: ${config.shadow?.offsetX}px ${config.shadow?.offsetY}px ${config.shadow?.blur}px ${config.shadow?.spread}px ${config.shadow?.color};
      color: white;
      cursor: pointer;
      z-index: ${TravelDesignTokens.zIndex.sticky};
      display: ${itemCount > 0 ? 'flex' : 'none'};
      align-items: center;
      gap: ${TravelDesignTokens.spacing.md};
      transition: transform 0.3s;
    " class="booking-island hover:scale-105">

      ${config.showItemCount ? `
        <div style="
          background: white;
          color: ${TravelDesignTokens.colors.primary[500]};
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: ${TravelDesignTokens.typography.fontWeight.bold};
          font-size: ${TravelDesignTokens.typography.fontSize.sm};
        ">
          ${itemCount}
        </div>
      ` : ''}

      <div style="display: flex; flex-direction: column; align-items: flex-start;">
        <div style="font-size: ${TravelDesignTokens.typography.fontSize.sm}; opacity: 0.9;">Your Bookings</div>
        ${config.showTotalPrice ? `
          <div style="font-size: ${TravelDesignTokens.typography.fontSize.lg}; font-weight: ${TravelDesignTokens.typography.fontWeight.bold};">${totalPrice}</div>
        ` : ''}
      </div>

      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
      </svg>
    </div>
  `;
}
