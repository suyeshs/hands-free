/**
 * Handsfree Tech Theme - Layouts
 */

import type {
  LandingLayout,
  ProductShowcaseLayout,
  DocumentationLayout,
  VoiceControlLayout,
} from '../types';

export const landingLayout: LandingLayout = {
  type: 'scroll',
  hero: {
    type: 'gradient',
    height: 'viewport',
    showParticles: true,
    particleCount: 50,
    showGradientAnimation: true,
    textAnimation: 'typewriter',
  },
  features: {
    layout: 'grid',
    columns: { mobile: 1, tablet: 2, desktop: 3 },
    gap: '2rem',
    animateOnScroll: true,
    staggerDelay: 100,
  },
  cta: {
    position: 'sticky',
    style: 'gradient',
    showMultiple: true,
  },
  scrollEffect: 'parallax',
};

export const productShowcaseLayout: ProductShowcaseLayout = {
  type: 'grid',
  filterBar: {
    show: true,
    position: 'top',
    filters: ['All', 'SaaS', 'AI Tools', 'Developer Tools', 'APIs'],
    style: 'pills',
  },
  sorting: {
    show: true,
    options: ['Popular', 'Newest', 'Name A-Z'],
    defaultSort: 'Popular',
  },
  viewOptions: ['grid', 'list'],
  defaultView: 'grid',
};

export const documentationLayout: DocumentationLayout = {
  sidebar: {
    position: 'left',
    width: '280px',
    collapsible: true,
    sticky: true,
    showIcons: true,
  },
  content: {
    maxWidth: '800px',
    showBreadcrumbs: true,
    showNavigation: true,
    codeBlockTheme: 'dark',
  },
  tableOfContents: {
    show: true,
    position: 'right',
    levels: 3,
    sticky: true,
  },
  search: {
    show: true,
    position: 'header',
    placeholder: 'Search docs...',
    showShortcut: true,
    shortcut: '⌘K',
  },
};

export const voiceControlLayout: VoiceControlLayout = {
  orbPosition: 'bottom-center',
  showTranscript: true,
  transcriptPosition: 'bottom',
  showCommands: true,
  commandsStyle: 'grid',
  feedbackStyle: 'detailed',
};

export const layouts = {
  landing: landingLayout,
  productShowcase: productShowcaseLayout,
  documentation: documentationLayout,
  voiceControl: voiceControlLayout,
};
