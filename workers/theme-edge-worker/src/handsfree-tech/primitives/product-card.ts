/**
 * Product Card Primitive
 * Tech product showcase card with glassmorphism and glow effects
 */

import { HandsfreeDesignTokens } from '../design-tokens';
import type { ProductCardConfig, TechProduct } from '../types';

const tokens = HandsfreeDesignTokens;

/**
 * Create product card configuration
 */
export function createProductCard(
  overrides?: Partial<ProductCardConfig>
): ProductCardConfig {
  return {
    id: overrides?.id || 'product-card',
    name: overrides?.name || 'Tech Product Card',
    showImage: overrides?.showImage ?? true,
    imageHeight: overrides?.imageHeight || '240px',
    showGradient: overrides?.showGradient ?? true,
    gradientType: overrides?.gradientType || 'holographic',
    showCTA: overrides?.showCTA ?? true,
    ctaStyle: overrides?.ctaStyle || 'primary',
    hoverEffect: overrides?.hoverEffect || 'glow',
    borderStyle: overrides?.borderStyle || 'gradient',
  };
}

/**
 * Render product card HTML
 */
export function renderProductCard(
  product: TechProduct,
  config: ProductCardConfig
): string {
  const gradientBg = config.showGradient
    ? `linear-gradient(135deg, ${tokens.colors.primary[900]}, ${tokens.colors.accent[900]})`
    : tokens.colors.background.dark;

  const borderStyle = config.borderStyle === 'gradient'
    ? `border-image: linear-gradient(135deg, ${tokens.colors.primary[500]}, ${tokens.colors.accent[500]}) 1;`
    : config.borderStyle === 'glass'
    ? `border: 1px solid ${tokens.colors.border.light};`
    : `border: 1px solid ${tokens.colors.border.default};`;

  const hoverClass = config.hoverEffect;

  return `
    <div class="product-card ${hoverClass}-hover" style="
      position: relative;
      background: ${gradientBg};
      border-radius: ${tokens.borderRadius['2xl']};
      ${borderStyle}
      padding: ${tokens.spacing[6]};
      overflow: hidden;
      transition: all ${tokens.animation.normal} ${tokens.easing.standard};
      cursor: pointer;
    ">
      ${config.showGradient ? `
        <div style="
          position: absolute;
          top: -50%;
          right: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, ${tokens.colors.primary[500]}20 0%, transparent 70%);
          pointer-events: none;
        "></div>
      ` : ''}

      ${config.showImage && product.image ? `
        <div style="
          width: 100%;
          height: ${config.imageHeight};
          border-radius: ${tokens.borderRadius.lg};
          overflow: hidden;
          margin-bottom: ${tokens.spacing[4]};
          background: ${tokens.colors.background.darker};
        ">
          <img src="${product.image}" alt="${product.name}" style="
            width: 100%;
            height: 100%;
            object-fit: cover;
          "/>
        </div>
      ` : ''}

      <div style="position: relative; z-index: 1;">
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: ${tokens.spacing[3]};
        ">
          <h3 style="
            font-size: ${tokens.typography.fontSize['2xl']};
            font-weight: ${tokens.typography.fontWeight.bold};
            color: ${tokens.colors.text.primary};
            margin: 0;
            font-family: ${tokens.typography.fontFamily.display};
          ">${product.name}</h3>

          ${product.status ? `
            <span style="
              padding: ${tokens.spacing[1]} ${tokens.spacing[3]};
              background: ${
                product.status === 'beta'
                  ? tokens.colors.accent[500]
                  : product.status === 'stable'
                  ? tokens.colors.success[500]
                  : tokens.colors.neutral[600]
              };
              color: ${tokens.colors.text.primary};
              border-radius: ${tokens.borderRadius.full};
              font-size: ${tokens.typography.fontSize.xs};
              font-weight: ${tokens.typography.fontWeight.semibold};
              text-transform: uppercase;
              letter-spacing: ${tokens.typography.letterSpacing.wide};
            ">${product.status}</span>
          ` : ''}
        </div>

        ${product.tagline ? `
          <p style="
            font-size: ${tokens.typography.fontSize.lg};
            font-weight: ${tokens.typography.fontWeight.medium};
            color: ${tokens.colors.text.secondary};
            margin: 0 0 ${tokens.spacing[3]} 0;
          ">${product.tagline}</p>
        ` : ''}

        <p style="
          font-size: ${tokens.typography.fontSize.base};
          color: ${tokens.colors.text.secondary};
          line-height: ${tokens.typography.lineHeight.relaxed};
          margin: 0 0 ${tokens.spacing[4]} 0;
        ">${product.description}</p>

        ${product.tags.length > 0 ? `
          <div style="
            display: flex;
            flex-wrap: wrap;
            gap: ${tokens.spacing[2]};
            margin-bottom: ${tokens.spacing[4]};
          ">
            ${product.tags.map(tag => `
              <span style="
                padding: ${tokens.spacing[1]} ${tokens.spacing[3]};
                background: ${tokens.glassmorphism.dark.background};
                backdrop-filter: ${tokens.glassmorphism.dark.backdropFilter};
                border: ${tokens.glassmorphism.dark.border};
                color: ${tokens.colors.text.secondary};
                border-radius: ${tokens.borderRadius.base};
                font-size: ${tokens.typography.fontSize.sm};
                font-weight: ${tokens.typography.fontWeight.medium};
              ">${tag}</span>
            `).join('')}
          </div>
        ` : ''}

        ${config.showCTA ? `
          <button style="
            width: 100%;
            padding: ${tokens.spacing[3]} ${tokens.spacing[6]};
            background: ${
              config.ctaStyle === 'primary'
                ? `linear-gradient(135deg, ${tokens.colors.primary[500]}, ${tokens.colors.accent[500]})`
                : config.ctaStyle === 'secondary'
                ? tokens.colors.background.light
                : 'transparent'
            };
            color: ${tokens.colors.text.primary};
            border: ${config.ctaStyle === 'ghost' ? `1px solid ${tokens.colors.border.accent}` : 'none'};
            border-radius: ${tokens.borderRadius.lg};
            font-size: ${tokens.typography.fontSize.base};
            font-weight: ${tokens.typography.fontWeight.semibold};
            cursor: pointer;
            transition: all ${tokens.animation.normal} ${tokens.easing.standard};
            font-family: ${tokens.typography.fontFamily.primary};
          ">
            Explore Product
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Get CSS classes for product card
 */
export function getProductCardClasses(): string {
  return `
    .product-card {
      will-change: transform, box-shadow;
    }

    .glow-hover:hover {
      transform: scale(1.02) translateY(-4px);
      box-shadow: ${tokens.shadows.glowBlue};
    }

    .lift-hover:hover {
      transform: scale(1.05) translateY(-8px);
      box-shadow: ${tokens.shadows.xl};
    }

    .scale-hover:hover {
      transform: scale(1.05);
      box-shadow: ${tokens.shadows.lg};
    }

    @media (prefers-reduced-motion: reduce) {
      .product-card {
        transition: none;
      }

      .product-card:hover {
        transform: none;
      }
    }
  `;
}
