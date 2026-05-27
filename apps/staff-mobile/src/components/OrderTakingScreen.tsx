import { useState, useEffect, useCallback } from 'react'
import { ShoppingCart, Plus, Minus, Trash2, Send, Loader, Check, AlertCircle, ChevronDown } from 'lucide-react'
import { usePosStore } from '../stores/posStore'
import { useDeviceAuthStore } from '../stores/deviceAuthStore'
import { fetchPosMenu, placeOrder } from '../lib/posApi'
import type { PosMenuCategory, PosMenuItem, OrderItem } from '../lib/posApi'
import './OrderTakingScreen.css'

interface CartItem extends OrderItem {
  category: string
}

type SubmitState = 'idle' | 'loading' | 'success' | 'error'

export default function OrderTakingScreen() {
  const { posUrl } = usePosStore()
  const { currentUser } = useDeviceAuthStore()

  const [categories, setCategories] = useState<PosMenuCategory[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [tableNumber, setTableNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [menuLoading, setMenuLoading] = useState(true)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [lastOrderId, setLastOrderId] = useState<string | null>(null)

  // Load menu from POS on mount
  useEffect(() => {
    if (!posUrl) return
    setMenuLoading(true)
    setMenuError(null)
    fetchPosMenu(posUrl)
      .then((res) => {
        setCategories(res.categories)
        if (res.categories.length > 0) setActiveCategory(res.categories[0].name)
      })
      .catch((err) => setMenuError(err.message ?? 'Failed to load menu'))
      .finally(() => setMenuLoading(false))
  }, [posUrl])

  const activeItems: PosMenuItem[] =
    categories.find((c) => c.name === activeCategory)?.items ?? []

  // Cart helpers
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)

  const addItem = useCallback((item: PosMenuItem, category: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item_id === item.item_id)
      if (existing) {
        return prev.map((c) =>
          c.item_id === item.item_id ? { ...c, quantity: c.quantity + 1 } : c
        )
      }
      return [...prev, { item_id: item.item_id, name: item.name, price: item.price, quantity: 1, category }]
    })
  }, [])

  const changeQty = useCallback((itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.item_id === itemId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    )
  }, [])

  const cartQty = (itemId: string) => cart.find((c) => c.item_id === itemId)?.quantity ?? 0

  const handleSubmit = async () => {
    if (!posUrl || cart.length === 0 || !tableNumber.trim()) return
    setSubmitState('loading')
    try {
      const result = await placeOrder(posUrl, {
        table_number: tableNumber.trim(),
        items: cart.map(({ item_id, name, price, quantity, notes: n }) => ({
          item_id, name, price, quantity, notes: n,
        })),
        special_instructions: notes.trim() || undefined,
        staff_id: currentUser?.id,
      })
      setLastOrderId(result.order_id)
      setSubmitState('success')
      setCart([])
      setNotes('')
      setCartOpen(false)
      // Reset to idle after 3s
      setTimeout(() => { setSubmitState('idle'); setLastOrderId(null) }, 3000)
    } catch (err: any) {
      setSubmitState('error')
      setTimeout(() => setSubmitState('idle'), 3000)
    }
  }

  if (!posUrl) {
    return (
      <div className="order-screen-empty">
        <AlertCircle size={40} className="empty-icon" />
        <p>No POS connection set up.</p>
        <p className="empty-sub">Go to Settings → Connect POS to enter the POS address.</p>
      </div>
    )
  }

  if (menuLoading) {
    return (
      <div className="order-screen-empty">
        <Loader size={32} className="spin" />
        <p>Loading menu from POS…</p>
      </div>
    )
  }

  if (menuError) {
    return (
      <div className="order-screen-empty">
        <AlertCircle size={36} className="empty-icon error" />
        <p>Could not load menu</p>
        <p className="empty-sub">{menuError}</p>
        <button className="retry-btn" onClick={() => window.location.reload()}>Retry</button>
      </div>
    )
  }

  return (
    <div className="order-screen">
      {/* ── Table number bar ── */}
      <div className="order-topbar">
        <input
          className="table-input"
          type="text"
          inputMode="numeric"
          placeholder="Table #"
          value={tableNumber}
          onChange={(e) => setTableNumber(e.target.value)}
          maxLength={4}
        />
        <button
          className={`cart-fab tap-feedback ${cartCount > 0 ? 'has-items' : ''}`}
          onClick={() => setCartOpen(true)}
          disabled={cartCount === 0}
        >
          <ShoppingCart size={20} />
          {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
        </button>
      </div>

      {/* ── Category tabs ── */}
      <div className="category-tabs">
        {categories.map((cat) => (
          <button
            key={cat.name}
            className={`cat-tab tap-feedback ${cat.name === activeCategory ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.name)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* ── Menu grid ── */}
      <div className="menu-grid">
        {activeItems.map((item) => {
          const qty = cartQty(item.item_id)
          return (
            <div key={item.item_id} className={`menu-item glass ${qty > 0 ? 'in-cart' : ''}`}>
              {item.is_veg !== undefined && (
                <span className={`veg-dot ${item.is_veg ? 'veg' : 'non-veg'}`} />
              )}
              <div className="item-name">{item.name}</div>
              <div className="item-price">₹{item.price}</div>
              {qty === 0 ? (
                <button
                  className="add-btn tap-feedback"
                  onClick={() => addItem(item, activeCategory)}
                >
                  <Plus size={16} />
                </button>
              ) : (
                <div className="qty-row">
                  <button className="qty-btn tap-feedback" onClick={() => changeQty(item.item_id, -1)}>
                    <Minus size={14} />
                  </button>
                  <span className="qty-num">{qty}</span>
                  <button className="qty-btn tap-feedback" onClick={() => changeQty(item.item_id, 1)}>
                    <Plus size={14} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Cart drawer ── */}
      {cartOpen && (
        <div className="cart-overlay" onClick={() => setCartOpen(false)}>
          <div className="cart-drawer glass" onClick={(e) => e.stopPropagation()}>
            <div className="cart-handle">
              <ChevronDown size={20} onClick={() => setCartOpen(false)} />
              <span className="cart-title">Order — Table {tableNumber || '?'}</span>
            </div>

            <div className="cart-items">
              {cart.map((item) => (
                <div key={item.item_id} className="cart-row">
                  <span className="cart-item-name">{item.name}</span>
                  <div className="cart-item-right">
                    <div className="qty-row small">
                      <button className="qty-btn tap-feedback" onClick={() => changeQty(item.item_id, -1)}>
                        <Minus size={12} />
                      </button>
                      <span className="qty-num">{item.quantity}</span>
                      <button className="qty-btn tap-feedback" onClick={() => changeQty(item.item_id, 1)}>
                        <Plus size={12} />
                      </button>
                    </div>
                    <span className="cart-item-price">₹{(item.price * item.quantity).toFixed(0)}</span>
                    <button className="remove-btn tap-feedback" onClick={() => changeQty(item.item_id, -item.quantity)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <textarea
              className="notes-input"
              placeholder="Special instructions…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />

            <div className="cart-footer">
              <span className="cart-total">₹{cartTotal.toFixed(0)}</span>
              <button
                className={`submit-btn tap-feedback ${submitState}`}
                onClick={handleSubmit}
                disabled={submitState === 'loading' || !tableNumber.trim() || cart.length === 0}
              >
                {submitState === 'loading' && <Loader size={16} className="spin" />}
                {submitState === 'success' && <Check size={16} />}
                {submitState === 'error' && <AlertCircle size={16} />}
                {submitState === 'idle' && <Send size={16} />}
                {submitState === 'idle' && 'Place Order'}
                {submitState === 'loading' && 'Sending…'}
                {submitState === 'success' && `Sent! #${lastOrderId}`}
                {submitState === 'error' && 'Failed — retry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success toast ── */}
      {submitState === 'success' && (
        <div className="order-toast success">
          <Check size={16} /> Order #{lastOrderId} sent to kitchen
        </div>
      )}
    </div>
  )
}
