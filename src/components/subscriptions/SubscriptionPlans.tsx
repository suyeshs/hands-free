/**
 * Subscription Plans Management Component
 * Create and manage subscription plan configurations
 *
 * Features:
 * - List all subscription plans
 * - Create new plan with form
 * - Edit existing plans
 * - Toggle active/inactive status
 * - Delete plans (with confirmation)
 * - Display plan details (price, meals/week, delivery days, cuisines)
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Calendar,
  DollarSign,
  UtensilsCrossed,
  Clock,
  ChefHat,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { CreateSubscriptionPlanInput } from '../../types/subscription';

interface SubscriptionPlansProps {
  tenantId: string;
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

const CUISINE_OPTIONS = [
  { value: 'north_indian', label: 'North Indian', icon: '🍛' },
  { value: 'south_indian', label: 'South Indian', icon: '🥘' },
  { value: 'chinese', label: 'Chinese', icon: '🥢' },
  { value: 'continental', label: 'Continental', icon: '🍝' },
  { value: 'children_menu', label: "Children's Menu", icon: '🍕' },
];

export function SubscriptionPlans({ tenantId }: SubscriptionPlansProps) {
  const {
    plans,
    loadPlans,
    createPlan,
    updatePlan,
    deletePlan,
    togglePlanActive,
    isLoading,
    error,
  } = useSubscriptionStore();

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPricePerWeek, setFormPricePerWeek] = useState('');
  const [formMealsPerWeek, setFormMealsPerWeek] = useState('');
  const [formDeliveryDays, setFormDeliveryDays] = useState<string[]>([]);
  const [formCuisineTypes, setFormCuisineTypes] = useState<string[]>([]);
  const [formMealSelectionLimit, setFormMealSelectionLimit] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load plans on mount
  useEffect(() => {
    loadPlans(tenantId);
  }, [tenantId]);

  // Reset form
  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormPricePerWeek('');
    setFormMealsPerWeek('');
    setFormDeliveryDays([]);
    setFormCuisineTypes([]);
    setFormMealSelectionLimit('');
    setEditingPlanId(null);
  };

  // Open create modal
  const handleCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  // Open edit modal
  const handleEdit = (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    setFormName(plan.name);
    setFormDescription(plan.description || '');
    setFormPricePerWeek(plan.pricePerWeek.toString());
    setFormMealsPerWeek(plan.mealsPerWeek.toString());
    setFormDeliveryDays(plan.deliveryDays);
    setFormCuisineTypes(plan.cuisineTypes || []);
    setFormMealSelectionLimit(plan.mealSelectionLimit.toString());
    setEditingPlanId(planId);
    setIsModalOpen(true);
  };

  // Toggle delivery day
  const toggleDeliveryDay = (day: string) => {
    setFormDeliveryDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Toggle cuisine type
  const toggleCuisineType = (cuisine: string) => {
    setFormCuisineTypes((prev) =>
      prev.includes(cuisine) ? prev.filter((c) => c !== cuisine) : [...prev, cuisine]
    );
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const input: CreateSubscriptionPlanInput = {
      name: formName,
      description: formDescription,
      pricePerWeek: parseFloat(formPricePerWeek),
      mealsPerWeek: parseInt(formMealsPerWeek),
      deliveryDays: formDeliveryDays,
      cuisineTypes: formCuisineTypes,
      mealSelectionLimit: parseInt(formMealSelectionLimit),
    };

    setIsSaving(true);
    try {
      if (editingPlanId) {
        await updatePlan(editingPlanId, input);
      } else {
        await createPlan(tenantId, input);
      }
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error('Failed to save plan:', err);
    } finally {
      setIsSaving(false);
    }
  };

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
          onClick={handleCreate}
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
            onClick={handleCreate}
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
                    onClick={() => handleEdit(plan.id)}
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

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => !isSaving && setIsModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card p-6 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-border shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground">
                  {editingPlanId ? 'Edit Plan' : 'Create New Plan'}
                </h2>
                <button
                  onClick={() => !isSaving && setIsModalOpen(false)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Plan Name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Plan Name *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., 5-Day Weekday Plan"
                    required
                    className={cn(
                      'w-full px-4 py-2 rounded-lg',
                      'bg-input text-foreground',
                      'border border-border',
                      'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
                      'placeholder:text-muted-foreground'
                    )}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Description
                  </label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Brief description of the plan..."
                    rows={2}
                    className={cn(
                      'w-full px-4 py-2 rounded-lg',
                      'bg-input text-foreground',
                      'border border-border',
                      'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
                      'placeholder:text-muted-foreground resize-none'
                    )}
                  />
                </div>

                {/* Price and Meals Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Price per Week (₹) *
                    </label>
                    <input
                      type="number"
                      value={formPricePerWeek}
                      onChange={(e) => setFormPricePerWeek(e.target.value)}
                      placeholder="2000"
                      required
                      min="0"
                      step="1"
                      className={cn(
                        'w-full px-4 py-2 rounded-lg',
                        'bg-input text-foreground',
                        'border border-border',
                        'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
                        'placeholder:text-muted-foreground'
                      )}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Meals per Week *
                    </label>
                    <input
                      type="number"
                      value={formMealsPerWeek}
                      onChange={(e) => setFormMealsPerWeek(e.target.value)}
                      placeholder="5"
                      required
                      min="1"
                      className={cn(
                        'w-full px-4 py-2 rounded-lg',
                        'bg-input text-foreground',
                        'border border-border',
                        'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
                        'placeholder:text-muted-foreground'
                      )}
                    />
                  </div>
                </div>

                {/* Meal Selection Limit */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Meal Selection Limit *
                  </label>
                  <input
                    type="number"
                    value={formMealSelectionLimit}
                    onChange={(e) => setFormMealSelectionLimit(e.target.value)}
                    placeholder="5"
                    required
                    min="1"
                    className={cn(
                      'w-full px-4 py-2 rounded-lg',
                      'bg-input text-foreground',
                      'border border-border',
                      'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
                      'placeholder:text-muted-foreground'
                    )}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Maximum number of meals customers can select per week
                  </p>
                </div>

                {/* Delivery Days */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">
                    Delivery Days * (Select at least one)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDeliveryDay(day.value)}
                        className={cn(
                          'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                          formDeliveryDays.includes(day.value)
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        )}
                      >
                        {day.label.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cuisine Types */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">
                    Available Cuisines (Optional)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {CUISINE_OPTIONS.map((cuisine) => (
                      <button
                        key={cuisine.value}
                        type="button"
                        onClick={() => toggleCuisineType(cuisine.value)}
                        className={cn(
                          'px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                          formCuisineTypes.includes(cuisine.value)
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        )}
                      >
                        <span>{cuisine.icon}</span>
                        <span>{cuisine.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => !isSaving && setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || formDeliveryDays.length === 0}
                    className={cn(
                      'btn-primary flex-1 px-4 py-2 rounded-lg font-medium transition-all',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {isSaving ? 'Saving...' : editingPlanId ? 'Update Plan' : 'Create Plan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
