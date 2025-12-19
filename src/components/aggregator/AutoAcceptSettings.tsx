/**
 * AutoAcceptSettings Component
 * Modal for configuring auto-accept rules for aggregator orders
 */

import { useState } from 'react';
import { GlassModal } from '../ui-v2/GlassModal';
import { NeoButton } from '../ui-v2/NeoButton';
import { useAggregatorSettingsStore } from '../../stores/aggregatorSettingsStore';
import { AutoAcceptRule } from '../../types/aggregatorSettings';
import { MenuCategory } from '../../types/pos';
import { AggregatorSource } from '../../types/aggregator';
import { cn } from '../../lib/utils';

export interface AutoAcceptSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const MENU_CATEGORIES: Array<{ value: MenuCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All Categories' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'appetizers', label: 'Appetizers' },
  { value: 'mains', label: 'Mains' },
  { value: 'sides', label: 'Sides' },
  { value: 'desserts', label: 'Desserts' },
  { value: 'specials', label: 'Specials' },
];

const AGGREGATORS: Array<{ value: AggregatorSource | 'all'; label: string }> = [
  { value: 'all', label: 'All Aggregators' },
  { value: 'zomato', label: 'Zomato' },
  { value: 'swiggy', label: 'Swiggy' },
];

export function AutoAcceptSettings({ isOpen, onClose }: AutoAcceptSettingsProps) {
  const {
    autoAcceptEnabled,
    showAcceptNotification,
    soundEnabled,
    defaultPrepTime,
    rules,
    setAutoAcceptEnabled,
    setShowAcceptNotification,
    setSoundEnabled,
    setDefaultPrepTime,
    addRule,
    updateRule,
    deleteRule,
    toggleRule,
  } = useAggregatorSettingsStore();

  const [isAddingRule, setIsAddingRule] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState<Partial<AutoAcceptRule>>({
    name: '',
    aggregator: 'all',
    category: 'all',
    prepTime: 20,
    priority: 5,
    enabled: true,
  });

  const handleSaveRule = () => {
    if (!ruleForm.name?.trim()) {
      alert('Please enter a rule name');
      return;
    }

    if (editingRuleId) {
      // Update existing rule
      updateRule(editingRuleId, ruleForm);
      setEditingRuleId(null);
    } else {
      // Add new rule
      addRule(ruleForm);
    }

    // Reset form
    setRuleForm({
      name: '',
      aggregator: 'all',
      category: 'all',
      prepTime: 20,
      priority: 5,
      enabled: true,
    });
    setIsAddingRule(false);
  };

  const handleEditRule = (rule: AutoAcceptRule) => {
    setRuleForm(rule);
    setEditingRuleId(rule.id);
    setIsAddingRule(true);
  };

  const handleCancelEdit = () => {
    setRuleForm({
      name: '',
      aggregator: 'all',
      category: 'all',
      prepTime: 20,
      priority: 5,
      enabled: true,
    });
    setEditingRuleId(null);
    setIsAddingRule(false);
  };

  const handleDeleteRule = (ruleId: string) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      deleteRule(ruleId);
    }
  };

  return (
    <GlassModal open={isOpen} onClose={onClose} title="Auto-Accept Settings" size="lg">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
        {/* Master Toggle */}
        <div className="neo-inset p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Auto-Accept Orders</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Automatically accept orders matching configured rules
              </p>
            </div>
            <button
              onClick={() => setAutoAcceptEnabled(!autoAcceptEnabled)}
              className={cn(
                'relative w-14 h-7 rounded-full transition-colors',
                autoAcceptEnabled ? 'bg-primary' : 'bg-muted'
              )}
            >
              <div
                className={cn(
                  'absolute top-1 w-5 h-5 rounded-full bg-white transition-transform',
                  autoAcceptEnabled ? 'translate-x-8' : 'translate-x-1'
                )}
              />
            </button>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="neo-inset p-4 rounded-lg space-y-3">
          <h3 className="font-semibold text-foreground">Notifications</h3>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-foreground">Show notification on auto-accept</span>
            <input
              type="checkbox"
              checked={showAcceptNotification}
              onChange={(e) => setShowAcceptNotification(e.target.checked)}
              className="w-5 h-5 rounded border-2 border-primary"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-foreground">Play sound on auto-accept</span>
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => setSoundEnabled(e.target.checked)}
              className="w-5 h-5 rounded border-2 border-primary"
            />
          </label>
        </div>

        {/* Default Prep Time */}
        <div className="neo-inset p-4 rounded-lg">
          <label className="block">
            <span className="font-semibold text-foreground">Default Prep Time (minutes)</span>
            <input
              type="number"
              min="5"
              max="120"
              value={defaultPrepTime}
              onChange={(e) => setDefaultPrepTime(parseInt(e.target.value) || 20)}
              className="mt-2 w-full p-2 rounded-lg neo-inset bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        {/* Rules Section */}
        <div className="neo-inset p-4 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Auto-Accept Rules</h3>
            {!isAddingRule && (
              <NeoButton
                variant="primary"
                size="sm"
                onClick={() => setIsAddingRule(true)}
              >
                + Add Rule
              </NeoButton>
            )}
          </div>

          {/* Rule Form */}
          {isAddingRule && (
            <div className="neo-raised p-4 rounded-lg space-y-4">
              <h4 className="font-medium text-foreground">
                {editingRuleId ? 'Edit Rule' : 'New Rule'}
              </h4>

              {/* Rule Name */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Rule Name
                </label>
                <input
                  type="text"
                  value={ruleForm.name || ''}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  placeholder="e.g., Auto-accept all beverages"
                  className="w-full p-2 rounded-lg neo-inset bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Aggregator Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Aggregator
                </label>
                <select
                  value={ruleForm.aggregator || 'all'}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, aggregator: e.target.value as any })
                  }
                  className="w-full p-2 rounded-lg neo-inset bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {AGGREGATORS.map((agg) => (
                    <option key={agg.value} value={agg.value}>
                      {agg.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Category
                </label>
                <select
                  value={ruleForm.category || 'all'}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, category: e.target.value as any })
                  }
                  className="w-full p-2 rounded-lg neo-inset bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {MENU_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prep Time */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Prep Time (minutes)
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={ruleForm.prepTime || 20}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, prepTime: parseInt(e.target.value) || 20 })
                  }
                  className="w-full p-2 rounded-lg neo-inset bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Priority (1-10, higher = evaluated first)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={ruleForm.priority || 5}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, priority: parseInt(e.target.value) || 5 })
                  }
                  className="w-full p-2 rounded-lg neo-inset bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <NeoButton variant="ghost" onClick={handleCancelEdit} className="flex-1">
                  Cancel
                </NeoButton>
                <NeoButton variant="primary" onClick={handleSaveRule} className="flex-1">
                  {editingRuleId ? 'Update Rule' : 'Add Rule'}
                </NeoButton>
              </div>
            </div>
          )}

          {/* Rules List */}
          <div className="space-y-2">
            {rules.length === 0 && !isAddingRule && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No rules configured. Add a rule to get started.
              </p>
            )}

            {rules.map((rule) => (
              <div
                key={rule.id}
                className={cn(
                  'neo-raised p-3 rounded-lg flex items-center justify-between',
                  !rule.enabled && 'opacity-50'
                )}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-foreground">{rule.name}</h4>
                    {!rule.enabled && (
                      <span className="text-xs text-muted-foreground">(Disabled)</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {AGGREGATORS.find((a) => a.value === rule.aggregator)?.label} •{' '}
                    {MENU_CATEGORIES.find((c) => c.value === rule.category)?.label} •{' '}
                    {rule.prepTime} min • Priority: {rule.priority}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className="p-2 rounded-lg neo-raised-sm hover:shadow-lg transition-neo"
                    title={rule.enabled ? 'Disable' : 'Enable'}
                  >
                    {rule.enabled ? '✓' : '○'}
                  </button>
                  <button
                    onClick={() => handleEditRule(rule)}
                    className="p-2 rounded-lg neo-raised-sm hover:shadow-lg transition-neo"
                    title="Edit"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-2 rounded-lg neo-raised-sm hover:shadow-lg transition-neo text-red-600"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Close Button */}
        <div className="flex justify-end">
          <NeoButton variant="primary" onClick={onClose}>
            Done
          </NeoButton>
        </div>
      </div>
    </GlassModal>
  );
}
