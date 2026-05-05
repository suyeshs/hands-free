/**
 * Destination Carousel Primitive
 * Swipeable destination discovery carousel
 */

import type { DestinationCarouselConfig } from '../types';
import { TravelDesignTokens } from '../design-tokens';

export function createDestinationCarousel(overrides?: Partial<DestinationCarouselConfig>): DestinationCarouselConfig {
  return {
    id: 'destination-carousel',
    name: 'Destination Carousel',
    type: 'list',
    componentType: 'destination-carousel',
    layout: 'horizontal',
    itemsPerView: 3,
    showNavigation: true,
    showPagination: false,
    autoplay: false,
    loop: true,
    cardStyle: 'image-overlay',
    showPrice: true,
    dimensions: { width: '100%', height: 'auto' },
    padding: { top: TravelDesignTokens.spacing.xl, right: '0', bottom: TravelDesignTokens.spacing.xl, left: '0' },
    ...overrides,
  };
}

export function renderDestinationCarousel(destinations: Array<{ name: string; image: string; price?: string }>, config: DestinationCarouselConfig = createDestinationCarousel()): string {
  return `
    <div style="padding: ${config.padding?.top} ${config.padding?.right} ${config.padding?.bottom} ${config.padding?.left};">
      <div style="
        display: flex;
        gap: ${TravelDesignTokens.spacing.lg};
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      " class="destination-carousel">
        ${destinations.map(dest => `
          <div style="
            flex: 0 0 ${config.itemsPerView === 'auto' ? 'auto' : `calc((100% - ${TravelDesignTokens.spacing.lg} * ${config.itemsPerView - 1}) / ${config.itemsPerView})`};
            scroll-snap-align: start;
            position: relative;
            border-radius: ${TravelDesignTokens.borderRadius.xl};
            overflow: hidden;
            cursor: pointer;
            min-width: 280px;
          " class="destination-card">
            <img src="${dest.image}" alt="${dest.name}" style="width: 100%; height: 320px; object-fit: cover;" />
            ${config.cardStyle === 'image-overlay' ? `
              <div style="
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                padding: ${TravelDesignTokens.spacing.xl};
                background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
                color: white;
              ">
                <h3 style="
                  font-size: ${TravelDesignTokens.typography.fontSize['2xl']};
                  font-weight: ${TravelDesignTokens.typography.fontWeight.bold};
                  margin: 0 0 8px 0;
                ">${dest.name}</h3>
                ${config.showPrice && dest.price ? `
                  <div style="font-size: ${TravelDesignTokens.typography.fontSize.lg};">From ${dest.price}</div>
                ` : ''}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>

    <style>
      .destination-carousel::-webkit-scrollbar { display: none; }
    </style>
  `;
}
