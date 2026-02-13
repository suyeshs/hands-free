/**
 * Section Renderer Component
 * Dynamically renders sections based on plugin manifest layout configuration
 * Supports single-column, two-column, and grid layouts
 */

import { lazy, Suspense, ComponentType } from 'react';
import { cn } from '@/lib/utils';

export interface SectionConfig {
  id: string;
  component: string; // Component name to load
  props?: Record<string, any>;
  visible?: boolean;
  gridColumn?: string; // e.g., 'col-span-2'
  gridRow?: string;
}

export interface SectionRendererProps {
  sections: SectionConfig[];
  layout: 'single' | 'two-column' | 'grid';
  gridConfig?: {
    columns: number;
    breakpoint: string; // e.g., 'lg', 'xl'
  };
  components: Record<string, ComponentType<any>>; // Component registry
  className?: string;
}

/**
 * Loading fallback for lazy-loaded sections
 */
function SectionSkeleton() {
  return (
    <div className="neo-raised p-8 animate-pulse">
      <div className="h-6 bg-surface-2 rounded w-1/3 mb-4"></div>
      <div className="space-y-3">
        <div className="h-10 bg-surface-2 rounded"></div>
        <div className="h-10 bg-surface-2 rounded"></div>
      </div>
    </div>
  );
}

export function SectionRenderer({
  sections,
  layout,
  gridConfig,
  components,
  className,
}: SectionRendererProps) {
  // Filter visible sections
  const visibleSections = sections.filter((section) => section.visible !== false);

  // Get component from registry
  const getComponent = (componentName: string): ComponentType<any> | null => {
    return components[componentName] || null;
  };

  // Render section with error boundary
  const renderSection = (section: SectionConfig) => {
    const Component = getComponent(section.component);

    if (!Component) {
      console.warn(`[SectionRenderer] Component not found: ${section.component}`);
      return (
        <div
          key={section.id}
          className="neo-raised p-6 border border-destructive/30 bg-destructive/5"
        >
          <p className="text-destructive font-semibold">
            Component not found: {section.component}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            This section cannot be displayed. Please check your plugin configuration.
          </p>
        </div>
      );
    }

    return (
      <Suspense key={section.id} fallback={<SectionSkeleton />}>
        <Component {...(section.props || {})} />
      </Suspense>
    );
  };

  // Single-column layout
  if (layout === 'single') {
    return (
      <div className={cn('space-y-6 w-full px-4 lg:px-8', className)}>
        {visibleSections.map(renderSection)}
      </div>
    );
  }

  // Two-column layout
  if (layout === 'two-column' && gridConfig) {
    const { columns, breakpoint } = gridConfig;

    return (
      <div
        className={cn(
          'grid grid-cols-1',
          `${breakpoint}:grid-cols-${columns}`,
          'gap-6',
          'w-full px-4 lg:px-8',
          className
        )}
      >
        {visibleSections.map((section) => (
          <div key={section.id} className={section.gridColumn}>
            {renderSection(section)}
          </div>
        ))}
      </div>
    );
  }

  // Grid layout (advanced positioning)
  if (layout === 'grid') {
    return (
      <div className={cn('grid gap-6 w-full px-4 lg:px-8', className)}>
        {visibleSections.map((section) => (
          <div
            key={section.id}
            className={cn(section.gridColumn, section.gridRow)}
            style={{
              gridColumn: section.gridColumn,
              gridRow: section.gridRow,
            }}
          >
            {renderSection(section)}
          </div>
        ))}
      </div>
    );
  }

  // Fallback to single column
  return (
    <div className={cn('space-y-6 w-full px-4 lg:px-8', className)}>
      {visibleSections.map(renderSection)}
    </div>
  );
}
