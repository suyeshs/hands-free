/**
 * Itinerary Builder Primitive
 * Interactive trip planning and itinerary management
 */

import type { ItineraryBuilderConfig } from '../types';
import { TravelDesignTokens } from '../design-tokens';

export function createItineraryBuilder(overrides?: Partial<ItineraryBuilderConfig>): ItineraryBuilderConfig {
  return {
    id: 'itinerary-builder',
    name: 'Itinerary Builder',
    type: 'container',
    componentType: 'itinerary-builder',
    layout: 'timeline',
    allowDragDrop: true,
    showDatePicker: true,
    showTravelerSelector: true,
    showBudgetTracker: true,
    showMap: false,
    dimensions: { width: '100%', height: 'auto' },
    padding: { top: TravelDesignTokens.spacing.xl, right: TravelDesignTokens.spacing.xl, bottom: TravelDesignTokens.spacing.xl, left: TravelDesignTokens.spacing.xl },
    backgroundColor: TravelDesignTokens.colors.neutral[50],
    borderRadius: TravelDesignTokens.borderRadius.xl,
    border: { width: 1, color: TravelDesignTokens.colors.neutral[200], style: 'solid' },
    ...overrides,
  };
}

export function renderItineraryBuilder(config: ItineraryBuilderConfig = createItineraryBuilder()): string {
  return `
    <div style="
      padding: ${config.padding?.top} ${config.padding?.right} ${config.padding?.bottom} ${config.padding?.left};
      background: ${config.backgroundColor};
      border-radius: ${config.borderRadius};
      border: ${config.border?.width}px ${config.border?.style} ${config.border?.color};
    " class="itinerary-builder">

      <h2 style="
        font-size: ${TravelDesignTokens.typography.fontSize['3xl']};
        font-weight: ${TravelDesignTokens.typography.fontWeight.bold};
        color: ${TravelDesignTokens.colors.neutral[900]};
        margin: 0 0 ${TravelDesignTokens.spacing.xl} 0;
      ">
        Plan Your Trip
      </h2>

      ${config.showDatePicker || config.showTravelerSelector ? `
        <div style="
          display: flex;
          gap: ${TravelDesignTokens.spacing.lg};
          margin-bottom: ${TravelDesignTokens.spacing.xl};
          flex-wrap: wrap;
        ">
          ${config.showDatePicker ? `
            <div style="flex: 1; min-width: 200px;">
              <label style="
                display: block;
                font-size: ${TravelDesignTokens.typography.fontSize.sm};
                color: ${TravelDesignTokens.colors.neutral[700]};
                margin-bottom: 8px;
              ">Travel Dates</label>
              <input type="date" style="
                width: 100%;
                padding: 12px;
                border: 1px solid ${TravelDesignTokens.colors.neutral[300]};
                border-radius: ${TravelDesignTokens.borderRadius.md};
                font-size: ${TravelDesignTokens.typography.fontSize.base};
              " />
            </div>
          ` : ''}

          ${config.showTravelerSelector ? `
            <div style="flex: 1; min-width: 200px;">
              <label style="
                display: block;
                font-size: ${TravelDesignTokens.typography.fontSize.sm};
                color: ${TravelDesignTokens.colors.neutral[700]};
                margin-bottom: 8px;
              ">Travelers</label>
              <select style="
                width: 100%;
                padding: 12px;
                border: 1px solid ${TravelDesignTokens.colors.neutral[300]};
                border-radius: ${TravelDesignTokens.borderRadius.md};
                font-size: ${TravelDesignTokens.typography.fontSize.base};
              ">
                <option>1 Adult</option>
                <option>2 Adults</option>
                <option>2 Adults, 1 Child</option>
                <option>Family (4)</option>
              </select>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <div style="position: relative; padding-left: ${TravelDesignTokens.spacing.xl};">
        <!-- Timeline line -->
        <div style="
          position: absolute;
          left: 20px;
          top: 0;
          bottom: 0;
          width: 2px;
          background: ${TravelDesignTokens.colors.neutral[300]};
        "></div>

        <!-- Placeholder timeline items -->
        ${['Flight to Destination', 'Hotel Check-in', 'Explore & Activities', 'Hotel Check-out', 'Return Flight'].map((item, index) => `
          <div style="
            position: relative;
            margin-bottom: ${TravelDesignTokens.spacing.lg};
            padding: ${TravelDesignTokens.spacing.md} ${TravelDesignTokens.spacing.lg};
            background: white;
            border: 1px dashed ${TravelDesignTokens.colors.neutral[300]};
            border-radius: ${TravelDesignTokens.borderRadius.lg};
            margin-left: ${TravelDesignTokens.spacing.xl};
          ">
            <div style="
              position: absolute;
              left: -${TravelDesignTokens.spacing['2xl']};
              top: 50%;
              transform: translateY(-50%);
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background: ${TravelDesignTokens.colors.primary[500]};
              border: 3px solid white;
              box-shadow: 0 0 0 2px ${TravelDesignTokens.colors.primary[500]};
            "></div>
            <div style="
              font-size: ${TravelDesignTokens.typography.fontSize.base};
              font-weight: ${TravelDesignTokens.typography.fontWeight.medium};
              color: ${TravelDesignTokens.colors.neutral[700]};
            ">
              Day ${index + 1}: ${item}
            </div>
          </div>
        `).join('')}
      </div>

      ${config.showBudgetTracker ? `
        <div style="
          margin-top: ${TravelDesignTokens.spacing.xl};
          padding: ${TravelDesignTokens.spacing.lg};
          background: ${TravelDesignTokens.colors.sky[50]};
          border-radius: ${TravelDesignTokens.borderRadius.lg};
          border: 1px solid ${TravelDesignTokens.colors.sky[200]};
        ">
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <span style="
              font-size: ${TravelDesignTokens.typography.fontSize.base};
              color: ${TravelDesignTokens.colors.neutral[700]};
            ">Estimated Budget</span>
            <span style="
              font-size: ${TravelDesignTokens.typography.fontSize['2xl']};
              font-weight: ${TravelDesignTokens.typography.fontWeight.bold};
              color: ${TravelDesignTokens.colors.primary[500]};
            ">$0.00</span>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}
