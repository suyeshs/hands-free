/**
 * Flight Card Primitive
 * Displays flight information with airline, route, price, and details
 */

import type { FlightCardConfig, Flight } from '../types';
import { TravelDesignTokens } from '../design-tokens';

/**
 * Create a flight card component configuration
 */
export function createFlightCard(
  overrides?: Partial<FlightCardConfig>
): FlightCardConfig {
  return {
    id: 'flight-card',
    name: 'Flight Card',
    type: 'card',
    componentType: 'flight-card',
    displayMode: 'standard',
    showAirlineLogo: true,
    showAircraft: true,
    showBaggage: true,
    showAmenities: true,
    highlightBestValue: true,
    pricePosition: 'right',
    dimensions: {
      width: '100%',
      height: 'auto',
      minHeight: '180px',
    },
    padding: {
      top: TravelDesignTokens.spacing.lg,
      right: TravelDesignTokens.spacing.lg,
      bottom: TravelDesignTokens.spacing.lg,
      left: TravelDesignTokens.spacing.lg,
    },
    margin: {
      top: TravelDesignTokens.spacing.sm,
      bottom: TravelDesignTokens.spacing.sm,
    },
    shadow: {
      offsetX: 0,
      offsetY: 4,
      blur: 12,
      spread: 0,
      color: 'rgba(0, 0, 0, 0.08)',
      inset: false,
    },
    backgroundColor: TravelDesignTokens.colors.neutral[50],
    borderRadius: TravelDesignTokens.borderRadius.lg,
    border: {
      width: 1,
      color: TravelDesignTokens.colors.neutral[200],
      style: 'solid',
    },
    classNames: {
      container: 'flight-card-container hover:shadow-lg transition-shadow duration-300',
      header: 'flight-card-header',
      segment: 'flight-card-segment',
      price: 'flight-card-price',
    },
    ...overrides,
  };
}

/**
 * Render flight card as HTML string (for server-side rendering)
 */
export function renderFlightCard(
  flight: Flight,
  config: FlightCardConfig = createFlightCard()
): string {
  const { displayMode, showAirlineLogo, showBaggage, showAmenities, pricePosition } = config;

  const firstSegment = flight.segments[0];
  const lastSegment = flight.segments[flight.segments.length - 1];

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatDuration = (duration: string) => {
    return duration.replace('PT', '').replace('H', 'h ').replace('M', 'm');
  };

  const isCompact = displayMode === 'compact';
  const isDetailed = displayMode === 'detailed';

  return `
    <div class="${config.classNames?.container || ''}"
         style="
           padding: ${config.padding?.top} ${config.padding?.right} ${config.padding?.bottom} ${config.padding?.left};
           background-color: ${config.backgroundColor};
           border-radius: ${config.borderRadius};
           border: ${config.border?.width}px ${config.border?.style} ${config.border?.color};
           box-shadow: ${config.shadow?.offsetX}px ${config.shadow?.offsetY}px ${config.shadow?.blur}px ${config.shadow?.spread}px ${config.shadow?.color};
           margin: ${config.margin?.top} ${config.margin?.bottom};
         ">

      <!-- Best Value Badge -->
      ${config.highlightBestValue && flight.price.amount < 500 ? `
        <div style="
          position: absolute;
          top: -8px;
          right: 16px;
          background: ${TravelDesignTokens.colors.emerald[500]};
          color: white;
          padding: 4px 12px;
          border-radius: ${TravelDesignTokens.borderRadius.full};
          font-size: ${TravelDesignTokens.typography.fontSize.xs};
          font-weight: ${TravelDesignTokens.typography.fontWeight.semibold};
        ">
          Best Value
        </div>
      ` : ''}

      <div style="display: flex; align-items: center; justify-content: space-between; gap: 24px;">

        <!-- Flight Route Section -->
        <div style="flex: 1; display: flex; align-items: center; gap: 16px;">

          <!-- Airline Logo -->
          ${showAirlineLogo && firstSegment.airline.logo ? `
            <img
              src="${firstSegment.airline.logo}"
              alt="${firstSegment.airline.name}"
              style="width: 40px; height: 40px; object-fit: contain;"
            />
          ` : ''}

          <!-- Route Details -->
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 8px;">

              <!-- Departure -->
              <div style="text-align: left;">
                <div style="
                  font-size: ${TravelDesignTokens.typography.fontSize['2xl']};
                  font-weight: ${TravelDesignTokens.typography.fontWeight.bold};
                  color: ${TravelDesignTokens.colors.neutral[900]};
                ">
                  ${formatTime(firstSegment.departure.time)}
                </div>
                <div style="
                  font-size: ${TravelDesignTokens.typography.fontSize.sm};
                  color: ${TravelDesignTokens.colors.neutral[600]};
                ">
                  ${firstSegment.departure.airport.code}
                </div>
              </div>

              <!-- Flight Path -->
              <div style="flex: 1; text-align: center;">
                <div style="
                  font-size: ${TravelDesignTokens.typography.fontSize.xs};
                  color: ${TravelDesignTokens.colors.neutral[500]};
                  margin-bottom: 4px;
                ">
                  ${formatDuration(flight.totalDuration)}
                </div>
                <div style="position: relative; height: 2px; background: ${TravelDesignTokens.colors.neutral[300]};">
                  <div style="
                    position: absolute;
                    top: -3px;
                    left: 0;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: ${TravelDesignTokens.colors.sky[500]};
                  "></div>
                  <div style="
                    position: absolute;
                    top: -5px;
                    right: 0;
                    width: 0;
                    height: 0;
                    border-left: 6px solid ${TravelDesignTokens.colors.sky[500]};
                    border-top: 6px solid transparent;
                    border-bottom: 6px solid transparent;
                  "></div>
                </div>
                ${flight.stops > 0 ? `
                  <div style="
                    font-size: ${TravelDesignTokens.typography.fontSize.xs};
                    color: ${TravelDesignTokens.colors.amber[600]};
                    margin-top: 4px;
                  ">
                    ${flight.stops} stop${flight.stops > 1 ? 's' : ''}
                  </div>
                ` : `
                  <div style="
                    font-size: ${TravelDesignTokens.typography.fontSize.xs};
                    color: ${TravelDesignTokens.colors.emerald[600]};
                    margin-top: 4px;
                  ">
                    Direct
                  </div>
                `}
              </div>

              <!-- Arrival -->
              <div style="text-align: right;">
                <div style="
                  font-size: ${TravelDesignTokens.typography.fontSize['2xl']};
                  font-weight: ${TravelDesignTokens.typography.fontWeight.bold};
                  color: ${TravelDesignTokens.colors.neutral[900]};
                ">
                  ${formatTime(lastSegment.arrival.time)}
                </div>
                <div style="
                  font-size: ${TravelDesignTokens.typography.fontSize.sm};
                  color: ${TravelDesignTokens.colors.neutral[600]};
                ">
                  ${lastSegment.arrival.airport.code}
                </div>
              </div>

            </div>

            <!-- Airline & Flight Number -->
            <div style="
              display: flex;
              align-items: center;
              gap: 12px;
              font-size: ${TravelDesignTokens.typography.fontSize.sm};
              color: ${TravelDesignTokens.colors.neutral[600]};
            ">
              <span>${firstSegment.airline.name} • ${firstSegment.flightNumber}</span>
              ${isDetailed && showAircraft && firstSegment.aircraft ? `
                <span>• ${firstSegment.aircraft}</span>
              ` : ''}
              <span style="
                padding: 2px 8px;
                background: ${TravelDesignTokens.colors.flightClass[flight.segments[0].class].bg};
                color: ${TravelDesignTokens.colors.flightClass[flight.segments[0].class].text};
                border-radius: ${TravelDesignTokens.borderRadius.sm};
                font-size: ${TravelDesignTokens.typography.fontSize.xs};
                text-transform: capitalize;
              ">
                ${flight.segments[0].class.replace(/([A-Z])/g, ' $1').trim()}
              </span>
            </div>
          </div>
        </div>

        <!-- Price Section -->
        ${pricePosition === 'right' ? `
          <div style="text-align: right;">
            <div style="
              font-size: ${TravelDesignTokens.typography.fontSize['3xl']};
              font-weight: ${TravelDesignTokens.typography.fontWeight.bold};
              color: ${TravelDesignTokens.colors.primary[500]};
            ">
              ${flight.price.currency} ${flight.price.amount.toFixed(2)}
            </div>
            <div style="
              font-size: ${TravelDesignTokens.typography.fontSize.sm};
              color: ${TravelDesignTokens.colors.neutral[600]};
              margin-top: 4px;
            ">
              per person
            </div>
            ${flight.seatsAvailable <= 5 ? `
              <div style="
                font-size: ${TravelDesignTokens.typography.fontSize.xs};
                color: ${TravelDesignTokens.colors.rose[600]};
                margin-top: 8px;
              ">
                Only ${flight.seatsAvailable} seats left
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>

      <!-- Additional Details (Detailed Mode) -->
      ${isDetailed ? `
        <div style="
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid ${TravelDesignTokens.colors.neutral[200]};
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
        ">

          ${showBaggage ? `
            <div style="
              display: flex;
              align-items: center;
              gap: 16px;
              padding: 8px 12px;
              background: ${TravelDesignTokens.colors.neutral[100]};
              border-radius: ${TravelDesignTokens.borderRadius.sm};
            ">
              <div style="font-size: ${TravelDesignTokens.typography.fontSize.sm}; color: ${TravelDesignTokens.colors.neutral[600]};">
                <span style="font-weight: ${TravelDesignTokens.typography.fontWeight.semibold};">Cabin:</span> ${flight.cabinBaggage.weight}${flight.cabinBaggage.unit}
              </div>
              <div style="width: 1px; height: 16px; background: ${TravelDesignTokens.colors.neutral[300]};"></div>
              <div style="font-size: ${TravelDesignTokens.typography.fontSize.sm}; color: ${TravelDesignTokens.colors.neutral[600]};">
                <span style="font-weight: ${TravelDesignTokens.typography.fontWeight.semibold};">Checked:</span> ${flight.checkedBaggage.pieces} × ${flight.checkedBaggage.weight}${flight.checkedBaggage.unit}
              </div>
            </div>
          ` : ''}

          ${showAmenities && flight.amenities.length > 0 ? `
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              ${flight.amenities.slice(0, 3).map(amenity => `
                <span style="
                  padding: 4px 8px;
                  background: ${TravelDesignTokens.colors.sky[100]};
                  color: ${TravelDesignTokens.colors.sky[700]};
                  border-radius: ${TravelDesignTokens.borderRadius.sm};
                  font-size: ${TravelDesignTokens.typography.fontSize.xs};
                ">
                  ${amenity}
                </span>
              `).join('')}
            </div>
          ` : ''}

          ${flight.refundable ? `
            <div style="
              padding: 6px 12px;
              background: ${TravelDesignTokens.colors.emerald[100]};
              color: ${TravelDesignTokens.colors.emerald[700]};
              border-radius: ${TravelDesignTokens.borderRadius.sm};
              font-size: ${TravelDesignTokens.typography.fontSize.xs};
              font-weight: ${TravelDesignTokens.typography.fontWeight.semibold};
              text-transform: uppercase;
              letter-spacing: 0.5px;
            ">
              Refundable
            </div>
          ` : ''}

        </div>
      ` : ''}

      <!-- Price at Bottom (Alternative Position) -->
      ${pricePosition === 'bottom' && !isCompact ? `
        <div style="
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid ${TravelDesignTokens.colors.neutral[200]};
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div style="
            font-size: ${TravelDesignTokens.typography.fontSize['2xl']};
            font-weight: ${TravelDesignTokens.typography.fontWeight.bold};
            color: ${TravelDesignTokens.colors.primary[500]};
          ">
            ${flight.price.currency} ${flight.price.amount.toFixed(2)}
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
          ">
            Select Flight
          </button>
        </div>
      ` : ''}

    </div>
  `;
}

/**
 * Generate Tailwind CSS classes for flight card
 */
export function getFlightCardClasses(config: FlightCardConfig): string {
  const classes = [
    'flight-card',
    'bg-white',
    'rounded-xl',
    'border',
    'border-gray-200',
    'shadow-md',
    'hover:shadow-lg',
    'transition-shadow',
    'duration-300',
    'p-6',
    'relative',
  ];

  if (config.displayMode === 'compact') {
    classes.push('p-4');
  } else if (config.displayMode === 'detailed') {
    classes.push('p-8');
  }

  return classes.join(' ');
}
