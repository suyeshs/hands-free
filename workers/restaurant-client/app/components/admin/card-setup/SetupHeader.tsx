'use client';

import React from 'react';
import { ExternalLink, Building2, Utensils, Palette, Mic, Monitor } from 'lucide-react';
import { useRestaurant } from '../../../contexts/RestaurantContext';
import { useCardSetup } from '../../../contexts/CardSetupContext';
import { SetupCardId, CardStatus } from './types/setup-cards';

/**
 * Setup Header Component
 * Displays restaurant metadata and progress at the top of the card-based setup flow
 *
 * Design: Glass panel with warm border glow following handsfree.tech aesthetic
 */
export function SetupHeader() {
  const { profile } = useRestaurant();
  const { state, getCompletionPercentage, canGoLive, openCard } = useCardSetup();

  const completionPercentage = getCompletionPercentage();
  const isReadyToLaunch = canGoLive();

  if (!profile) {
    return null;
  }

  return (
    <div className="glass-panel warm-border-glow p-6 md:p-8 mb-8">
      {/* Top Row: Restaurant Name + Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        {/* Restaurant Name (reduced size) */}
        <h1 className="text-xl md:text-2xl font-bold text-warm-white font-display">
          {profile.name}
        </h1>

        {/* Actions: View Customer Site */}
        <a
          href={`https://${profile.tenantId}.handsfree.tech`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-paprika to-saffron hover:from-paprika/90 hover:to-saffron/90 text-warm-charcoal font-semibold text-sm transition-all duration-200 shadow-lg hover:shadow-saffron-glow"
        >
          <ExternalLink className="w-4 h-4" />
          <span>View Customer Site</span>
        </a>
      </div>

      {/* Setup Steps - Compact Navigation */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-warm-white/70 mb-3">Setup Steps</h2>
        <div className="flex items-start gap-4 overflow-x-auto">
          {/* Restaurant Setup */}
          <CompactStepBox
            id={SetupCardId.RESTAURANT}
            icon={Building2}
            label="Restaurant"
            status={state.cards[SetupCardId.RESTAURANT].status}
            isActive={state.activeCardId === SetupCardId.RESTAURANT}
            onClick={() => openCard(SetupCardId.RESTAURANT)}
          />

          {/* Menu Setup */}
          <CompactStepBox
            id={SetupCardId.MENU}
            icon={Utensils}
            label="Menu"
            status={state.cards[SetupCardId.MENU].status}
            isActive={state.activeCardId === SetupCardId.MENU}
            onClick={() => openCard(SetupCardId.MENU)}
          />

          {/* Theme Setup */}
          <CompactStepBox
            id={SetupCardId.THEME}
            icon={Palette}
            label="Theme"
            status={state.cards[SetupCardId.THEME].status}
            isActive={state.activeCardId === SetupCardId.THEME}
            onClick={() => openCard(SetupCardId.THEME)}
          />

          {/* AI Setup */}
          <CompactStepBox
            id={SetupCardId.AI}
            icon={Mic}
            label="AI"
            status={state.cards[SetupCardId.AI].status}
            isActive={state.activeCardId === SetupCardId.AI}
            onClick={() => openCard(SetupCardId.AI)}
          />

          {/* POS Setup */}
          <CompactStepBox
            id={SetupCardId.POS}
            icon={Monitor}
            label="POS"
            status={state.cards[SetupCardId.POS].status}
            isActive={state.activeCardId === SetupCardId.POS}
            onClick={() => openCard(SetupCardId.POS)}
          />
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-warm-white">Setup Progress</span>
          <span className="text-sm font-bold text-warm-white">{completionPercentage}% Complete</span>
        </div>
        <div className="relative h-3 bg-warm-white/10 rounded-full overflow-hidden backdrop-blur-sm">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-paprika to-saffron rounded-full transition-all duration-500 ease-out shadow-saffron-glow"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
        {isReadyToLaunch && (
          <p className="text-xs text-honey mt-2 text-center">
            All required steps complete! Your restaurant is ready to go live.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Compact Step Box Component
 * Displays a single setup step with icon, label, and status indicator
 */
interface CompactStepBoxProps {
  id: SetupCardId;
  icon: React.ElementType;
  label: string;
  status: CardStatus;
  isActive: boolean;
  onClick: () => void;
}

function CompactStepBox({ icon: Icon, label, status, isActive, onClick }: CompactStepBoxProps) {
  const getStatusColor = () => {
    switch (status) {
      case CardStatus.COMPLETE:
        return 'from-honey/30 to-coffee/30 border-honey/30';
      case CardStatus.IN_PROGRESS:
        return 'from-saffron/30 to-paprika/30 border-saffron/30';
      default:
        return 'from-warm-white/5 to-warm-white/5 border-warm-white/20';
    }
  };

  const getStatusDotColor = () => {
    switch (status) {
      case CardStatus.COMPLETE:
        return 'bg-honey';
      case CardStatus.IN_PROGRESS:
        return 'bg-saffron animate-pulse';
      default:
        return 'bg-warm-white/30';
    }
  };

  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center gap-2 transition-all duration-300 flex-shrink-0
        ${isActive ? 'scale-105' : 'hover:scale-105'}
      `}
      aria-label={`${label} setup step - ${status}`}
    >
      {/* Icon Box */}
      <div
        className={`
          w-14 h-14 rounded-lg flex items-center justify-center
          bg-gradient-to-br ${getStatusColor()}
          border ${isActive ? 'ring-2 ring-saffron shadow-saffron-glow' : ''}
          transition-all duration-300
        `}
      >
        <Icon className="w-6 h-6 text-warm-white" />
      </div>

      {/* Label */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs font-medium text-warm-white/90">
          {label}
        </span>
        {/* Status Dot */}
        <div className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor()}`} />
      </div>
    </button>
  );
}
