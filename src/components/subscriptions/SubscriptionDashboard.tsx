/**
 * Subscription Dashboard Component
 * Main overview for subscription meals service
 *
 * Features:
 * - Real-time subscription statistics
 * - Today's deliveries grouped by time slot
 * - This week's delivery calendar
 * - Revenue metrics (MRR, weekly revenue)
 * - Quick actions for common tasks
 * - Tower-wise distribution chart
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  Users,
  TrendingUp,
  Truck,
  DollarSign,
  Clock,
  Package,
  AlertCircle,
  ChevronRight,
  Building2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { cardVariants } from '../../lib/motion/variants';

interface SubscriptionDashboardProps {
  tenantId: string;
}

export function SubscriptionDashboard({ tenantId }: SubscriptionDashboardProps) {
  const navigate = useNavigate();
  const {
    stats,
    deliveries,
    loadStats,
    loadDeliveries,
    isLoading,
    error,
  } = useSubscriptionStore();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Load dashboard data
  useEffect(() => {
    loadStats(tenantId);
    loadDeliveries(tenantId, { date: selectedDate });
  }, [tenantId, selectedDate]);

  // Group deliveries by time slot
  const deliveriesByTimeSlot = deliveries.reduce((acc, delivery) => {
    const slot = delivery.scheduledTimeSlot;
    if (!acc[slot]) {
      acc[slot] = [];
    }
    acc[slot].push(delivery);
    return acc;
  }, {} as Record<string, typeof deliveries>);

  // Stats cards configuration
  const statsCards = [
    {
      id: 'subscribers',
      title: 'Active Subscribers',
      value: stats?.activeSubscribers || 0,
      subValue: `${stats?.pausedSubscribers || 0} paused`,
      icon: Users,
      color: 'purple',
      path: '/subscriptions/customers',
    },
    {
      id: 'today-deliveries',
      title: "Today's Deliveries",
      value: stats?.todayDeliveries || 0,
      subValue: `${stats?.thisWeekDeliveries || 0} this week`,
      icon: Truck,
      color: 'blue',
      path: '/subscriptions/deliveries',
    },
    {
      id: 'weekly-revenue',
      title: 'Weekly Revenue',
      value: `₹${(stats?.weeklyRevenue || 0).toLocaleString()}`,
      subValue: `₹${(stats?.monthlyRevenue || 0).toLocaleString()} monthly`,
      icon: DollarSign,
      color: 'green',
      path: '/subscriptions/customers',
    },
    {
      id: 'churn-rate',
      title: 'Churn Rate',
      value: `${(stats?.churnRate || 0).toFixed(1)}%`,
      subValue: 'This month',
      icon: TrendingUp,
      color: stats?.churnRate && stats.churnRate > 10 ? 'red' : 'cyan',
      path: '/subscriptions/customers',
    },
  ];

  const accentColors = {
    purple: {
      gradient: 'from-purple-400 to-purple-600',
      shadow: 'shadow-purple-500/30',
      bg: 'bg-purple-50',
      text: 'text-purple-600',
    },
    blue: {
      gradient: 'from-blue-400 to-blue-600',
      shadow: 'shadow-blue-500/30',
      bg: 'bg-blue-50',
      text: 'text-blue-600',
    },
    green: {
      gradient: 'from-emerald-400 to-emerald-600',
      shadow: 'shadow-emerald-500/30',
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
    },
    red: {
      gradient: 'from-red-400 to-red-600',
      shadow: 'shadow-red-500/30',
      bg: 'bg-red-50',
      text: 'text-red-600',
    },
    cyan: {
      gradient: 'from-cyan-400 to-cyan-600',
      shadow: 'shadow-cyan-500/30',
      bg: 'bg-cyan-50',
      text: 'text-cyan-600',
    },
  };

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Loading subscription dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3 text-red-500">
          <AlertCircle className="w-12 h-12" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-warm-white mb-2">
            📦 Subscription Dashboard
          </h1>
          <p className="text-gray-400">
            Manage weekly meal subscriptions for your gated community
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/subscriptions/menu')}
            className={cn(
              'px-4 py-2 rounded-lg',
              'bg-gradient-to-br from-purple-500 to-purple-600',
              'text-white font-medium text-sm',
              'shadow-lg shadow-purple-500/30',
              'hover:shadow-purple-500/50 transition-all'
            )}
          >
            📅 Manage Weekly Menu
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/subscriptions/plans')}
            className={cn(
              'px-4 py-2 rounded-lg',
              'glass-panel-dark',
              'text-warm-white font-medium text-sm',
              'hover:bg-white/5 transition-all'
            )}
          >
            ⚙️ Manage Plans
          </motion.button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card, index) => {
          const Icon = card.icon;
          const colors = accentColors[card.color as keyof typeof accentColors];

          return (
            <motion.div
              key={card.id}
              variants={cardVariants}
              initial="initial"
              animate="animate"
              whileHover="hover"
              custom={index}
              onClick={() => navigate(card.path)}
              className={cn(
                'glass-panel-dark p-5',
                'cursor-pointer group',
                'transition-all duration-300'
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center',
                    'bg-gradient-to-br',
                    colors.gradient,
                    'shadow-lg',
                    colors.shadow
                  )}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-purple-400 transition-colors" />
              </div>

              <div>
                <p className="text-2xl font-bold text-warm-white mb-1">
                  {card.value}
                </p>
                <p className="text-xs text-gray-400 mb-2">{card.title}</p>
                <p className="text-xs text-gray-500">{card.subValue}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Deliveries */}
        <div className="lg:col-span-2 glass-panel-dark p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-warm-white">Today's Deliveries</h2>
                <p className="text-sm text-gray-400">Grouped by time slot</p>
              </div>
            </div>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={cn(
                'px-3 py-2 rounded-lg',
                'glass-panel text-warm-white text-sm',
                'border border-white/10',
                'focus:outline-none focus:border-purple-500'
              )}
            />
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {Object.keys(deliveriesByTimeSlot).length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No deliveries scheduled for this date</p>
              </div>
            ) : (
              Object.entries(deliveriesByTimeSlot).map(([timeSlot, slotDeliveries]) => (
                <div
                  key={timeSlot}
                  className="glass-panel p-4 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-purple-400">
                      🕐 {timeSlot}
                    </span>
                    <span className="text-xs text-gray-500">
                      {slotDeliveries.length} deliveries
                    </span>
                  </div>

                  <div className="space-y-2">
                    {slotDeliveries.slice(0, 3).map((delivery) => (
                      <div
                        key={delivery.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-300">
                            Tower {delivery.towerNumber}, Apt {delivery.apartmentNumber}
                          </span>
                        </div>
                        <span
                          className={cn(
                            'px-2 py-1 rounded text-xs font-medium',
                            delivery.status === 'scheduled' && 'bg-blue-500/20 text-blue-400',
                            delivery.status === 'preparing' && 'bg-yellow-500/20 text-yellow-400',
                            delivery.status === 'out_for_delivery' && 'bg-orange-500/20 text-orange-400',
                            delivery.status === 'delivered' && 'bg-green-500/20 text-green-400'
                          )}
                        >
                          {delivery.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))}

                    {slotDeliveries.length > 3 && (
                      <button
                        onClick={() => navigate('/subscriptions/deliveries')}
                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        +{slotDeliveries.length - 3} more deliveries →
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-white/10">
            <button
              onClick={() => navigate('/subscriptions/deliveries')}
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium"
            >
              View Full Delivery Schedule →
            </button>
          </div>
        </div>

        {/* Quick Stats Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Week */}
          <div className="glass-panel-dark p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-warm-white">This Week</h3>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Total Deliveries</span>
                <span className="text-sm font-semibold text-warm-white">
                  {stats?.thisWeekDeliveries || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Active Subscribers</span>
                <span className="text-sm font-semibold text-warm-white">
                  {stats?.activeSubscribers || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Avg. Revenue/User</span>
                <span className="text-sm font-semibold text-warm-white">
                  ₹{(stats?.averageRevenuePerUser || 0).toFixed(0)}
                </span>
              </div>
            </div>
          </div>

          {/* Order Cutoff Reminder */}
          <div className="glass-panel-dark p-6 border border-yellow-500/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-yellow-400 mb-1">
                  Order Cutoff Reminder
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Next week's orders close on <span className="font-semibold text-warm-white">Sunday at 12:00 PM</span>.
                  Make sure customers have selected their meals!
                </p>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-2">
            <button
              onClick={() => navigate('/subscriptions/customers')}
              className="w-full glass-panel p-3 rounded-lg hover:bg-white/5 transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300 group-hover:text-warm-white transition-colors">
                  👥 View All Customers
                </span>
                <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-purple-400 transition-colors" />
              </div>
            </button>

            <button
              onClick={() => navigate('/subscriptions/browse')}
              className="w-full glass-panel p-3 rounded-lg hover:bg-white/5 transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300 group-hover:text-warm-white transition-colors">
                  🌐 Customer Portal Preview
                </span>
                <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-purple-400 transition-colors" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
