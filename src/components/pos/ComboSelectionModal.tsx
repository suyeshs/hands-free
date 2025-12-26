/**
 * ComboSelectionModal Component
 * Industrial neomorphic design for service staff
 * Clear visual markers for selection/deselection
 */

import { useState, useMemo, useEffect } from 'react';
import { MenuItem, CartModifier, ComboSelection, ComboGroup } from '../../types/pos';
import { cn } from '../../lib/utils';

export interface ComboSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItem: MenuItem | null;
  onAddToCart: (
    menuItem: MenuItem,
    quantity: number,
    modifiers: CartModifier[],
    specialInstructions?: string,
    comboSelections?: ComboSelection[]
  ) => void;
}

export function ComboSelectionModal({
  isOpen,
  onClose,
  menuItem,
  onAddToCart,
}: ComboSelectionModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Set<string>>(new Set());
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [groupSelections, setGroupSelections] = useState<Record<string, Set<string>>>({});
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);

  const comboGroups = menuItem?.comboGroups || [];
  const hasComboGroups = comboGroups.length > 0;

  // Reset state when modal opens with new item
  useEffect(() => {
    if (isOpen && menuItem) {
      setQuantity(1);
      setSelectedModifiers(new Set());
      setSpecialInstructions('');
      setGroupSelections({});
      setActiveGroupIndex(0);
    }
  }, [isOpen, menuItem?.id]);

  // Handle selecting an item in a combo group
  const handleSelectComboItem = (groupId: string, itemId: string, maxSelections: number) => {
    setGroupSelections((prev) => {
      const current = prev[groupId] || new Set();
      const next = new Set(current);

      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        if (maxSelections === 1) {
          next.clear();
          next.add(itemId);
        } else if (next.size < maxSelections) {
          next.add(itemId);
        }
      }

      return { ...prev, [groupId]: next };
    });
  };

  const handleToggleModifier = (modifierId: string) => {
    setSelectedModifiers((prev) => {
      const next = new Set(prev);
      if (next.has(modifierId)) {
        next.delete(modifierId);
      } else {
        next.add(modifierId);
      }
      return next;
    });
  };

  // Check if all required groups have valid selections
  const isValidSelection = useMemo(() => {
    if (!menuItem || !hasComboGroups) return true;

    return comboGroups.every((group) => {
      if (!group.required) return true;
      const selections = groupSelections[group.id];
      const count = selections?.size || 0;
      return count >= group.minSelections && count <= group.maxSelections;
    });
  }, [menuItem, comboGroups, groupSelections, hasComboGroups]);

  // Calculate combo price adjustments
  const comboAdjustment = useMemo(() => {
    if (!menuItem) return 0;
    let adjustment = 0;
    comboGroups.forEach((group) => {
      const selections = groupSelections[group.id];
      if (selections) {
        selections.forEach((itemId) => {
          const item = group.items.find((i) => i.id === itemId);
          if (item) {
            adjustment += item.priceAdjustment;
          }
        });
      }
    });
    return adjustment;
  }, [menuItem, comboGroups, groupSelections]);

  // Early return after all hooks
  if (!menuItem || !isOpen) return null;

  const handleAddToCart = () => {
    const comboSelections: ComboSelection[] = comboGroups
      .map((group) => {
        const selections = groupSelections[group.id];
        if (!selections || selections.size === 0) return null;

        const selectedItems = Array.from(selections).map((itemId) => {
          const item = group.items.find((i) => i.id === itemId)!;
          return {
            id: item.id,
            name: item.name,
            priceAdjustment: item.priceAdjustment,
          };
        });

        return {
          groupId: group.id,
          groupName: group.name,
          selectedItems,
        };
      })
      .filter((s): s is ComboSelection => s !== null);

    const modifiers: CartModifier[] = menuItem.modifiers
      ? menuItem.modifiers
          .filter((mod) => selectedModifiers.has(mod.id))
          .map((mod) => ({
            id: mod.id,
            name: mod.name,
            price: mod.price,
          }))
      : [];

    onAddToCart(
      menuItem,
      quantity,
      modifiers,
      specialInstructions || undefined,
      comboSelections.length > 0 ? comboSelections : undefined
    );

    onClose();
  };

  const modifiersTotal = menuItem.modifiers
    ? menuItem.modifiers
        .filter((mod) => selectedModifiers.has(mod.id))
        .reduce((sum, mod) => sum + mod.price, 0)
    : 0;

  const itemTotal = (menuItem.price + modifiersTotal + comboAdjustment) * quantity;

  const getGroupSelectionCount = (groupId: string) => {
    return groupSelections[groupId]?.size || 0;
  };

  const isGroupComplete = (group: ComboGroup) => {
    const count = getGroupSelectionCount(group.id);
    return count >= group.minSelections;
  };

  const activeGroup = comboGroups[activeGroupIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col bg-[#1a1a1a] rounded-2xl border-2 border-zinc-700 shadow-[0_0_60px_rgba(0,0,0,0.8)]">

        {/* Header - Industrial Style */}
        <div className="flex-shrink-0 bg-gradient-to-b from-zinc-800 to-zinc-900 border-b-2 border-zinc-700 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Status Indicator */}
              <div className={cn(
                "w-4 h-4 rounded-full shadow-lg",
                isValidSelection
                  ? "bg-emerald-500 shadow-emerald-500/50 animate-pulse"
                  : "bg-amber-500 shadow-amber-500/50"
              )} />
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-wide">
                  {menuItem.name}
                </h2>
                <p className="text-xs text-zinc-400 font-mono uppercase tracking-widest">
                  COMBO CONFIGURATION
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-12 h-12 rounded-xl bg-zinc-800 border-2 border-zinc-600 flex items-center justify-center text-zinc-400 hover:text-white hover:border-red-500 hover:bg-red-500/20 transition-all active:scale-95"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Price Display */}
          <div className="mt-3 flex items-center gap-4">
            <div className="px-4 py-2 bg-zinc-900 rounded-lg border border-zinc-700">
              <span className="text-xs text-zinc-500 font-mono">BASE</span>
              <span className="ml-2 text-lg font-black text-emerald-400 font-mono">₹{menuItem.price}</span>
            </div>
            {comboAdjustment !== 0 && (
              <div className="px-4 py-2 bg-zinc-900 rounded-lg border border-zinc-700">
                <span className="text-xs text-zinc-500 font-mono">ADJ</span>
                <span className={cn(
                  "ml-2 text-lg font-black font-mono",
                  comboAdjustment > 0 ? "text-amber-400" : "text-emerald-400"
                )}>
                  {comboAdjustment > 0 ? '+' : ''}₹{comboAdjustment}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Group Navigation Tabs */}
        {hasComboGroups && (
          <div className="flex-shrink-0 bg-zinc-900 border-b-2 border-zinc-700 px-4 py-3">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {comboGroups.map((group, index) => {
                const isComplete = isGroupComplete(group);
                const isActive = activeGroupIndex === index;
                const selectionCount = getGroupSelectionCount(group.id);

                return (
                  <button
                    key={group.id}
                    onClick={() => setActiveGroupIndex(index)}
                    className={cn(
                      "relative flex-shrink-0 px-5 py-3 rounded-xl font-bold uppercase text-sm tracking-wide transition-all border-2",
                      isActive
                        ? "bg-zinc-700 border-zinc-500 text-white shadow-lg"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300",
                      isComplete && !isActive && "border-emerald-600/50"
                    )}
                  >
                    {/* Completion Indicator */}
                    <div className={cn(
                      "absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border-2",
                      isComplete
                        ? "bg-emerald-500 border-emerald-400 text-white"
                        : "bg-zinc-700 border-zinc-600 text-zinc-400"
                    )}>
                      {isComplete ? '✓' : selectionCount}
                    </div>

                    <span className="pr-4">{group.name}</span>

                    {/* Required Badge */}
                    {group.required && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-red-500/20 border border-red-500/50 rounded text-[8px] text-red-400 font-mono">
                        REQ
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Active Group Items Grid */}
          {activeGroup && (
            <div className="space-y-4">
              {/* Group Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 bg-emerald-500 rounded-full" />
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-wide">
                      {activeGroup.name}
                    </h3>
                    <p className="text-xs text-zinc-500 font-mono">
                      SELECT {activeGroup.minSelections === activeGroup.maxSelections
                        ? activeGroup.minSelections
                        : `${activeGroup.minSelections}-${activeGroup.maxSelections}`} ITEM{activeGroup.maxSelections > 1 ? 'S' : ''}
                    </p>
                  </div>
                </div>

                {/* Selection Counter */}
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-4 py-2 rounded-lg font-mono font-black text-lg border-2",
                    isGroupComplete(activeGroup)
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                      : "bg-zinc-800 border-zinc-600 text-zinc-400"
                  )}>
                    {getGroupSelectionCount(activeGroup.id)} / {activeGroup.maxSelections}
                  </span>
                </div>
              </div>

              {/* Items Grid - Large Touch Targets */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {activeGroup.items.map((item) => {
                  const isSelected = groupSelections[activeGroup.id]?.has(item.id);
                  const isVeg = item.tags?.includes('veg');
                  const isNonVeg = item.tags?.includes('non-veg');

                  return (
                    <button
                      key={item.id}
                      onClick={() =>
                        handleSelectComboItem(
                          activeGroup.id,
                          item.id,
                          activeGroup.maxSelections
                        )
                      }
                      disabled={!item.available}
                      className={cn(
                        "relative p-4 rounded-xl transition-all border-3 text-left group",
                        "min-h-[100px] flex flex-col justify-between",
                        isSelected
                          ? "bg-emerald-500/20 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                          : "bg-zinc-800 border-zinc-600 hover:border-zinc-400 hover:bg-zinc-700",
                        !item.available && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      {/* Selection Indicator - Large & Clear */}
                      <div className={cn(
                        "absolute -top-2 -right-2 w-8 h-8 rounded-lg flex items-center justify-center transition-all border-2",
                        isSelected
                          ? "bg-emerald-500 border-emerald-300 scale-110"
                          : "bg-zinc-700 border-zinc-500 group-hover:border-zinc-400"
                      )}>
                        {isSelected ? (
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <div className="w-3 h-3 rounded-sm border-2 border-zinc-500" />
                        )}
                      </div>

                      {/* Item Content */}
                      <div className="flex-1">
                        <div className="flex items-start gap-2">
                          {/* Veg/Non-veg indicator */}
                          {(isVeg || isNonVeg) && (
                            <div className={cn(
                              "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                              isVeg ? "border-emerald-500" : "border-red-500"
                            )}>
                              <div className={cn(
                                "w-2.5 h-2.5 rounded-full",
                                isVeg ? "bg-emerald-500" : "bg-red-500"
                              )} />
                            </div>
                          )}
                          <span className={cn(
                            "font-bold text-sm uppercase tracking-wide leading-tight",
                            isSelected ? "text-white" : "text-zinc-300"
                          )}>
                            {item.name}
                          </span>
                        </div>
                      </div>

                      {/* Price Adjustment Badge */}
                      <div className="mt-2">
                        <span className={cn(
                          "inline-block px-3 py-1 rounded-lg font-mono font-black text-sm border",
                          item.priceAdjustment > 0
                            ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                            : item.priceAdjustment < 0
                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                            : "bg-zinc-700 border-zinc-600 text-zinc-400"
                        )}>
                          {item.priceAdjustment > 0
                            ? `+₹${item.priceAdjustment}`
                            : item.priceAdjustment < 0
                            ? `-₹${Math.abs(item.priceAdjustment)}`
                            : 'INCLUDED'}
                        </span>
                      </div>

                      {/* Unavailable overlay */}
                      {!item.available && (
                        <div className="absolute inset-0 bg-zinc-900/80 rounded-xl flex items-center justify-center">
                          <span className="px-3 py-1 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-xs font-bold uppercase">
                            Unavailable
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Modifiers Section */}
          {menuItem.modifiers && menuItem.modifiers.length > 0 && (
            <div className="mt-6 pt-6 border-t-2 border-zinc-700">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-8 bg-amber-500 rounded-full" />
                <h3 className="text-lg font-black text-white uppercase tracking-wide">
                  Add-ons
                </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {menuItem.modifiers.map((modifier) => (
                  <button
                    key={modifier.id}
                    onClick={() => handleToggleModifier(modifier.id)}
                    disabled={!modifier.available}
                    className={cn(
                      "p-4 rounded-xl transition-all border-2 text-left",
                      selectedModifiers.has(modifier.id)
                        ? "bg-amber-500/20 border-amber-500"
                        : "bg-zinc-800 border-zinc-600 hover:border-zinc-400",
                      !modifier.available && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "font-bold uppercase text-sm",
                        selectedModifiers.has(modifier.id) ? "text-white" : "text-zinc-300"
                      )}>
                        {modifier.name}
                      </span>
                      <span className="font-mono font-bold text-amber-400">
                        +₹{modifier.price}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Special Instructions */}
          <div className="mt-6 pt-6 border-t-2 border-zinc-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-8 bg-blue-500 rounded-full" />
              <h3 className="text-sm font-black text-zinc-400 uppercase tracking-wide">
                Special Instructions
              </h3>
            </div>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Extra spicy, no onions, allergies..."
              className="w-full p-4 rounded-xl bg-zinc-800 border-2 border-zinc-600 text-white placeholder-zinc-500 font-medium resize-none focus:outline-none focus:border-zinc-400 transition-colors"
              rows={2}
            />
          </div>
        </div>

        {/* Footer - Fixed Action Bar */}
        <div className="flex-shrink-0 bg-gradient-to-t from-zinc-800 to-zinc-900 border-t-2 border-zinc-700 px-6 py-4 rounded-b-2xl">
          <div className="flex items-center justify-between gap-6">
            {/* Quantity Controls */}
            <div className="flex items-center gap-1 bg-zinc-800 rounded-xl border-2 border-zinc-600 p-1">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-12 h-12 rounded-lg bg-zinc-700 border-2 border-zinc-500 flex items-center justify-center text-white font-black text-2xl hover:bg-zinc-600 active:scale-95 transition-all"
              >
                −
              </button>
              <span className="w-16 text-center text-2xl font-black text-white font-mono">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-12 h-12 rounded-lg bg-zinc-700 border-2 border-zinc-500 flex items-center justify-center text-white font-black text-2xl hover:bg-zinc-600 active:scale-95 transition-all"
              >
                +
              </button>
            </div>

            {/* Validation Warning */}
            {!isValidSelection && (
              <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-amber-500/20 border-2 border-amber-500/50 rounded-xl">
                <svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-amber-400 text-sm font-bold uppercase">
                  Complete all required selections
                </span>
              </div>
            )}

            {/* Total & Add Button */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-zinc-500 font-mono uppercase">Total</p>
                <p className="text-3xl font-black text-white font-mono">
                  ₹{itemTotal.toFixed(0)}
                </p>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={!isValidSelection}
                className={cn(
                  "px-8 py-4 rounded-xl font-black text-lg uppercase tracking-wide transition-all border-2",
                  isValidSelection
                    ? "bg-emerald-500 border-emerald-400 text-white hover:bg-emerald-400 active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                    : "bg-zinc-700 border-zinc-600 text-zinc-500 cursor-not-allowed"
                )}
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
