/**
 * Voice Waveform Component
 * Visualizes audio level with animated waveform
 * Used for both listening (user speaking) and speaking (AI responding)
 */

import { useEffect, useRef } from 'react';

// ============================================================================
// Props Interface
// ============================================================================

export interface VoiceWaveformProps {
  level: number; // 0-1 audio level
  active: boolean; // Whether waveform should animate
  color?: string; // Waveform color (default: blue)
  barCount?: number; // Number of bars (default: 5)
  size?: number; // Size in pixels (default: 80)
}

// ============================================================================
// Main Component
// ============================================================================

export function VoiceWaveform({
  level,
  active,
  color = '#3b82f6', // blue-500
  barCount = 5,
  size = 80,
}: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const barHeightsRef = useRef<number[]>(new Array(barCount).fill(0.2));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = size;
    canvas.height = size;

    const centerX = size / 2;
    const centerY = size / 2;
    const barWidth = 3;
    const barSpacing = 2;
    const maxBarHeight = size * 0.4;

    const animate = () => {
      // Clear canvas
      ctx.clearRect(0, 0, size, size);

      if (!active) {
        // If not active, show minimal bars
        barHeightsRef.current = barHeightsRef.current.map(() => 0.15);
      } else {
        // Update bar heights with smooth transitions
        barHeightsRef.current = barHeightsRef.current.map((currentHeight, index) => {
          // Target height based on audio level and position (center bars higher)
          const positionFactor = 1 - Math.abs((index - barCount / 2) / (barCount / 2));
          const targetHeight = 0.2 + level * 0.8 * positionFactor;

          // Add some randomness for natural movement
          const noise = (Math.random() - 0.5) * 0.1;
          const newTarget = Math.max(0.1, Math.min(1, targetHeight + noise));

          // Smooth interpolation
          const smoothing = 0.15;
          return currentHeight + (newTarget - currentHeight) * smoothing;
        });
      }

      // Draw bars
      const totalWidth = barCount * (barWidth + barSpacing) - barSpacing;
      const startX = centerX - totalWidth / 2;

      barHeightsRef.current.forEach((height, index) => {
        const x = startX + index * (barWidth + barSpacing);
        const barHeight = height * maxBarHeight;

        // Create gradient
        const gradient = ctx.createLinearGradient(x, centerY - barHeight / 2, x, centerY + barHeight / 2);
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.5, color);
        gradient.addColorStop(1, color + '80'); // Add transparency

        ctx.fillStyle = gradient;
        ctx.fillRect(
          x,
          centerY - barHeight / 2,
          barWidth,
          barHeight
        );

        // Add glow effect when active
        if (active && height > 0.3) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = color;
          ctx.fillRect(
            x,
            centerY - barHeight / 2,
            barWidth,
            barHeight
          );
          ctx.shadowBlur = 0;
        }
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [active, level, color, barCount, size]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none"
      style={{ width: size, height: size }}
    />
  );
}

// ============================================================================
// Simple CSS Waveform (Alternative Lightweight Version)
// ============================================================================

export interface SimpleWaveformProps {
  level: number;
  active: boolean;
  className?: string;
}

/**
 * Simple CSS-based waveform (lighter alternative to canvas)
 */
export function SimpleWaveform({ level, active, className = '' }: SimpleWaveformProps) {
  const bars = 5;
  const heights = Array.from({ length: bars }, (_, i) => {
    if (!active) return 20;

    const positionFactor = 1 - Math.abs((i - bars / 2) / (bars / 2));
    return 20 + level * 60 * positionFactor;
  });

  return (
    <div className={`flex items-center justify-center gap-1 ${className}`}>
      {heights.map((height, index) => (
        <div
          key={index}
          className={`w-1 bg-current rounded-full transition-all duration-150 ${
            active ? 'animate-pulse' : ''
          }`}
          style={{
            height: `${height}%`,
            animationDelay: `${index * 100}ms`,
          }}
        />
      ))}
    </div>
  );
}
