'use client';

import React from 'react';

export type VoiceFABState =
  | 'not-connected'
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'speaking'
  | 'thinking';

interface VoiceFABProps {
  state: VoiceFABState;
  size?: number;
  onClick?: () => void;
  className?: string;
}

/**
 * Voice Activation FAB (Floating Action Button)
 *
 * States:
 * - not-connected: Full branding with "HANDS FREE" text and mic icon
 * - connecting: Pulsing animation while establishing connection
 * - connected: Subtle glow, ready for interaction (compact mic only)
 * - listening: Sound wave animation (user is speaking)
 * - speaking: Animated waves outward (AI is speaking)
 * - thinking: Rotating/processing animation
 */
export const VoiceFAB: React.FC<VoiceFABProps> = ({
  state = 'not-connected',
  size = 80,
  onClick,
  className = ''
}) => {
  // Not connected shows the full branded icon
  if (state === 'not-connected') {
    return (
      <button
        onClick={onClick}
        className={`relative focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 rounded-full transition-transform hover:scale-105 active:scale-95 ${className}`}
        style={{ width: size, height: size }}
        aria-label="Voice assistant - tap to connect"
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-lg"
        >
          <defs>
            {/* Main gradient - purple to cyan matching the logo */}
            <linearGradient id="fab-gradient-nc" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#9333EA" />
              <stop offset="50%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#22D3EE" />
            </linearGradient>

            {/* Shadow filter */}
            <filter id="fab-shadow-nc" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#6366F1" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Background circle with gradient */}
          <circle
            cx="50"
            cy="50"
            r="48"
            fill="url(#fab-gradient-nc)"
            filter="url(#fab-shadow-nc)"
          />

          {/* "HANDS" text - curved at top */}
          <path id="topArc" d="M 15 50 A 35 35 0 0 1 85 50" fill="none" />
          <text
            fill="white"
            fontSize="10"
            fontWeight="bold"
            fontFamily="system-ui, -apple-system, sans-serif"
            letterSpacing="2"
          >
            <textPath href="#topArc" startOffset="50%" textAnchor="middle">
              HANDS
            </textPath>
          </text>

          {/* "FREE" text - curved at bottom */}
          <path id="bottomArc" d="M 15 50 A 35 35 0 0 0 85 50" fill="none" />
          <text
            fill="white"
            fontSize="10"
            fontWeight="bold"
            fontFamily="system-ui, -apple-system, sans-serif"
            letterSpacing="2"
          >
            <textPath href="#bottomArc" startOffset="50%" textAnchor="middle">
              FREE
            </textPath>
          </text>

          {/* Speech bubble with microphone - center icon */}
          <g transform="translate(50, 50) scale(0.55) translate(-50, -50)">
            {/* Speech bubble background */}
            <path
              d="M50 20
                 C32 20, 18 34, 18 50
                 C18 62, 25 72, 36 77
                 L32 88
                 L48 80
                 C49 80.1, 49.5 80.2, 50 80.2
                 C68 80.2, 82 66, 82 50
                 C82 34, 68 20, 50 20Z"
              fill="white"
            />

            {/* Microphone body */}
            <rect
              x="43"
              y="36"
              width="14"
              height="22"
              rx="7"
              fill="url(#fab-gradient-nc)"
            />

            {/* Microphone stand */}
            <path
              d="M50 58 L50 66 M42 66 L58 66"
              stroke="url(#fab-gradient-nc)"
              strokeWidth="3"
              strokeLinecap="round"
            />

            {/* Sound wave lines */}
            <path
              d="M34 42 Q30 50, 34 58"
              stroke="url(#fab-gradient-nc)"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M28 38 Q22 50, 28 62"
              stroke="url(#fab-gradient-nc)"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity="0.7"
            />
            <path
              d="M66 42 Q70 50, 66 58"
              stroke="url(#fab-gradient-nc)"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M72 38 Q78 50, 72 62"
              stroke="url(#fab-gradient-nc)"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity="0.7"
            />
          </g>
        </svg>
      </button>
    );
  }

  // Active states (connecting, connected, listening, speaking, thinking)
  const getStateStyles = () => {
    switch (state) {
      case 'connecting':
        return {
          outerRing: 'opacity-50',
          innerGlow: 'opacity-30',
          micIcon: 'opacity-70'
        };
      case 'connected':
        return {
          outerRing: 'opacity-60',
          innerGlow: 'opacity-40',
          micIcon: 'opacity-90'
        };
      case 'listening':
        return {
          outerRing: 'opacity-80',
          innerGlow: 'opacity-60',
          micIcon: 'opacity-100'
        };
      case 'speaking':
        return {
          outerRing: 'opacity-90',
          innerGlow: 'opacity-70',
          micIcon: 'opacity-100'
        };
      case 'thinking':
        return {
          outerRing: 'opacity-70',
          innerGlow: 'opacity-50',
          micIcon: 'opacity-80'
        };
      default:
        return {
          outerRing: 'opacity-60',
          innerGlow: 'opacity-40',
          micIcon: 'opacity-90'
        };
    }
  };

  const styles = getStateStyles();

  return (
    <button
      onClick={onClick}
      className={`relative focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 rounded-full transition-transform hover:scale-105 active:scale-95 ${className}`}
      style={{ width: size, height: size }}
      aria-label={`Voice assistant - ${state}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-lg"
      >
        <defs>
          {/* Main gradient - purple to cyan */}
          <linearGradient id="fab-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9333EA" />
            <stop offset="50%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>

          {/* Glow gradient for inner effects */}
          <radialGradient id="fab-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>

          {/* Shadow filter */}
          <filter id="fab-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#6366F1" floodOpacity="0.4" />
          </filter>

          {/* Glow filter for active states */}
          <filter id="fab-active-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Background circle with gradient */}
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="url(#fab-gradient)"
          filter="url(#fab-shadow)"
        />

        {/* Inner glow overlay */}
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="url(#fab-glow)"
          className={`transition-opacity duration-300 ${styles.innerGlow}`}
        />

        {/* Sound wave rings - visible in listening/speaking states */}
        <g className={`transition-all duration-300 ${state === 'listening' || state === 'speaking' ? 'opacity-100' : 'opacity-0'}`}>
          {/* Inner wave */}
          <circle
            cx="50"
            cy="50"
            r="38"
            fill="none"
            stroke="white"
            strokeWidth="1"
            strokeOpacity="0.4"
            className={state === 'listening' ? 'animate-wave-in' : state === 'speaking' ? 'animate-wave-out' : ''}
          />
          {/* Outer wave */}
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="white"
            strokeWidth="0.5"
            strokeOpacity="0.3"
            className={state === 'listening' ? 'animate-wave-in-delayed' : state === 'speaking' ? 'animate-wave-out-delayed' : ''}
          />
        </g>

        {/* Thinking indicator - rotating dots */}
        {state === 'thinking' && (
          <g className="animate-spin origin-center" style={{ transformOrigin: '50px 50px' }}>
            <circle cx="50" cy="16" r="3" fill="white" fillOpacity="0.9" />
            <circle cx="74" cy="26" r="2.5" fill="white" fillOpacity="0.7" />
            <circle cx="84" cy="50" r="2" fill="white" fillOpacity="0.5" />
            <circle cx="74" cy="74" r="1.5" fill="white" fillOpacity="0.3" />
          </g>
        )}

        {/* Connecting indicator - pulsing ring */}
        {state === 'connecting' && (
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeOpacity="0.5"
            className="animate-ping"
          />
        )}

        {/* Speech bubble container - larger for active states */}
        <g filter="url(#fab-active-glow)">
          {/* Speech bubble background */}
          <path
            d="M50 22
               C34 22, 22 34, 22 50
               C22 62, 28 72, 38 76
               L34 86
               L48 78
               C49 78.1, 49.5 78.2, 50 78.2
               C66 78.2, 78 66, 78 50
               C78 34, 66 22, 50 22Z"
            fill="white"
            className={`transition-opacity duration-300 ${styles.micIcon}`}
          />

          {/* Microphone body */}
          <rect
            x="43"
            y="36"
            width="14"
            height="20"
            rx="7"
            fill="url(#fab-gradient)"
          />

          {/* Sound wave lines - animated based on state */}
          <g className={`transition-opacity duration-300 ${state === 'listening' || state === 'speaking' ? 'opacity-100' : 'opacity-60'}`}>
            {/* Left wave inner */}
            <path
              d="M36 42 Q32 50, 36 58"
              stroke="url(#fab-gradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              className={state === 'listening' ? 'animate-wave-left' : state === 'speaking' ? 'animate-wave-left-speak' : ''}
            />
            {/* Left wave outer */}
            <path
              d="M30 38 Q24 50, 30 62"
              stroke="url(#fab-gradient)"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity="0.6"
              className={state === 'listening' ? 'animate-wave-left-outer' : state === 'speaking' ? 'animate-wave-left-speak-outer' : ''}
            />
            {/* Right wave inner */}
            <path
              d="M64 42 Q68 50, 64 58"
              stroke="url(#fab-gradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              className={state === 'listening' ? 'animate-wave-right' : state === 'speaking' ? 'animate-wave-right-speak' : ''}
            />
            {/* Right wave outer */}
            <path
              d="M70 38 Q76 50, 70 62"
              stroke="url(#fab-gradient)"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity="0.6"
              className={state === 'listening' ? 'animate-wave-right-outer' : state === 'speaking' ? 'animate-wave-right-speak-outer' : ''}
            />
          </g>

          {/* Microphone stand */}
          <path
            d="M50 56 L50 64 M42 64 L58 64"
            stroke="url(#fab-gradient)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>

        {/* Outer decorative ring - animated in active states */}
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke="white"
          strokeWidth="1"
          className={`transition-all duration-300 ${styles.outerRing}`}
        />
      </svg>

      {/* CSS animations */}
      <style jsx>{`
        @keyframes wave-in {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(0.95); opacity: 0.6; }
        }

        @keyframes wave-in-delayed {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(0.92); opacity: 0.5; }
        }

        @keyframes wave-out {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.05); opacity: 0.2; }
        }

        @keyframes wave-out-delayed {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.08); opacity: 0.1; }
        }

        @keyframes wave-left {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; transform: translateX(-2px); }
        }

        @keyframes wave-left-outer {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; transform: translateX(-3px); }
        }

        @keyframes wave-right {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; transform: translateX(2px); }
        }

        @keyframes wave-right-outer {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; transform: translateX(3px); }
        }

        @keyframes wave-left-speak {
          0%, 100% { opacity: 0.8; }
          25% { opacity: 1; transform: translateX(-4px) scaleY(1.1); }
          50% { opacity: 0.9; transform: translateX(-2px); }
          75% { opacity: 1; transform: translateX(-4px) scaleY(1.1); }
        }

        @keyframes wave-left-speak-outer {
          0%, 100% { opacity: 0.5; }
          25% { opacity: 0.9; transform: translateX(-5px) scaleY(1.15); }
          50% { opacity: 0.7; transform: translateX(-3px); }
          75% { opacity: 0.9; transform: translateX(-5px) scaleY(1.15); }
        }

        @keyframes wave-right-speak {
          0%, 100% { opacity: 0.8; }
          25% { opacity: 1; transform: translateX(4px) scaleY(1.1); }
          50% { opacity: 0.9; transform: translateX(2px); }
          75% { opacity: 1; transform: translateX(4px) scaleY(1.1); }
        }

        @keyframes wave-right-speak-outer {
          0%, 100% { opacity: 0.5; }
          25% { opacity: 0.9; transform: translateX(5px) scaleY(1.15); }
          50% { opacity: 0.7; transform: translateX(3px); }
          75% { opacity: 0.9; transform: translateX(5px) scaleY(1.15); }
        }

        .animate-wave-in {
          animation: wave-in 1s ease-in-out infinite;
          transform-origin: center;
        }

        .animate-wave-in-delayed {
          animation: wave-in-delayed 1s ease-in-out infinite 0.2s;
          transform-origin: center;
        }

        .animate-wave-out {
          animation: wave-out 0.8s ease-in-out infinite;
          transform-origin: center;
        }

        .animate-wave-out-delayed {
          animation: wave-out-delayed 0.8s ease-in-out infinite 0.15s;
          transform-origin: center;
        }

        .animate-wave-left {
          animation: wave-left 0.6s ease-in-out infinite;
        }

        .animate-wave-left-outer {
          animation: wave-left-outer 0.6s ease-in-out infinite 0.1s;
        }

        .animate-wave-right {
          animation: wave-right 0.6s ease-in-out infinite;
        }

        .animate-wave-right-outer {
          animation: wave-right-outer 0.6s ease-in-out infinite 0.1s;
        }

        .animate-wave-left-speak {
          animation: wave-left-speak 0.4s ease-in-out infinite;
        }

        .animate-wave-left-speak-outer {
          animation: wave-left-speak-outer 0.4s ease-in-out infinite 0.05s;
        }

        .animate-wave-right-speak {
          animation: wave-right-speak 0.4s ease-in-out infinite;
        }

        .animate-wave-right-speak-outer {
          animation: wave-right-speak-outer 0.4s ease-in-out infinite 0.05s;
        }

        .animate-spin {
          animation: spin 2s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .animate-ping {
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        @keyframes ping {
          75%, 100% {
            transform: scale(1.1);
            opacity: 0;
          }
        }
      `}</style>
    </button>
  );
};

export default VoiceFAB;
