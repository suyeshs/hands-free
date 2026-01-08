/**
 * Training Walkthrough Page
 * Full-page voice AI training experience
 * Can be accessed from provisioning or settings
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Circle, PlayCircle } from 'lucide-react';
import { TrainingOverlay } from '../components/training/TrainingOverlay';
import { TrainingAssistantProvider, useTrainingAssistant } from '../contexts/TrainingAssistantContext';
import {
  useTrainingStore,
  TRAINING_MODULES,
  isTrainingComplete,
} from '../stores/trainingStore';

interface TrainingWalkthroughProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

/**
 * Training Walkthrough Content (needs to be inside TrainingAssistantProvider)
 */
function TrainingWalkthroughContent({ onComplete, onSkip }: TrainingWalkthroughProps) {
  const navigate = useNavigate();

  const {
    isActive,
    completedModules,
    totalProgress,
    startTraining,
    stopTraining,
  } = useTrainingStore();

  const { isConnecting, error } = useTrainingAssistant();

  /**
   * Handle starting training with a specific module
   */
  const handleStartModule = useCallback(
    (moduleId: string) => {
      startTraining(moduleId as any);
    },
    [startTraining]
  );

  /**
   * Handle completing all training
   */
  const handleComplete = useCallback(() => {
    stopTraining();
    if (onComplete) {
      onComplete();
    } else {
      navigate('/hub');
    }
  }, [stopTraining, onComplete, navigate]);

  /**
   * Handle skipping training
   */
  const handleSkip = useCallback(() => {
    stopTraining();
    if (onSkip) {
      onSkip();
    } else {
      navigate('/hub');
    }
  }, [stopTraining, onSkip, navigate]);

  /**
   * Handle going back
   */
  const handleBack = useCallback(() => {
    if (isActive) {
      stopTraining();
    }
    navigate(-1);
  }, [isActive, stopTraining, navigate]);

  /**
   * Check if all modules are done
   */
  const allComplete = isTrainingComplete(completedModules);

  return (
    <div className="min-h-screen bg-background">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-accent/5 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={18} />
            Back
          </button>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Progress</span>
              <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${totalProgress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className="text-xs font-medium">{totalProgress}%</span>
            </div>

            <button
              onClick={handleSkip}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Skip Training
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-8">
        {/* Title section */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black uppercase tracking-wider mb-2">
            POS Training Walkthrough
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Learn to use your HandsFree POS system with our AI-guided training. Tap a module to begin
            or continue your training.
          </p>
        </div>

        {/* Connection status */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Module grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {TRAINING_MODULES.map((module, index) => {
            const isCompleted = completedModules.includes(module.id);
            const isCurrentModule = isActive && useTrainingStore.getState().session?.currentModule === module.id;

            return (
              <motion.button
                key={module.id}
                onClick={() => handleStartModule(module.id)}
                disabled={isActive && !isCurrentModule}
                className={`
                  relative p-6 rounded-2xl border text-left transition-all
                  ${isCurrentModule ? 'border-accent bg-accent/10' : 'border-border bg-card/50'}
                  ${isCompleted ? 'border-green-500/30 bg-green-500/5' : ''}
                  ${!isActive ? 'hover:border-accent/50 hover:bg-card' : ''}
                  ${isActive && !isCurrentModule ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                {/* Module number */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  {isCompleted ? (
                    <CheckCircle2 size={20} className="text-green-400" />
                  ) : isCurrentModule ? (
                    <div className="w-5 h-5 rounded-full bg-accent animate-pulse" />
                  ) : (
                    <Circle size={20} className="text-muted-foreground/30" />
                  )}
                </div>

                {/* Module content */}
                <div className="flex items-start gap-4">
                  <span className="text-3xl">{module.icon}</span>
                  <div>
                    <h3 className="font-bold mb-1">{module.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {module.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>~{module.estimatedMinutes} min</span>
                      {isCurrentModule && (
                        <span className="text-accent font-medium">In Progress</span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Quick start section */}
        {!isActive && (
          <div className="mt-8 p-6 bg-card/50 border border-border rounded-2xl text-center">
            <h3 className="font-bold mb-2">Ready to Start?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Our AI assistant will guide you through each feature with voice instructions and
              interactive practice scenarios.
            </p>

            <button
              onClick={() => {
                // Find first incomplete module or start from beginning
                const nextModule = TRAINING_MODULES.find((m) => !completedModules.includes(m.id));
                handleStartModule(nextModule?.id || 'pos_basics');
              }}
              disabled={isConnecting}
              className={`
                inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-accent text-white font-bold
                uppercase tracking-widest text-sm shadow-lg shadow-accent/20
                hover:scale-[1.02] transition-all
                ${isConnecting ? 'opacity-70 cursor-wait' : ''}
              `}
            >
              {isConnecting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <PlayCircle size={20} />
                  {completedModules.length > 0 ? 'Continue Training' : 'Start Training'}
                </>
              )}
            </button>
          </div>
        )}

        {/* Completion section */}
        {allComplete && (
          <motion.div
            className="mt-8 p-8 bg-green-500/10 border border-green-500/30 rounded-2xl text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-green-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Training Complete!</h3>
            <p className="text-muted-foreground mb-6">
              Congratulations! You've completed all training modules. You're ready to use your POS
              system like a pro.
            </p>
            <button
              onClick={handleComplete}
              className="px-8 py-4 rounded-xl bg-green-500 text-white font-bold uppercase tracking-widest text-sm shadow-lg shadow-green-500/20 hover:scale-[1.02] transition-all"
            >
              Finish Training
            </button>
          </motion.div>
        )}
      </main>

      {/* Training overlay (shows when active) */}
      <TrainingOverlay />
    </div>
  );
}

/**
 * Training Walkthrough Page (with provider)
 */
export function TrainingWalkthrough(props: TrainingWalkthroughProps) {
  return (
    <TrainingAssistantProvider>
      <TrainingWalkthroughContent {...props} />
    </TrainingAssistantProvider>
  );
}

export default TrainingWalkthrough;
