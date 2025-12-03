import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'panel' | 'overlay' | 'feature';
  hoverEffect?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = '', 
  variant = 'panel',
  hoverEffect = false
}) => {
  const baseClasses = "relative overflow-hidden rounded-2xl backdrop-blur-xl transition-all duration-300";
  
  let variantClasses = "";
  if (variant === 'panel') {
    variantClasses = "bg-white/[0.03] border border-white/[0.08] shadow-warm-glass";
  } else if (variant === 'overlay') {
    variantClasses = "bg-warm-charcoal/80 border border-warm-border shadow-2xl";
  } else if (variant === 'feature') {
    variantClasses = "bg-gradient-to-br from-white/[0.05] to-transparent border border-white/[0.05]";
  }

  const hoverClasses = hoverEffect ? "hover:bg-white/[0.06] hover:border-white/[0.15] hover:shadow-card-hover hover:-translate-y-1" : "";

  return (
    <div className={`${baseClasses} ${variantClasses} ${hoverClasses} ${className}`}>
      {/* Subtle warm glow at top */}
      <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-saffron/5 to-transparent pointer-events-none" />
      {children}
    </div>
  );
};