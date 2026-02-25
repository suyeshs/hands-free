'use client';

import { observer } from 'mobx-react-lite';
import { cartStore } from '@/app/stores/cartStore';

const FloatingActions = observer(function FloatingActions() {
  const itemCount = cartStore.itemCount;
  const total = cartStore.total;

  return (
    <div className="floating-actions">
      {itemCount > 0 && (
        <div className="cart-pill">
          <span className="cart-icon">🛒</span>
          <span className="cart-count">{itemCount}</span>
          <span className="cart-total">₹{total}</span>
        </div>
      )}
      <div className="voice-fab">🎤</div>
    </div>
  );
});

export default FloatingActions;
