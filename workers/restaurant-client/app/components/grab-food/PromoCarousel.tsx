'use client';

import { useTheme } from '../../contexts/ThemeContext';

export default function PromoCarousel() {
  const { theme } = useTheme();

  // Get promos from theme or fallback to defaults
  // We check for theme.components.promoCarousel.items
  const themePromos = (theme as any)?.components?.promoCarousel?.items;

  const defaultPromos = [
    { title: '50% OFF', desc: 'On your first order', code: 'FIRST50', gradient: 'linear-gradient(135deg, var(--grab-green), var(--grab-green-hover))' },
    { title: 'Free Delivery', desc: 'Orders above ₹200', code: 'FREEDEL', gradient: 'linear-gradient(135deg, #ff6c31, #ff8a5b)' },
    { title: 'Buy 1 Get 1', desc: 'Selected items', code: 'BOGO', gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)' },
  ];

  const promos = (themePromos && themePromos.length > 0) ? themePromos : defaultPromos;

  return (
    <div className="promo-carousel">
      <div className="promo-slides">
        {promos.map((promo: any, i: number) => (
          <div key={i} className="promo-slide" style={{ background: promo.gradient || promo.backgroundColor || 'var(--grab-green)' }}>
            <div>
              <h3>{promo.title}</h3>
              <p>{promo.description || promo.desc}</p>
            </div>
            {promo.code && <div className="promo-code">{promo.code}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
