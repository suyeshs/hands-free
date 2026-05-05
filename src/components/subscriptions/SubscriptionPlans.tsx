/**
 * Subscription Plans Management Component
 * List and manage subscription plan configurations
 *
 * Features:
 * - List all subscription plans
 * - Navigate to create/edit plan pages
 * - Toggle active/inactive status
 * - Delete plans (with confirmation)
 * - Display plan details (price, meals/week, delivery days, cuisines)
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Edit2,
  Trash2,
  Calendar,
  UtensilsCrossed,
  ChefHat,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSubscriptionStore } from '../../stores/subscriptionStore';

interface SubscriptionPlansProps {
  tenantId: string;
}

export function SubscriptionPlans({ tenantId }: SubscriptionPlansProps) {
  const navigate = useNavigate();
  const {
    plans,
    loadPlans,
    deletePlan,
    togglePlanActive,
    isLoading,
    error,
  } = useSubscriptionStore();

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Load plans on mount
  useEffect(() => {
    loadPlans(tenantId);
  }, [tenantId, loadPlans]);

  // Delete plan
  const handleDelete = async (planId: string) => {
    try {
      await deletePlan(planId);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Failed to delete plan:', err);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            📋 Subscription Plans
          </h1>
          <p className="text-muted-foreground">
            Configure meal subscription plans for your customers
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/subscriptions/plans/new')}
          className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create New Plan
        </motion.button>
      </div>

      {/* Error message */}
      {error && (
        <div className="status-error p-4 rounded-lg">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Plans Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : plans.length === 0 ? (
        <div className="glass-panel p-12 text-center border border-border rounded-lg">
          <UtensilsCrossed className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No subscription plans yet
          </h3>
          <p className="text-muted-foreground mb-4">
            Create your first subscription plan to get started
          </p>
          <button
            onClick={() => navigate('/subscriptions/plans/new')}
            className="btn-primary px-4 py-2 rounded-lg transition-colors"
          >
            Create Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'glass-panel p-6 rounded-xl border-2 transition-all',
                plan.active ? 'border-primary/30 shadow-lg' : 'border-border'
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-foreground mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/subscriptions/plans/edit?id=${plan.id}`)}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-muted-foreground hover:text-primary" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(plan.id)}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>

              {/* Price */}
              <div className="mb-4 pb-4 border-b border-border">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-primary">
                    ₹{plan.pricePerWeek}
                  </span>
                  <span className="text-sm text-muted-foreground">/week</span>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <UtensilsCrossed className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">
                    {plan.mealsPerWeek} meals per week
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">
                    {plan.deliveryDays.length} delivery days
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <ChefHat className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">
                    {plan.cuisineTypes?.length || 0} cuisines
                  </span>
                </div>
              </div>

              {/* Delivery Days Tags */}
              <div className="flex flex-wrap gap-1 mb-4">
                {plan.deliveryDays.slice(0, 3).map((day) => (
                  <span
                    key={day}
                    className="px-2 py-1 bg-muted text-xs text-muted-foreground rounded"
                  >
                    {day.substring(0, 3)}
                  </span>
                ))}
                {plan.deliveryDays.length > 3 && (
                  <span className="px-2 py-1 bg-muted text-xs text-muted-foreground rounded">
                    +{plan.deliveryDays.length - 3}
                  </span>
                )}
              </div>

              {/* Active Toggle */}
              <button
                onClick={() => togglePlanActive(plan.id)}
                className={cn(
                  'w-full py-2 rounded-lg font-medium text-sm transition-all',
                  plan.active
                    ? 'status-success hover:opacity-90'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {plan.active ? '✓ Active' : '⏸ Inactive'}
              </button>

              {/* Delete Confirmation */}
              <AnimatePresence>
                {deleteConfirmId === plan.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 p-3 status-error rounded-lg"
                  >
                    <p className="text-sm mb-3">
                      Delete this plan? This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(plan.id)}
                        className="flex-1 px-3 py-2 bg-destructive text-white text-sm rounded hover:bg-destructive/90 transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="flex-1 px-3 py-2 bg-muted text-foreground text-sm rounded hover:bg-muted/80 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
