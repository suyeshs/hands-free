/**
 * Package Card Primitive
 * Displays travel packages (flight + hotel + experiences)
 */

import type { PackageCardConfig, Package } from '../types';
import { TravelDesignTokens } from '../design-tokens';

export function createPackageCard(overrides?: Partial<PackageCardConfig>): PackageCardConfig {
  return {
    id: 'package-card',
    name: 'Package Card',
    type: 'card',
    componentType: 'package-card',
    displayMode: 'standard',
    imageHeight: '280px',
    showSavings: true,
    showInclusions: true,
    inclusionLimit: 5,
    showRating: true,
    highlightDeal: true,
    dimensions: { width: '100%', height: 'auto' },
    padding: { top: '0', right: '0', bottom: '0', left: '0' },
    shadow: { offsetX: 0, offsetY: 4, blur: 16, spread: 0, color: 'rgba(0, 0, 0, 0.12)', inset: false },
    backgroundColor: TravelDesignTokens.colors.neutral[50],
    borderRadius: TravelDesignTokens.borderRadius.xl,
    ...overrides,
  };
}

export function renderPackageCard(pkg: Package, config: PackageCardConfig = createPackageCard()): string {
  return `
    <div style="
      background: ${config.backgroundColor};
      border-radius: ${config.borderRadius};
      overflow: hidden;
      box-shadow: ${config.shadow?.offsetX}px ${config.shadow?.offsetY}px ${config.shadow?.blur}px ${config.shadow?.spread}px ${config.shadow?.color};
      cursor: pointer;
      transition: transform 0.3s;
    " class="package-card hover:scale-[1.02]">

      <div style="position: relative;">
        <img src="${pkg.images[0]}" alt="${pkg.name}" style="width: 100%; height: ${config.imageHeight}; object-fit: cover;" />

        ${config.highlightDeal && pkg.savings ? `
          <div style="
            position: absolute;
            top: 16px;
            left: 16px;
            background: ${TravelDesignTokens.colors.rose[500]};
            color: white;
            padding: 8px 16px;
            border-radius: ${TravelDesignTokens.borderRadius.lg};
            font-weight: ${TravelDesignTokens.typography.fontWeight.bold};
          ">
            Save ${pkg.savings.percentage}%
          </div>
        ` : ''}
      </div>

      <div style="padding: ${TravelDesignTokens.spacing.xl};">
        <h3 style="
          font-size: ${TravelDesignTokens.typography.fontSize['2xl']};
          font-weight: ${TravelDesignTokens.typography.fontWeight.bold};
          color: ${TravelDesignTokens.colors.neutral[900]};
          margin: 0 0 8px 0;
        ">${pkg.name}</h3>

        <div style="
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: ${TravelDesignTokens.typography.fontSize.base};
          color: ${TravelDesignTokens.colors.neutral[600]};
          margin-bottom: ${TravelDesignTokens.spacing.md};
        ">
          <span style="font-weight: ${TravelDesignTokens.typography.fontWeight.medium};">${pkg.destination.city}, ${pkg.destination.country}</span>
          <span style="color: ${TravelDesignTokens.colors.neutral[400]};">•</span>
          <span>${pkg.duration.nights}N / ${pkg.duration.days}D</span>
        </div>

        ${config.showInclusions && pkg.included.length > 0 ? `
          <div style="margin-bottom: ${TravelDesignTokens.spacing.lg};">
            ${pkg.included.slice(0, config.inclusionLimit).map(item => `
              <div style="
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 6px 0;
                font-size: ${TravelDesignTokens.typography.fontSize.sm};
                color: ${TravelDesignTokens.colors.neutral[700]};
              ">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${TravelDesignTokens.colors.emerald[500]}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>${item}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: ${TravelDesignTokens.spacing.md};
          border-top: 1px solid ${TravelDesignTokens.colors.neutral[200]};
        ">
          <div>
            ${config.showSavings && pkg.savings ? `
              <div style="
                font-size: ${TravelDesignTokens.typography.fontSize.sm};
                color: ${TravelDesignTokens.colors.neutral[500]};
                text-decoration: line-through;
              ">
                ${pkg.totalPrice.currency} ${(pkg.totalPrice.amount + pkg.savings.amount).toFixed(2)}
              </div>
            ` : ''}
            <div style="
              font-size: ${TravelDesignTokens.typography.fontSize['3xl']};
              font-weight: ${TravelDesignTokens.typography.fontWeight.bold};
              color: ${TravelDesignTokens.colors.primary[500]};
            ">
              ${pkg.totalPrice.currency} ${pkg.totalPrice.amount}
            </div>
          </div>
          <button style="
            padding: 14px 28px;
            background: ${TravelDesignTokens.colors.primary[500]};
            color: white;
            border: none;
            border-radius: ${TravelDesignTokens.borderRadius.lg};
            font-size: ${TravelDesignTokens.typography.fontSize.base};
            font-weight: ${TravelDesignTokens.typography.fontWeight.semibold};
            cursor: pointer;
          ">
            Book Package
          </button>
        </div>
      </div>
    </div>
  `;
}
