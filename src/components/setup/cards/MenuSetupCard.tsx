/**
 * MenuSetupCard Component
 * Ensures minimum menu items exist before POS can be used
 */

import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, ArrowRight, Plus } from 'lucide-react';
import { SetupCardBase } from '../SetupCardBase';
import { useMenuStore } from '../../../stores/menuStore';
import { useHasMinimumMenu } from '../../../stores/setupWizardStore';
import { cn } from '../../../lib/utils';

export function MenuSetupCard() {
  const navigate = useNavigate();
  const { items, categories } = useMenuStore();
  const completed = useHasMinimumMenu();

  const itemCount = items.length;
  const categoryCount = categories.length;
  const remaining = Math.max(0, 3 - itemCount);

  return (
    <SetupCardBase
      id="menu-setup"
      title="Add Your First Menu Items"
      description="Add at least 3 menu items to start taking orders"
      icon={UtensilsCrossed}
      completed={completed}
      required={true}
      completionMessage={`${itemCount} menu items added ✓`}
    >
      <div className="space-y-6">
        {/* Help Text */}
        <p className="text-sm text-gray-400">
          💡 Add menu items so your staff can start taking orders. You can always add more later!
        </p>

        {/* Current Status */}
        <div className="p-6 rounded-xl bg-gradient-to-br from-surface-2 to-surface border border-border">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <div className={cn(
                "text-4xl font-bold mb-1",
                itemCount >= 3 ? "text-green-400" : "text-amber-400"
              )}>
                {itemCount}
              </div>
              <div className="text-sm text-gray-400">Menu Items</div>
              {itemCount > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  across {categoryCount} {categoryCount === 1 ? 'category' : 'categories'}
                </div>
              )}
            </div>
            <div>
              <div className={cn(
                "text-4xl font-bold mb-1",
                remaining === 0 ? "text-green-400" : "text-amber-400"
              )}>
                {remaining}
              </div>
              <div className="text-sm text-gray-400">More Needed</div>
              {remaining === 0 && (
                <div className="text-xs text-green-500 mt-1">
                  Ready to go! ✓
                </div>
              )}
            </div>
          </div>

          {remaining > 0 && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                <p className="text-sm text-center text-amber-400 font-semibold">
                  Add {remaining} more item{remaining !== 1 ? 's' : ''} to continue
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {itemCount > 0 && itemCount < 3 && (
          <div>
            <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
              <span>Progress</span>
              <span>{Math.round((itemCount / 3) * 100)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-saffron to-paprika transition-all duration-500"
                style={{ width: `${(itemCount / 3) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={() => navigate('/menu')}
          className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-paprika to-saffron text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span>Go to Menu Management</span>
          <ArrowRight className="w-5 h-5" />
        </button>

        {/* Help Section */}
        <div className="space-y-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-start gap-3">
            <div className="text-2xl">📸</div>
            <div>
              <div className="font-bold text-sm text-blue-300 mb-1">Quick Upload</div>
              <div className="text-xs text-gray-400">
                Upload your menu as PDF, Excel, or photos. Our AI will automatically extract items!
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-2xl">✏️</div>
            <div>
              <div className="font-bold text-sm text-blue-300 mb-1">Manual Entry</div>
              <div className="text-xs text-gray-400">
                Or add items one by one with full control over pricing, categories, and descriptions.
              </div>
            </div>
          </div>
        </div>

        {/* Tip */}
        <div className="text-xs text-gray-500 text-center">
          💡 Tip: Start with your most popular items. You can add more anytime from the menu page.
        </div>
      </div>
    </SetupCardBase>
  );
}
