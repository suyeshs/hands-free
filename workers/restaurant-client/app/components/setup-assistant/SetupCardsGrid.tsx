'use client';

import { useSetupAssistant } from '../../contexts/SetupAssistantContext';
import { Utensils, Palette, Smartphone, Users, Check, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface SetupCard {
  id: 'menu' | 'theme' | 'pos' | 'customers';
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
}

const setupCards: SetupCard[] = [
  {
    id: 'menu',
    title: 'Menu Setup',
    description: 'Add your menu items, categories, and prices',
    icon: Utensils,
    href: '/admin/menu',
    color: '#22c55e',
  },
  {
    id: 'theme',
    title: 'Theme & Branding',
    description: 'Customize colors, fonts, and your restaurant look',
    icon: Palette,
    href: '/admin/theme',
    color: '#8b5cf6',
  },
  {
    id: 'pos',
    title: 'POS Setup',
    description: 'Download and configure point-of-sale app',
    icon: Smartphone,
    href: '/admin/setup',
    color: '#f59e0b',
  },
  {
    id: 'customers',
    title: 'Customer Manager',
    description: 'Import customers and create WhatsApp links',
    icon: Users,
    href: '/admin/customers',
    color: '#3b82f6',
  },
];

function ProgressRing({ progress, color }: { progress: number; color: string }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative w-12 h-12">
      <svg className="w-12 h-12 transform -rotate-90">
        {/* Background circle */}
        <circle
          cx="24"
          cy="24"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx="24"
          cy="24"
          r={radius}
          stroke={color}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset,
            transition: 'stroke-dashoffset 0.5s ease-in-out',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {progress === 100 ? (
          <Check className="w-5 h-5" style={{ color }} />
        ) : (
          <span className="text-xs font-semibold" style={{ color }}>
            {progress}%
          </span>
        )}
      </div>
    </div>
  );
}

export function SetupCardsGrid() {
  const { state, navigateToStep } = useSetupAssistant();
  const { progress, currentStep } = state;

  const overallProgress = Math.round(
    (progress.menu + progress.theme + progress.pos) / 3
  );

  const getProgress = (cardId: string) => {
    switch (cardId) {
      case 'menu': return progress.menu;
      case 'theme': return progress.theme;
      case 'pos': return progress.pos;
      case 'customers': return 0; // Customers doesn't have progress tracking
      default: return 0;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Restaurant Setup
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Complete these steps to get your restaurant up and running
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">Overall Progress</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{overallProgress}%</p>
          </div>
          <ProgressRing progress={overallProgress} color="#3b82f6" />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
          style={{ width: `${overallProgress}%` }}
        />
      </div>

      {/* Setup Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {setupCards.map((card) => {
          const Icon = card.icon;
          const cardProgress = getProgress(card.id);
          const isActive = currentStep === card.id;
          const isComplete = cardProgress === 100;

          return (
            <Link
              key={card.id}
              href={card.href}
              onClick={() => navigateToStep(card.id)}
              className={`
                group relative p-6 rounded-xl border-2 transition-all duration-200
                ${isActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : isComplete
                    ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                }
              `}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: `${card.color}20` }}
                >
                  <Icon className="w-6 h-6" style={{ color: card.color }} />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {card.title}
                    </h3>
                    {isComplete && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full">
                        Complete
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {card.description}
                  </p>

                  {/* Progress indicator for non-customer cards */}
                  {card.id !== 'customers' && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${cardProgress}%`,
                            backgroundColor: card.color,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-500">
                        {cardProgress}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
              </div>

              {/* Active indicator */}
              {isActive && (
                <div className="absolute -left-px top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Quick Tips */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-100 dark:border-blue-800">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          Need Help?
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Use the voice assistant on the right to get help with any step. Just say things like:
        </p>
        <ul className="mt-3 space-y-1 text-sm text-gray-700 dark:text-gray-300">
          <li>&quot;Add butter chicken to my menu&quot;</li>
          <li>&quot;Generate 10 South Indian dishes&quot;</li>
          <li>&quot;Make my theme look modern&quot;</li>
          <li>&quot;How do I set up the POS?&quot;</li>
        </ul>
      </div>
    </div>
  );
}

export default SetupCardsGrid;
