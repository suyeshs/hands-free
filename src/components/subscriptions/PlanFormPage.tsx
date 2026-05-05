/**
 * Subscription Plan Form Page
 * Standalone page for creating or editing subscription plans
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Save,
  Calendar,
  DollarSign,
  UtensilsCrossed,
  ChefHat,
  Check,
  AlertCircle,
  Package,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { CreateSubscriptionPlanInput } from '../../types/subscription';
import { useTenantStore } from '../../stores/tenantStore';
import { useAuthStore } from '../../stores/authStore';
import { useMenuStore } from '../../stores/menuStore';

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

export function PlanFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('id');
  const { tenant } = useTenantStore();
  const { user } = useAuthStore();
  const tenantId = tenant?.tenantId || user?.tenantId || '';

  const {
    plans,
    loadPlans,
    createPlan,
    updatePlan,
    isLoading,
    error,
  } = useSubscriptionStore();

  const { items: menuItems, loadMenuFromDatabase } = useMenuStore();
  const [hasCheckedMenu, setHasCheckedMenu] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPricePerWeek, setFormPricePerWeek] = useState('');
  const [formMealsPerWeek, setFormMealsPerWeek] = useState('');
  const [formDeliveryDays, setFormDeliveryDays] = useState<string[]>([]);
  const [formCuisineTypes, setFormCuisineTypes] = useState<string[]>([]);
  const [formMealSelectionLimit, setFormMealSelectionLimit] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Check if menu items exist
  useEffect(() => {
    if (!hasCheckedMenu) {
      loadMenuFromDatabase().finally(() => setHasCheckedMenu(true));
    }
  }, [hasCheckedMenu, loadMenuFromDatabase]);

  // Load plans if editing
  useEffect(() => {
    if (planId && plans.length === 0) {
      loadPlans(tenantId);
    }
  }, [planId, tenantId, loadPlans]);

  // Load form data if editing
  useEffect(() => {
    if (planId && plans.length > 0) {
      const plan = plans.find((p) => p.id === planId);
      if (plan) {
        setFormName(plan.name);
        setFormDescription(plan.description || '');
        setFormPricePerWeek(plan.pricePerWeek.toString());
        setFormMealsPerWeek(plan.mealsPerWeek.toString());
        setFormDeliveryDays(plan.deliveryDays);
        setFormCuisineTypes(plan.cuisineTypes || []);
        setFormMealSelectionLimit(plan.mealSelectionLimit.toString());
      }
    }
  }, [planId, plans]);

  const toggleDeliveryDay = (day: string) => {
    setFormDeliveryDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const toggleCuisineType = (cuisine: string) => {
    setFormCuisineTypes((prev) =>
      prev.includes(cuisine) ? prev.filter((c) => c !== cuisine) : [...prev, cuisine]
    );
  };

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
      if (planId) {
        await updatePlan(planId, input);
      } else {
        await createPlan(tenantId, input);
      }
      navigate('/subscriptions/plans');
    } catch (err) {
      console.error('Failed to save plan:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Show loading while checking menu
  if (!hasCheckedMenu) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Checking menu items...</p>
        </div>
      </div>
    );
  }

  // Show warning if no menu items exist
  if (!planId && menuItems.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card border-b border-border">
          <div className="px-4 md:px-8 py-4 md:py-5">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/subscriptions/plans')}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Create New Plan</h1>
                <p className="text-sm text-muted-foreground">Menu items required</p>
              </div>
            </div>
          </div>
        </div>

        {/* No Menu Warning */}
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-8 rounded-xl border-2 border-amber-500/30 bg-amber-500/5"
          >
            <div className="flex flex-col items-center text-center gap-6">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-amber-500" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-foreground mb-3">
                  Import Menu Items First
                </h2>
                <p className="text-muted-foreground mb-6 max-w-md">
                  You need to import menu items before creating subscription plans.
                  The menu is used to create weekly menus for your subscribers.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <button
                  onClick={() => navigate('/subscriptions/import')}
                  className={cn(
                    'px-6 py-3 rounded-lg font-medium transition-all',
                    'bg-gradient-to-br from-primary to-primary',
                    'text-white shadow-lg shadow-primary/30',
                    'hover:shadow-primary/50',
                    'flex items-center justify-center gap-2'
                  )}
                >
                  <Package className="w-5 h-5" />
                  Import Menu Items
                </button>

                <button
                  onClick={() => navigate('/subscriptions/plans')}
                  className="px-6 py-3 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors font-medium"
                >
                  Go Back
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="px-4 md:px-8 py-4 md:py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/subscriptions/plans')}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {planId ? 'Edit Plan' : 'Create New Plan'}
              </h1>
              <p className="text-sm text-muted-foreground">
                Configure subscription plan details and pricing
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <section className="glass-panel p-6 rounded-xl border border-border">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary flex items-center justify-center">
                <UtensilsCrossed className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Basic Information</h2>
                <p className="text-sm text-muted-foreground">Plan name and description</p>
              </div>
            </div>

            <div className="space-y-4">
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
                    'w-full px-4 py-3 rounded-lg',
                    'bg-input text-foreground',
                    'border border-border',
                    'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
                    'placeholder:text-muted-foreground'
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description of the plan..."
                  rows={3}
                  className={cn(
                    'w-full px-4 py-3 rounded-lg',
                    'bg-input text-foreground',
                    'border border-border',
                    'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
                    'placeholder:text-muted-foreground resize-none'
                  )}
                />
              </div>
            </div>
          </section>

          {/* Pricing & Meals */}
          <section className="glass-panel p-6 rounded-xl border border-border">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Pricing & Meals</h2>
                <p className="text-sm text-muted-foreground">Set pricing and meal quantities</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    'w-full px-4 py-3 rounded-lg',
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
                    'w-full px-4 py-3 rounded-lg',
                    'bg-input text-foreground',
                    'border border-border',
                    'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
                    'placeholder:text-muted-foreground'
                  )}
                />
              </div>

              <div className="md:col-span-2">
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
                    'w-full px-4 py-3 rounded-lg',
                    'bg-input text-foreground',
                    'border border-border',
                    'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
                    'placeholder:text-muted-foreground'
                  )}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Maximum number of meals customers can select per week
                </p>
              </div>
            </div>
          </section>

          {/* Delivery Days */}
          <section className="glass-panel p-6 rounded-xl border border-border">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Delivery Schedule</h2>
                <p className="text-sm text-muted-foreground">Select delivery days (at least one)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDeliveryDay(day.value)}
                  className={cn(
                    'px-4 py-3 rounded-lg text-sm font-medium transition-all',
                    'border-2',
                    formDeliveryDays.includes(day.value)
                      ? 'bg-primary border-primary text-white shadow-lg shadow-primary/30'
                      : 'bg-muted border-border text-muted-foreground hover:border-primary/30'
                  )}
                >
                  <div className="flex items-center justify-center gap-2">
                    {formDeliveryDays.includes(day.value) && (
                      <Check className="w-4 h-4" />
                    )}
                    {day.label}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Cuisine Types */}
          <section className="glass-panel p-6 rounded-xl border border-border">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <ChefHat className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Available Cuisines</h2>
                <p className="text-sm text-muted-foreground">Optional - Select cuisine types</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CUISINE_OPTIONS.map((cuisine) => (
                <button
                  key={cuisine.value}
                  type="button"
                  onClick={() => toggleCuisineType(cuisine.value)}
                  className={cn(
                    'px-4 py-3 rounded-lg text-sm font-medium transition-all',
                    'border-2 flex items-center gap-3',
                    formCuisineTypes.includes(cuisine.value)
                      ? 'bg-primary border-primary text-white shadow-lg shadow-primary/30'
                      : 'bg-muted border-border text-muted-foreground hover:border-primary/30'
                  )}
                >
                  <span className="text-lg">{cuisine.icon}</span>
                  <span className="flex-1 text-left">{cuisine.label}</span>
                  {formCuisineTypes.includes(cuisine.value) && (
                    <Check className="w-4 h-4" />
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => navigate('/subscriptions/plans')}
              disabled={isSaving}
              className="flex-1 px-6 py-3 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || formDeliveryDays.length === 0}
              className={cn(
                'flex-1 px-6 py-3 rounded-lg font-medium transition-all',
                'bg-gradient-to-br from-primary to-primary',
                'text-white shadow-lg shadow-primary/30',
                'hover:shadow-primary/50',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2'
              )}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {planId ? 'Update Plan' : 'Create Plan'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
