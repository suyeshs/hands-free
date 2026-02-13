/**
 * Neumorphic Component Schema Validation
 * Validates component structures and ensures consistency
 */

import type {
  NeumorphicComponent,
  ComponentLibrary,
  ScreenLayout,
  ComponentState,
  ModalityType,
} from './types';
import { ColorUtils } from './style-generator';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Component validator
 */
export class ComponentValidator {
  /**
   * Validate complete component
   */
  static validate(component: NeumorphicComponent, targetAccessibility: 'AA' | 'AAA' = 'AA'): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!component.id || component.id.trim() === '') {
      errors.push('Component ID is required');
    }

    if (!component.name || component.name.trim() === '') {
      errors.push('Component name is required');
    }

    if (!component.type) {
      errors.push('Component type is required');
    }

    // Validate dimensions
    if (component.dimensions) {
      if (typeof component.dimensions.width === 'number' && component.dimensions.width <= 0) {
        errors.push('Width must be greater than 0');
      }
      if (typeof component.dimensions.height === 'number' && component.dimensions.height <= 0) {
        errors.push('Height must be greater than 0');
      }
    }

    // Validate states
    if (!component.states || Object.keys(component.states).length === 0) {
      errors.push('Component must have at least one state');
    } else {
      // Validate default state exists
      if (!component.states[component.defaultState]) {
        errors.push(`Default state "${component.defaultState}" is not defined`);
      }

      // Validate each state
      for (const [stateName, state] of Object.entries(component.states)) {
        const stateErrors = this.validateState(stateName as ComponentState, state, targetAccessibility);
        errors.push(...stateErrors.map((e) => `State "${stateName}": ${e}`));
      }
    }

    // Validate interaction
    if (component.interactive) {
      const interactionErrors = this.validateInteraction(component);
      errors.push(...interactionErrors);
    }

    // Validate accessibility
    const accessibilityErrors = this.validateAccessibility(component, targetAccessibility);
    errors.push(...accessibilityErrors);

    // Validate children (if any)
    if (component.children && component.children.length > 0) {
      component.children.forEach((child, index) => {
        const childResult = this.validate(child, targetAccessibility);
        if (!childResult.valid) {
          errors.push(...childResult.errors.map((e) => `Child ${index}: ${e}`));
        }
        warnings.push(...childResult.warnings.map((w) => `Child ${index}: ${w}`));
      });
    }

    // Warnings for best practices
    if (component.interactive && !component.interaction.touch) {
      warnings.push('Interactive component should have touch configuration');
    }

    if (component.icon && !component.icon.color) {
      warnings.push('Icon color not specified, will inherit from component');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate state configuration
   */
  private static validateState(
    stateName: ComponentState,
    state: any,
    targetAccessibility: 'AA' | 'AAA'
  ): string[] {
    const errors: string[] = [];

    if (!state.surface) {
      errors.push('Surface configuration is required');
      return errors;
    }

    if (!state.textColor) {
      errors.push('Text color is required');
    }

    // Validate color contrast
    if (state.surface.backgroundColor && state.textColor) {
      try {
        const contrastCheck = ColorUtils.meetsWCAG(
          state.surface.backgroundColor,
          state.textColor,
          targetAccessibility
        );

        if (!contrastCheck) {
          const ratio = ColorUtils.getContrastRatio(
            state.surface.backgroundColor,
            state.textColor
          );
          errors.push(
            `Insufficient contrast ratio: ${ratio.toFixed(2)}:1 (required: ${targetAccessibility === 'AA' ? '4.5' : '7'}:1)`
          );
        }
      } catch (e) {
        errors.push('Invalid color format');
      }
    }

    // Validate shadows
    if (state.surface.shadows) {
      if (!state.surface.shadows.light || !state.surface.shadows.dark) {
        errors.push('Both light and dark shadows are required');
      }
    }

    return errors;
  }

  /**
   * Validate interaction configuration
   */
  private static validateInteraction(component: NeumorphicComponent): string[] {
    const errors: string[] = [];

    if (!component.interaction) {
      errors.push('Interaction configuration is required for interactive components');
      return errors;
    }

    if (!component.interaction.primary) {
      errors.push('Primary modality is required');
    }

    // Validate touch configuration
    if (component.interaction.touch) {
      const minSize = component.interaction.touch.minTouchSize;
      if (minSize.width < 44 || minSize.height < 44) {
        errors.push('Minimum touch size should be at least 44x44px for accessibility');
      }
    }

    // Validate voice commands
    if (component.interaction.voice) {
      component.interaction.voice.forEach((cmd, index) => {
        if (!cmd.triggers || cmd.triggers.length === 0) {
          errors.push(`Voice command ${index}: At least one trigger phrase is required`);
        }
        if (!cmd.feedback) {
          errors.push(`Voice command ${index}: Feedback message is required`);
        }
      });
    }

    // Validate gestures
    if (component.interaction.gesture) {
      component.interaction.gesture.forEach((gesture, index) => {
        if (!gesture.type) {
          errors.push(`Gesture ${index}: Type is required`);
        }
        if (gesture.type === 'swipe' && !gesture.direction) {
          errors.push(`Gesture ${index}: Direction is required for swipe gestures`);
        }
      });
    }

    return errors;
  }

  /**
   * Validate accessibility configuration
   */
  private static validateAccessibility(component: NeumorphicComponent, targetLevel: 'AA' | 'AAA'): string[] {
    const errors: string[] = [];

    if (!component.accessibility) {
      errors.push('Accessibility configuration is required');
      return errors;
    }

    if (!component.accessibility.label || component.accessibility.label.trim() === '') {
      errors.push('ARIA label is required');
    }

    if (!component.accessibility.role) {
      errors.push('ARIA role is required');
    }

    if (component.interactive && !component.accessibility.focusable) {
      errors.push('Interactive components must be focusable');
    }

    const requiredContrast = targetLevel === 'AA' ? 4.5 : 7;
    if (component.accessibility.minContrast < requiredContrast) {
      errors.push(`Minimum contrast ratio should be at least ${requiredContrast}:1 for ${targetLevel}`);
    }

    return errors;
  }

  /**
   * Validate component library
   */
  static validateLibrary(library: ComponentLibrary, targetAccessibility: 'AA' | 'AAA' = 'AA'): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!library.id) {
      errors.push('Library ID is required');
    }

    if (!library.name || library.name.trim() === '') {
      errors.push('Library name is required');
    }

    if (!library.components || library.components.length === 0) {
      errors.push('Library must contain at least one component');
    } else {
      // Validate each component
      library.components.forEach((component, index) => {
        const result = this.validate(component, targetAccessibility);
        if (!result.valid) {
          errors.push(...result.errors.map((e) => `Component ${index} (${component.name}): ${e}`));
        }
        warnings.push(...result.warnings.map((w) => `Component ${index} (${component.name}): ${w}`));
      });

      // Check for duplicate IDs
      const ids = library.components.map((c) => c.id);
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
      if (duplicates.length > 0) {
        errors.push(`Duplicate component IDs found: ${duplicates.join(', ')}`);
      }
    }

    if (!library.tokens) {
      errors.push('Design tokens are required');
    }

    if (!library.meta) {
      errors.push('Library metadata is required');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate screen layout
   */
  static validateLayout(layout: ScreenLayout): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!layout.id) {
      errors.push('Layout ID is required');
    }

    if (!layout.name || layout.name.trim() === '') {
      errors.push('Layout name is required');
    }

    if (!layout.viewport) {
      errors.push('Viewport configuration is required');
    } else {
      if (layout.viewport.width <= 0) {
        errors.push('Viewport width must be greater than 0');
      }
      if (layout.viewport.height <= 0) {
        errors.push('Viewport height must be greater than 0');
      }
    }

    if (!layout.structure || !layout.structure.content) {
      errors.push('Layout must have content structure');
    } else {
      // Validate structure components
      const allComponents = [
        ...(layout.structure.header ? [layout.structure.header] : []),
        ...(layout.structure.content || []),
        ...(layout.structure.footer ? [layout.structure.footer] : []),
        ...(layout.structure.fab ? [layout.structure.fab] : []),
        ...(layout.structure.navigation ? [layout.structure.navigation] : []),
      ];

      allComponents.forEach((component, index) => {
        const result = this.validate(component);
        if (!result.valid) {
          errors.push(...result.errors.map((e) => `Component ${index}: ${e}`));
        }
        warnings.push(...result.warnings.map((w) => `Component ${index}: ${w}`));
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

/**
 * Helper functions for common validations
 */
export class ValidationHelpers {
  /**
   * Check if value is valid hex color
   */
  static isValidHexColor(color: string): boolean {
    return /^#([0-9A-F]{3}){1,2}$/i.test(color);
  }

  /**
   * Check if modality is supported
   */
  static isValidModality(modality: string): boolean {
    const validModalities: ModalityType[] = ['touch', 'voice', 'gesture', 'keyboard'];
    return validModalities.includes(modality as ModalityType);
  }

  /**
   * Check if state is valid
   */
  static isValidState(state: string): boolean {
    const validStates: ComponentState[] = [
      'default',
      'hover',
      'active',
      'pressed',
      'focused',
      'disabled',
      'loading',
      'error',
      'success',
    ];
    return validStates.includes(state as ComponentState);
  }

  /**
   * Generate validation summary
   */
  static generateSummary(result: ValidationResult): string {
    const parts: string[] = [];

    if (result.valid) {
      parts.push('✓ Validation passed');
    } else {
      parts.push('✗ Validation failed');
    }

    if (result.errors.length > 0) {
      parts.push(`\nErrors (${result.errors.length}):`);
      result.errors.forEach((error, index) => {
        parts.push(`  ${index + 1}. ${error}`);
      });
    }

    if (result.warnings.length > 0) {
      parts.push(`\nWarnings (${result.warnings.length}):`);
      result.warnings.forEach((warning, index) => {
        parts.push(`  ${index + 1}. ${warning}`);
      });
    }

    return parts.join('\n');
  }
}
