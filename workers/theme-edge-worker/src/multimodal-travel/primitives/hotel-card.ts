/**
 * Hotel Card Primitive
 * Displays hotel information with images, amenities, rating, and pricing
 */

import type { HotelCardConfig, Hotel } from '../types';
import { TravelDesignTokens } from '../design-tokens';

export function createHotelCard(overrides?: Partial<HotelCardConfig>): HotelCardConfig {
  return {
    id: 'hotel-card',
    name: 'Hotel Card',
    type: 'card',
    componentType: 'hotel-card',
    displayMode: 'standard',
    imageHeight: '240px',
    showRating: true,
    showReviewScore: true,
    showAmenities: true,
    amenityLimit: 6,
    showDistance: true,
    showCancellationPolicy: true,
    pricePosition: 'bottom',
    dimensions: {
      width: '100%',
      height: 'auto',
    },
    padding: {
      top: '0',
      right: '0',
      bottom: '0',
      left: '0',
    },
    shadow: {
      offsetX: 0,
      offsetY: 4,
      blur: 16,
      spread: 0,
      color: 'rgba(0, 0, 0, 0.1)',
      inset: false,
    },
    backgroundColor: TravelDesignTokens.colors.neutral[50],
    borderRadius: TravelDesignTokens.borderRadius.lg,
    ...overrides,
  };
}

export function renderHotelCard(hotel: Hotel, config: HotelCardConfig = createHotelCard()): string {
  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
      if (i < Math.floor(rating)) {
        stars.push(`<span style="color: ${TravelDesignTokens.colors.amber[500]};">★</span>`);
      } else {
        stars.push(`<span style="color: ${TravelDesignTokens.colors.neutral[300]};">★</span>`);
      }
    }
    return stars.join('');
  };

  const renderAmenities = () => hotel.amenities.slice(0, config.amenityLimit).map(amenity => {
    const amenityData = TravelDesignTokens.colors.amenity[amenity as keyof typeof TravelDesignTokens.colors.amenity];
    const displayLabel = amenityData?.label || amenity;
    return `
      <span style="
        display: inline-flex;
        align-items: center;
        padding: 6px 12px;
        background: ${amenityData?.bg || TravelDesignTokens.colors.neutral[100]};
        color: ${amenityData?.text || TravelDesignTokens.colors.neutral[700]};
        border-radius: ${TravelDesignTokens.borderRadius.sm};
        font-size: ${TravelDesignTokens.typography.fontSize.xs};
        font-weight: ${TravelDesignTokens.typography.fontWeight.medium};
        text-transform: capitalize;
      ">
        ${displayLabel}
      </span>
    `;
  }).join('');

  return `
    <div style="
      background: ${config.backgroundColor};
      border-radius: ${config.borderRadius};
      overflow: hidden;
      box-shadow: ${config.shadow?.offsetX}px ${config.shadow?.offsetY}px ${config.shadow?.blur}px ${config.shadow?.spread}px ${config.shadow?.color};
      transition: transform 0.3s, box-shadow 0.3s;
      cursor: pointer;
    " class="hotel-card hover:scale-[1.02] hover:shadow-xl">

      <!-- Image -->
      <div style="position: relative; width: 100%; height: ${config.imageHeight}; overflow: hidden;">
        <img src="${hotel.images[0]}" alt="${hotel.name}"
          style="width: 100%; height: 100%; object-fit: cover;" />

        ${config.pricePosition === 'overlay' ? `
          <div style="
            position: absolute;
            bottom: 16px;
            right: 16px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            padding: 8px 16px;
            border-radius: ${TravelDesignTokens.borderRadius.lg};
          ">
            <div style="
              font-size: ${TravelDesignTokens.typography.fontSize.xl};
              font-weight: ${TravelDesignTokens.typography.fontWeight.bold};
              color: ${TravelDesignTokens.colors.primary[500]};
            ">
              ${hotel.price.currency} ${hotel.price.amount}
            </div>
            <div style="font-size: ${TravelDesignTokens.typography.fontSize.xs}; color: ${TravelDesignTokens.colors.neutral[600]};">
              per ${hotel.price.per}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Content -->
      <div style="padding: ${TravelDesignTokens.spacing.lg};">

        <!-- Header -->
        <div style="margin-bottom: ${TravelDesignTokens.spacing.sm};">
          <h3 style="
            font-size: ${TravelDesignTokens.typography.fontSize.xl};
            font-weight: ${TravelDesignTokens.typography.fontWeight.semibold};
            color: ${TravelDesignTokens.colors.neutral[900]};
            margin: 0 0 8px 0;
          ">
            ${hotel.name}
          </h3>

          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            ${config.showRating ? `
              <div style="display: flex; align-items: center; gap: 4px;">
                <span>${renderStars(hotel.rating)}</span>
                <span style="font-size: ${TravelDesignTokens.typography.fontSize.sm}; color: ${TravelDesignTokens.colors.neutral[600]};">
                  ${hotel.rating}.0
                </span>
              </div>
            ` : ''}

            ${config.showReviewScore && hotel.reviewScore ? `
              <div style="
                padding: 4px 8px;
                background: ${hotel.reviewScore >= 8 ? TravelDesignTokens.colors.emerald[500] : TravelDesignTokens.colors.sky[500]};
                color: white;
                border-radius: ${TravelDesignTokens.borderRadius.sm};
                font-size: ${TravelDesignTokens.typography.fontSize.sm};
                font-weight: ${TravelDesignTokens.typography.fontWeight.semibold};
              ">
                ${hotel.reviewScore}/10
              </div>
            ` : ''}

            <span style="font-size: ${TravelDesignTokens.typography.fontSize.sm}; color: ${TravelDesignTokens.colors.neutral[600]};">
              (${hotel.reviewCount} reviews)
            </span>
          </div>
        </div>

        <!-- Location -->
        <div style="
          margin-bottom: ${TravelDesignTokens.spacing.md};
          font-size: ${TravelDesignTokens.typography.fontSize.sm};
          color: ${TravelDesignTokens.colors.neutral[600]};
        ">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${TravelDesignTokens.colors.neutral[500]}">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span style="font-weight: ${TravelDesignTokens.typography.fontWeight.medium};">Location</span>
          </div>
          <div style="padding-left: 20px;">
            <div>${hotel.location.address}</div>
            <div>${hotel.location.city}, ${hotel.location.country}</div>
            ${config.showDistance && hotel.location.distanceFromCenter ? `
              <div style="color: ${TravelDesignTokens.colors.sky[600]}; margin-top: 4px;">
                ${hotel.location.distanceFromCenter} from center
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Amenities -->
        ${config.showAmenities && hotel.amenities.length > 0 ? `
          <div style="
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: ${TravelDesignTokens.spacing.md};
          ">
            ${renderAmenities()}
          </div>
        ` : ''}

        <!-- Cancellation Policy -->
        ${config.showCancellationPolicy ? `
          <div style="
            padding: 10px 14px;
            background: ${hotel.cancellationPolicy === 'free' ? TravelDesignTokens.colors.emerald[50] : hotel.cancellationPolicy === 'partial' ? TravelDesignTokens.colors.amber[50] : TravelDesignTokens.colors.rose[50]};
            border-left: 3px solid ${hotel.cancellationPolicy === 'free' ? TravelDesignTokens.colors.emerald[500] : hotel.cancellationPolicy === 'partial' ? TravelDesignTokens.colors.amber[500] : TravelDesignTokens.colors.rose[500]};
            border-radius: ${TravelDesignTokens.borderRadius.sm};
            font-size: ${TravelDesignTokens.typography.fontSize.sm};
            color: ${TravelDesignTokens.colors.neutral[700]};
            margin-bottom: ${TravelDesignTokens.spacing.md};
            font-weight: ${TravelDesignTokens.typography.fontWeight.medium};
          ">
            ${hotel.cancellationPolicy === 'free' ? 'Free cancellation' : hotel.cancellationPolicy === 'partial' ? 'Partial refund available' : 'Non-refundable'}
          </div>
        ` : ''}

        <!-- Price (Bottom Position) -->
        ${config.pricePosition === 'bottom' ? `
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: ${TravelDesignTokens.spacing.md};
            border-top: 1px solid ${TravelDesignTokens.colors.neutral[200]};
          ">
            <div>
              <div style="
                font-size: ${TravelDesignTokens.typography.fontSize['2xl']};
                font-weight: ${TravelDesignTokens.typography.fontWeight.bold};
                color: ${TravelDesignTokens.colors.primary[500]};
              ">
                ${hotel.price.currency} ${hotel.price.amount}
              </div>
              <div style="
                font-size: ${TravelDesignTokens.typography.fontSize.sm};
                color: ${TravelDesignTokens.colors.neutral[600]};
              ">
                per ${hotel.price.per}
              </div>
            </div>
            <button style="
              padding: 12px 24px;
              background: ${TravelDesignTokens.colors.primary[500]};
              color: white;
              border: none;
              border-radius: ${TravelDesignTokens.borderRadius.lg};
              font-size: ${TravelDesignTokens.typography.fontSize.base};
              font-weight: ${TravelDesignTokens.typography.fontWeight.semibold};
              cursor: pointer;
              transition: background 0.2s;
            ">
              Book Now
            </button>
          </div>
        ` : ''}

      </div>
    </div>
  `;
}
