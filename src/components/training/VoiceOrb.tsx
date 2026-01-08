/**
 * Voice Orb Component
 * Interactive voice input UI with audio visualization
 * Adapted from the restaurant client's VoiceOrb
 */

import { useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTrainingAssistant } from '../../contexts/TrainingAssistantContext';
import { useTrainingStore } from '../../stores/trainingStore';
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react';

interface VoiceOrbProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
}

/**
 * Get orb size in pixels
 */
function getOrbSize(size: 'sm' | 'md' | 'lg'): number {
  switch (size) {
    case 'sm':
      return 48;
    case 'md':
      return 80;
    case 'lg':
      return 120;
  }
}

/**
 * Voice Orb Component
 */
export function VoiceOrb({ size = 'md', className = '', showLabel = true }: VoiceOrbProps) {
  const {
    isConnected,
    isConnecting,
    isListening,
    isSpeaking,
    audioLevel,
    startListening,
    stopListening,
    interruptSpeech,
  } = useTrainingAssistant();

  const { assistantState, voiceEnabled } = useTrainingStore();

  const orbSize = getOrbSize(size);
  const iconSize = orbSize * 0.35;

  /**
   * Handle orb click
   */
  const handleClick = useCallback(() => {
    if (!isConnected || !voiceEnabled) return;

    if (isSpeaking) {
      // Interrupt AI speech
      interruptSpeech();
    } else if (isListening) {
      // Stop listening
      stopListening();
    } else {
      // Start listening
      startListening();
    }
  }, [isConnected, voiceEnabled, isSpeaking, isListening, interruptSpeech, stopListening, startListening]);

  /**
   * Determine orb state for styling
   */
  const orbState = useMemo(() => {
    if (isConnecting) return 'connecting';
    if (!isConnected) return 'disconnected';
    if (!voiceEnabled) return 'disabled';
    if (isSpeaking) return 'speaking';
    if (isListening) return 'listening';
    if (assistantState === 'processing') return 'processing';
    return 'idle';
  }, [isConnecting, isConnected, voiceEnabled, isSpeaking, isListening, assistantState]);

  /**
   * Get orb colors based on state
   */
  const orbColors = useMemo(() => {
    switch (orbState) {
      case 'connecting':
        return {
          bg: 'bg-yellow-500/20',
          border: 'border-yellow-400/50',
          glow: 'shadow-yellow-500/30',
          pulse: 'bg-yellow-400',
        };
      case 'disconnected':
        return {
          bg: 'bg-gray-500/20',
          border: 'border-gray-400/30',
          glow: '',
          pulse: 'bg-gray-400',
        };
      case 'disabled':
        return {
          bg: 'bg-gray-500/20',
          border: 'border-gray-400/30',
          glow: '',
          pulse: 'bg-gray-400',
        };
      case 'listening':
        return {
          bg: 'bg-red-500/20',
          border: 'border-red-400/60',
          glow: 'shadow-red-500/40',
          pulse: 'bg-red-400',
        };
      case 'speaking':
        return {
          bg: 'bg-blue-500/20',
          border: 'border-blue-400/60',
          glow: 'shadow-blue-500/40',
          pulse: 'bg-blue-400',
        };
      case 'processing':
        return {
          bg: 'bg-purple-500/20',
          border: 'border-purple-400/50',
          glow: 'shadow-purple-500/30',
          pulse: 'bg-purple-400',
        };
      default: // idle
        return {
          bg: 'bg-accent/20',
          border: 'border-accent/40',
          glow: 'shadow-accent/20',
          pulse: 'bg-accent',
        };
    }
  }, [orbState]);

  /**
   * Get icon for current state
   */
  const Icon = useMemo(() => {
    switch (orbState) {
      case 'connecting':
      case 'processing':
        return Loader2;
      case 'speaking':
        return Volume2;
      case 'listening':
        return Mic;
      default:
        return voiceEnabled ? Mic : MicOff;
    }
  }, [orbState, voiceEnabled]);

  /**
   * Get label text
   */
  const labelText = useMemo(() => {
    switch (orbState) {
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Not connected';
      case 'disabled':
        return 'Voice disabled';
      case 'listening':
        return 'Listening...';
      case 'speaking':
        return 'Speaking...';
      case 'processing':
        return 'Thinking...';
      default:
        return 'Tap to speak';
    }
  }, [orbState]);

  /**
   * Calculate audio visualization scale
   */
  const audioScale = useMemo(() => {
    if (isListening) {
      // Scale based on audio input level
      return 1 + audioLevel * 0.3;
    }
    if (isSpeaking) {
      // Pulse effect while speaking
      return 1.1;
    }
    return 1;
  }, [isListening, isSpeaking, audioLevel]);

  const isInteractive = isConnected && voiceEnabled && orbState !== 'connecting' && orbState !== 'processing';

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* Orb container */}
      <motion.button
        onClick={handleClick}
        disabled={!isInteractive}
        className={`
          relative rounded-full flex items-center justify-center
          transition-all duration-300 ease-out
          ${orbColors.bg} ${orbColors.border} border-2
          ${isInteractive ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed opacity-70'}
          ${orbColors.glow} shadow-lg
        `}
        style={{ width: orbSize, height: orbSize }}
        whileTap={isInteractive ? { scale: 0.95 } : undefined}
        animate={{
          scale: audioScale,
        }}
        transition={{
          scale: { type: 'spring', stiffness: 300, damping: 20 },
        }}
      >
        {/* Pulse ring animation */}
        <AnimatePresence>
          {(isListening || isSpeaking) && (
            <motion.div
              className={`absolute inset-0 rounded-full ${orbColors.pulse} opacity-30`}
              initial={{ scale: 1, opacity: 0.3 }}
              animate={{
                scale: [1, 1.4, 1],
                opacity: [0.3, 0, 0.3],
              }}
              exit={{ scale: 1, opacity: 0 }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          )}
        </AnimatePresence>

        {/* Audio level rings */}
        {isListening && audioLevel > 0.1 && (
          <>
            <motion.div
              className={`absolute inset-0 rounded-full border-2 ${orbColors.border}`}
              animate={{
                scale: 1 + audioLevel * 0.5,
                opacity: audioLevel * 0.6,
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
            {audioLevel > 0.3 && (
              <motion.div
                className={`absolute inset-0 rounded-full border ${orbColors.border}`}
                animate={{
                  scale: 1 + audioLevel * 0.8,
                  opacity: audioLevel * 0.3,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              />
            )}
          </>
        )}

        {/* Icon */}
        <Icon
          size={iconSize}
          className={`
            ${orbState === 'connecting' || orbState === 'processing' ? 'animate-spin' : ''}
            ${orbState === 'listening' ? 'text-red-400' : ''}
            ${orbState === 'speaking' ? 'text-blue-400' : ''}
            ${orbState === 'idle' ? 'text-accent' : ''}
            ${orbState === 'disconnected' || orbState === 'disabled' ? 'text-gray-400' : ''}
            transition-colors duration-300
          `}
        />
      </motion.button>

      {/* Label */}
      {showLabel && (
        <motion.span
          key={labelText}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 5 }}
          className={`
            text-xs font-medium uppercase tracking-wider
            ${orbState === 'listening' ? 'text-red-400' : ''}
            ${orbState === 'speaking' ? 'text-blue-400' : ''}
            ${orbState === 'processing' ? 'text-purple-400' : ''}
            ${orbState === 'idle' ? 'text-muted-foreground' : ''}
            ${orbState === 'connecting' ? 'text-yellow-400' : ''}
            ${orbState === 'disconnected' || orbState === 'disabled' ? 'text-gray-500' : ''}
          `}
        >
          {labelText}
        </motion.span>
      )}
    </div>
  );
}

/**
 * Compact voice indicator for header/status bar
 */
export function VoiceIndicator() {
  const { isConnected, isListening, isSpeaking } = useTrainingAssistant();
  const { assistantState } = useTrainingStore();

  if (!isConnected) return null;

  const getColor = () => {
    if (isListening) return 'bg-red-400';
    if (isSpeaking) return 'bg-blue-400';
    if (assistantState === 'processing') return 'bg-purple-400';
    return 'bg-green-400';
  };

  const getText = () => {
    if (isListening) return 'Listening';
    if (isSpeaking) return 'Speaking';
    if (assistantState === 'processing') return 'Processing';
    return 'Ready';
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 border border-border">
      <motion.div
        className={`w-2 h-2 rounded-full ${getColor()}`}
        animate={{
          scale: isListening || isSpeaking ? [1, 1.2, 1] : 1,
        }}
        transition={{
          duration: 0.5,
          repeat: isListening || isSpeaking ? Infinity : 0,
        }}
      />
      <span className="text-xs font-medium text-muted-foreground">{getText()}</span>
    </div>
  );
}

export default VoiceOrb;
