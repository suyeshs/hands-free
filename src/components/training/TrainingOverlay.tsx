/**
 * Training Overlay Component
 * Full-screen overlay for voice AI training mode
 */

import { useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { X, SkipForward, Pause, Play, Settings2 } from 'lucide-react';
import { VoiceOrb } from './VoiceOrb';
import { FeatureHighlight } from './FeatureHighlight';
import { useTrainingStore, getModuleInfo, TRAINING_MODULES } from '../../stores/trainingStore';
import {
  useTrainingAssistant,
  useTrainingFunctionHandler,
} from '../../contexts/TrainingAssistantContext';

/**
 * Training Overlay Component
 */
export function TrainingOverlay() {
  const navigate = useNavigate();

  const {
    isActive,
    session,
    showOverlay,
    activeHighlights,
    currentInstruction,
    completedModules,
    totalProgress,
    isPanelMinimized,
    stopTraining,
    pauseTraining,
    resumeTraining,
    setCurrentModule,
    markModuleComplete,
    clearHighlights,
    addHighlight,
    togglePanel,
  } = useTrainingStore();

  const { isConnected, sendTextMessage } = useTrainingAssistant();

  /**
   * Handle navigation function calls from AI
   */
  useTrainingFunctionHandler(
    'navigate_to_screen',
    (args) => {
      const screen = args.screen as string;
      const routes: Record<string, string> = {
        pos: '/pos',
        kds: '/kitchen',
        settings: '/settings',
        reports: '/reports',
        hub: '/hub',
      };
      const route = routes[screen];
      if (route) {
        navigate(route);
      }
    },
    [navigate]
  );

  /**
   * Handle highlight function calls from AI
   */
  useTrainingFunctionHandler(
    'highlight_element',
    (args) => {
      addHighlight({
        selector: args.selector as string,
        message: args.message as string,
        position: (args.position as 'top' | 'bottom' | 'left' | 'right') || 'bottom',
      });
    },
    [addHighlight]
  );

  /**
   * Handle clear highlights from AI
   */
  useTrainingFunctionHandler('clear_highlights', () => {
    clearHighlights();
  }, [clearHighlights]);

  /**
   * Handle module completion from AI
   */
  useTrainingFunctionHandler(
    'mark_module_complete',
    (args) => {
      const module = args.module as string;
      markModuleComplete(module as any);
    },
    [markModuleComplete]
  );

  /**
   * Handle hint display from AI
   */
  useTrainingFunctionHandler(
    'show_hint',
    (args) => {
      // For now, hints are shown via the instruction area
      // Could be enhanced with toast notifications
      console.log('[Training] Hint:', args.message);
    },
    []
  );

  /**
   * Handle celebration from AI
   */
  useTrainingFunctionHandler('play_celebration', () => {
    // Play a success sound or animation
    // For now, just log
    console.log('[Training] 🎉 Celebration!');
  }, []);

  /**
   * Handle keyboard shortcuts
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return;

      if (e.key === 'Escape') {
        if (showOverlay) {
          pauseTraining();
        } else {
          resumeTraining();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, showOverlay, pauseTraining, resumeTraining]);

  /**
   * Skip current module
   */
  const handleSkipModule = useCallback(() => {
    if (!session) return;

    const currentIndex = TRAINING_MODULES.findIndex((m) => m.id === session.currentModule);
    if (currentIndex < TRAINING_MODULES.length - 1) {
      const nextModule = TRAINING_MODULES[currentIndex + 1];
      setCurrentModule(nextModule.id);
      sendTextMessage(`Let's skip to ${nextModule.title}`);
    } else {
      // Last module - finish training
      stopTraining();
    }
  }, [session, setCurrentModule, sendTextMessage, stopTraining]);

  /**
   * Exit training
   */
  const handleExitTraining = useCallback(() => {
    if (
      window.confirm(
        'Are you sure you want to exit training? Your progress will be saved.'
      )
    ) {
      stopTraining();
    }
  }, [stopTraining]);

  if (!isActive) return null;

  const moduleInfo = session ? getModuleInfo(session.currentModule) : null;

  return (
    <>
      {/* Feature highlights */}
      {activeHighlights.map((highlight, index) => (
        <FeatureHighlight
          key={`${highlight.selector}-${index}`}
          selector={highlight.selector}
          message={highlight.message}
          position={highlight.position}
          onDismiss={() => clearHighlights()}
        />
      ))}

      {/* Training panel */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[9990] pointer-events-none"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Training panel container */}
            <div className="flex flex-col items-center pb-6 pointer-events-auto">
              {/* Instruction bubble */}
              <AnimatePresence mode="wait">
                {currentInstruction && !isPanelMinimized && (
                  <motion.div
                    key={currentInstruction}
                    className="max-w-lg mx-auto mb-4 px-6 py-4 bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-xl"
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="text-sm text-foreground text-center">{currentInstruction}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main control panel */}
              <motion.div
                className={`
                  bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl
                  ${isPanelMinimized ? 'p-3' : 'p-6'}
                `}
                layout
              >
                {isPanelMinimized ? (
                  /* Minimized view */
                  <div className="flex items-center gap-4">
                    <VoiceOrb size="sm" showLabel={false} />

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {moduleInfo?.icon} {moduleInfo?.title}
                      </span>
                      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent transition-all duration-300"
                          style={{ width: `${totalProgress}%` }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={togglePanel}
                      className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Settings2 size={16} className="text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  /* Expanded view */
                  <div className="flex flex-col items-center gap-4">
                    {/* Module info */}
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <span className="text-2xl">{moduleInfo?.icon}</span>
                        <h3 className="text-sm font-bold uppercase tracking-wider">
                          {moduleInfo?.title}
                        </h3>
                      </div>
                      <p className="text-xs text-muted-foreground">{moduleInfo?.description}</p>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full max-w-xs">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Overall Progress</span>
                        <span>{totalProgress}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-accent"
                          initial={{ width: 0 }}
                          animate={{ width: `${totalProgress}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                    </div>

                    {/* Voice orb */}
                    <VoiceOrb size="lg" />

                    {/* Control buttons */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSkipModule}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <SkipForward size={14} />
                        Skip Module
                      </button>

                      <button
                        onClick={togglePanel}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <Pause size={14} />
                        Minimize
                      </button>

                      <button
                        onClick={handleExitTraining}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      >
                        <X size={14} />
                        Exit
                      </button>
                    </div>

                    {/* Module quick select */}
                    <div className="flex flex-wrap justify-center gap-2 max-w-md">
                      {TRAINING_MODULES.map((module) => {
                        const isCompleted = completedModules.includes(module.id);
                        const isCurrent = session?.currentModule === module.id;

                        return (
                          <button
                            key={module.id}
                            onClick={() => {
                              setCurrentModule(module.id);
                              sendTextMessage(`Let's learn about ${module.title}`);
                            }}
                            className={`
                              flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors
                              ${isCurrent ? 'bg-accent text-white' : ''}
                              ${isCompleted && !isCurrent ? 'bg-green-500/20 text-green-400' : ''}
                              ${!isCompleted && !isCurrent ? 'bg-muted/50 text-muted-foreground hover:bg-muted' : ''}
                            `}
                          >
                            <span>{module.icon}</span>
                            {isCompleted && !isCurrent && <span>✓</span>}
                          </button>
                        );
                      })}
                    </div>

                    {/* Connection status */}
                    {!isConnected && (
                      <p className="text-xs text-yellow-400">Reconnecting to training assistant...</p>
                    )}
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resume button when minimized/hidden */}
      <AnimatePresence>
        {isActive && !showOverlay && (
          <motion.button
            className="fixed bottom-6 right-6 z-[9990] p-4 bg-accent rounded-full shadow-lg shadow-accent/30 hover:scale-105 transition-transform"
            onClick={resumeTraining}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Play size={24} className="text-white" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}

export default TrainingOverlay;
