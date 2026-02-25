'use client';

import React from 'react';
import { CardSetupProvider, useCardSetup } from '../../../contexts/CardSetupContext';
import { SetupHeader } from './SetupHeader';
import { SetupCardGrid } from './SetupCardGrid';
import { SetupCard } from './SetupCard';
import { CardFormContainer } from './CardFormContainer';
import { SetupCardId } from './types/setup-cards';
import { RestaurantSetupForm } from './forms/RestaurantSetupForm';
import { MenuSetupForm } from './forms/MenuSetupForm';
import { ThemeSetupForm } from './forms/ThemeSetupForm';
import { AISetupForm } from './forms/AISetupForm';
import { POSSetupForm } from './forms/POSSetupForm';

/**
 * Card-Based Setup Flow
 * Main orchestrator for the post-provisioning setup experience
 *
 * Features:
 * - Restaurant metadata display
 * - 5 interactive setup cards (Restaurant, Menu, Theme, AI, POS)
 * - Animated card-to-form transitions using Framer Motion
 * - Glassmorphism design following handsfree.tech aesthetic
 * - Non-linear setup flow with completion tracking
 */
export function CardBasedSetupFlow() {
  return (
    <CardSetupProvider>
      <SetupFlowContent />
    </CardSetupProvider>
  );
}

/**
 * Setup Flow Content
 * Inner component that uses the card setup context
 */
function SetupFlowContent() {
  const { state, openCard, closeCard } = useCardSetup();

  // Get active card details
  const activeCard = state.activeCardId ? state.cards[state.activeCardId] : null;

  // Debug log
  console.log('[CardBasedSetupFlow] Rendering - Version 2.0');
  console.log('[CardBasedSetupFlow] State:', state);

  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-charcoal via-warm-charcoal to-warm-charcoal/95">
      <div className="container mx-auto px-4 py-8">
        {/* Setup Header */}
        <SetupHeader />

        {/* Card Grid */}
        <SetupCardGrid>
          {Object.values(SetupCardId).map((cardId) => {
            const card = state.cards[cardId];
            return (
              <SetupCard
                key={cardId}
                id={card.id}
                title={card.title}
                description={card.description}
                icon={card.icon}
                status={card.status}
                isActive={state.activeCardId === cardId}
                isCompact={state.activeCardId !== null}
                required={card.required}
                onClick={() => openCard(cardId)}
              />
            );
          })}
        </SetupCardGrid>

        {/* Active Card Form */}
        {activeCard && (
          <CardFormContainer
            cardId={activeCard.id}
            title={activeCard.title}
            onClose={closeCard}
          >
            {renderFormContent(activeCard.id)}
          </CardFormContainer>
        )}
      </div>
    </div>
  );
}

/**
 * Render form content based on card ID
 */
function renderFormContent(cardId: SetupCardId) {
  switch (cardId) {
    case SetupCardId.RESTAURANT:
      return <RestaurantSetupForm />;
    case SetupCardId.MENU:
      return <MenuSetupForm />;
    case SetupCardId.THEME:
      return <ThemeSetupForm />;
    case SetupCardId.AI:
      return <AISetupForm />;
    case SetupCardId.POS:
      return <POSSetupForm />;
    default:
      return (
        <div className="text-warm-white text-center py-8">
          <p className="text-warm-white/60">Form not found</p>
        </div>
      );
  }
}
