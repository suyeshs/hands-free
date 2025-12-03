import React, { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useSpring, MotionValue } from 'framer-motion';
import { ecosystemFeatures, ecosystemConnections, Feature } from '../../src/config/features';

// Hook to detect mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

interface FeatureIconProps {
  feature: Feature;
  scrollProgress: MotionValue<number>;
  index: number;
  isMobile: boolean;
}

function FeatureIcon({ feature, scrollProgress, index, isMobile }: FeatureIconProps) {
  const Icon = feature.icon;

  // Smooth progress for animations
  const smoothProgress = useSpring(scrollProgress, { stiffness: 100, damping: 30 });

  // Mobile: Simple staggered fade-in grid layout
  // Desktop: Animated positions from scattered to ecosystem
  const mobileY = useTransform(smoothProgress, [0, 0.3 + index * 0.05], [50, 0]);
  const mobileOpacity = useTransform(smoothProgress, [0, 0.2, 0.3 + index * 0.05], [0, 0, 1]);

  // Desktop animations
  const x = useTransform(
    smoothProgress,
    [0, 0.25, 0.6, 0.8],
    [
      feature.initialPosition.x,
      feature.initialPosition.x * 0.6,
      feature.finalPosition.x * 1.1,
      feature.finalPosition.x,
    ]
  );
  const y = useTransform(
    smoothProgress,
    [0, 0.25, 0.6, 0.8],
    [
      feature.initialPosition.y,
      feature.initialPosition.y * 0.6,
      feature.finalPosition.y * 1.1,
      feature.finalPosition.y,
    ]
  );

  // Scale pulse when arriving at final position
  const scale = useTransform(
    smoothProgress,
    [0, 0.5, 0.7, 0.8, 0.9],
    [0.8, 0.9, 1.15, 1, 1]
  );

  // Opacity - fade in early, stay visible
  const opacity = useTransform(smoothProgress, [0, 0.15, 0.2], [0, 0.5, 1]);

  // Label opacity (appears in final phase)
  const labelOpacity = useTransform(smoothProgress, [0.7, 0.9], [0, 1]);
  const labelY = useTransform(smoothProgress, [0.7, 0.9], [10, 0]);

  // Glow effect at final position
  const glowOpacity = useTransform(smoothProgress, [0.75, 0.95], [0, 0.6]);

  if (isMobile) {
    return (
      <motion.div
        style={{ y: mobileY, opacity: mobileOpacity }}
        className="flex flex-col items-center gap-2"
      >
        <div
          className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.bgGradient}
                     ${feature.borderColor} border backdrop-blur-sm
                     flex items-center justify-center shadow-lg`}
        >
          <Icon className={`w-7 h-7 ${feature.textColor}`} />
        </div>
        <span className="text-xs text-gray-400 text-center font-medium">
          {feature.shortLabel}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      style={{ x, y, scale, opacity }}
      className="absolute left-1/2 top-1/2"
    >
      {/* Glow effect */}
      <motion.div
        style={{ opacity: glowOpacity }}
        className={`absolute inset-0 -m-2 rounded-2xl bg-gradient-to-br ${feature.bgGradient} blur-xl`}
      />

      {/* Icon container */}
      <div
        className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.bgGradient}
                   ${feature.borderColor} border backdrop-blur-sm
                   flex items-center justify-center shadow-xl
                   -translate-x-1/2 -translate-y-1/2`}
      >
        <Icon className={`w-8 h-8 ${feature.textColor}`} />
      </div>

      {/* Label */}
      <motion.div
        style={{ opacity: labelOpacity, y: labelY }}
        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap"
      >
        <span className="text-xs text-gray-400 font-medium px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm">
          {feature.shortLabel}
        </span>
      </motion.div>
    </motion.div>
  );
}

function CenterHub({ scrollProgress }: { scrollProgress: MotionValue<number> }) {
  const smoothProgress = useSpring(scrollProgress, { stiffness: 100, damping: 30 });

  const hubOpacity = useTransform(smoothProgress, [0.4, 0.7], [0, 1]);
  const hubScale = useTransform(smoothProgress, [0.4, 0.65, 0.8], [0.5, 1.1, 1]);
  const ringScale = useTransform(smoothProgress, [0.5, 0.8, 1], [0, 1.2, 1]);
  const ringOpacity = useTransform(smoothProgress, [0.5, 0.7, 0.9], [0, 0.5, 0.3]);

  return (
    <>
      {/* Pulsing ring */}
      <motion.div
        style={{ opacity: ringOpacity, scale: ringScale }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                   w-40 h-40 rounded-full border-2 border-saffron/30"
      />

      {/* Center hub */}
      <motion.div
        style={{ opacity: hubOpacity, scale: hubScale }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                   w-28 h-28 rounded-full bg-gradient-to-br from-saffron via-paprika to-red-600
                   flex items-center justify-center shadow-2xl shadow-saffron/40
                   border-4 border-white/20"
      >
        <div className="text-center">
          <span className="text-white font-display text-sm font-medium tracking-tight">
            HANDSFREE
          </span>
          <span className="block text-white/80 text-xs">.TECH</span>
        </div>
      </motion.div>
    </>
  );
}

function ConnectionLines({ scrollProgress, isMobile }: { scrollProgress: MotionValue<number>; isMobile: boolean }) {
  const smoothProgress = useSpring(scrollProgress, { stiffness: 100, damping: 30 });
  const lineProgress = useTransform(smoothProgress, [0.5, 0.85], [0, 1]);
  const lineOpacity = useTransform(smoothProgress, [0.5, 0.6, 0.95], [0, 0.4, 0.3]);

  if (isMobile) return null;

  // Get feature position by id
  const getPosition = (id: string) => {
    if (id === 'center') return { x: 0, y: 0 };
    const feature = ecosystemFeatures.find((f) => f.id === id);
    return feature?.finalPosition || { x: 0, y: 0 };
  };

  // Convert position to SVG coordinates (center is 200, 175)
  const toSvg = (pos: { x: number; y: number }) => ({
    x: 200 + pos.x,
    y: 175 + pos.y,
  });

  return (
    <motion.svg
      style={{ opacity: lineOpacity }}
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 400 350"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F28C38" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#D9453E" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#F28C38" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {ecosystemConnections.map((conn, i) => {
        const from = toSvg(getPosition(conn.from));
        const to = toSvg(getPosition(conn.to));

        return (
          <motion.line
            key={`${conn.from}-${conn.to}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="url(#lineGradient)"
            strokeWidth="1.5"
            strokeDasharray="6 4"
            style={{ pathLength: lineProgress }}
            initial={{ pathLength: 0 }}
          />
        );
      })}
    </motion.svg>
  );
}

export function FeatureEcosystem() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  return (
    <div ref={containerRef} className="relative w-full max-w-4xl mx-auto">
      {/* Mobile: Grid layout */}
      {isMobile ? (
        <div className="grid grid-cols-4 gap-4 py-8 px-4">
          {ecosystemFeatures.map((feature, index) => (
            <FeatureIcon
              key={feature.id}
              feature={feature}
              scrollProgress={scrollYProgress}
              index={index}
              isMobile={true}
            />
          ))}
        </div>
      ) : (
        /* Desktop: Animated ecosystem diagram */
        <div className="relative h-[350px] w-full">
          {/* Connection lines (SVG) */}
          <ConnectionLines scrollProgress={scrollYProgress} isMobile={isMobile} />

          {/* Center hub */}
          <CenterHub scrollProgress={scrollYProgress} />

          {/* Feature icons */}
          {ecosystemFeatures.map((feature, index) => (
            <FeatureIcon
              key={feature.id}
              feature={feature}
              scrollProgress={scrollYProgress}
              index={index}
              isMobile={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
