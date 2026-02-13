/**
 * Neumorphic Primitive Components
 * Pre-defined component templates following LDSG principles
 */

export { createButton, createIconButton, createTextButton } from './button';
export { createTextField, createTextArea, createSearchField } from './input';
export { createCard, createElevatedCard, createInsetCard } from './card';
export { createModal, createDialog, createBottomSheet } from './modal';
export { createNavigationBar, createTabBar, createSideNav } from './navigation';
export { createFAB, createMiniFAB, createExtendedFAB } from './fab';
export { createToggle, createSwitch, createCheckbox } from './toggle';
export { createList, createListItem, createDivider } from './list';

/**
 * Get all available primitive templates
 */
export function getAllPrimitives() {
  return [
    'button',
    'icon-button',
    'text-button',
    'text-field',
    'text-area',
    'search-field',
    'card',
    'elevated-card',
    'inset-card',
    'modal',
    'dialog',
    'bottom-sheet',
    'navigation-bar',
    'tab-bar',
    'side-nav',
    'fab',
    'mini-fab',
    'extended-fab',
    'toggle',
    'switch',
    'checkbox',
    'list',
    'list-item',
    'divider',
  ];
}

/**
 * Get primitive by name
 */
export function getPrimitive(name: string, options: any = {}) {
  const primitiveMap: Record<string, (options: any) => any> = {
    'button': createButton,
    'icon-button': createIconButton,
    'text-button': createTextButton,
    'text-field': createTextField,
    'text-area': createTextArea,
    'search-field': createSearchField,
    'card': createCard,
    'elevated-card': createElevatedCard,
    'inset-card': createInsetCard,
    'modal': createModal,
    'dialog': createDialog,
    'bottom-sheet': createBottomSheet,
    'navigation-bar': createNavigationBar,
    'tab-bar': createTabBar,
    'side-nav': createSideNav,
    'fab': createFAB,
    'mini-fab': createMiniFAB,
    'extended-fab': createExtendedFAB,
    'toggle': createToggle,
    'switch': createSwitch,
    'checkbox': createCheckbox,
    'list': createList,
    'list-item': createListItem,
    'divider': createDivider,
  };

  const creator = primitiveMap[name];
  if (!creator) {
    throw new Error(`Unknown primitive: ${name}`);
  }

  return creator(options);
}
