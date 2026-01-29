/**
 * Menu Upload Progress Modal
 * Shows animated progress for multi-stage menu upload process
 * Stages: Upload → AI Parsing → Saving to Database → Cloud Sync
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Sparkles, Database, Cloud, CheckCircle2, Loader2 } from 'lucide-react';

export type UploadStage = 'uploading' | 'parsing' | 'saving' | 'syncing' | 'complete';

interface StageConfig {
  key: UploadStage;
  label: string;
  description: string;
  icon: typeof Upload;
  color: string;
}

const stages: StageConfig[] = [
  {
    key: 'uploading',
    label: 'Uploading',
    description: 'Uploading your menu file to cloud storage...',
    icon: Upload,
    color: 'text-blue-500',
  },
  {
    key: 'parsing',
    label: 'AI Parsing',
    description: 'Analyzing and extracting menu items with AI...',
    icon: Sparkles,
    color: 'text-purple-500',
  },
  {
    key: 'saving',
    label: 'Saving to Database',
    description: 'Storing menu items in your local database...',
    icon: Database,
    color: 'text-green-500',
  },
  {
    key: 'syncing',
    label: 'Cloud Sync',
    description: 'Syncing to cloud for voice ordering (optional)...',
    icon: Cloud,
    color: 'text-cyan-500',
  },
  {
    key: 'complete',
    label: 'Complete',
    description: 'Your menu has been successfully uploaded!',
    icon: CheckCircle2,
    color: 'text-green-500',
  },
];

interface MenuUploadProgressProps {
  isOpen: boolean;
  currentStage: UploadStage;
  uploadProgress?: number; // 0-100 for upload stage
  itemsCount?: number; // Number of items parsed
}

export function MenuUploadProgress({
  isOpen,
  currentStage,
  uploadProgress = 0,
  itemsCount,
}: MenuUploadProgressProps) {
  const currentStageIndex = stages.findIndex(s => s.key === currentStage);
  const currentStageConfig = stages[currentStageIndex];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <motion.div
            className="bg-gradient-to-br from-zinc-900 to-black border-2 border-zinc-700/50 rounded-3xl p-8 max-w-lg w-full shadow-2xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
          >
            {/* Current Stage Icon and Label */}
            <div className="text-center mb-8">
              <motion.div
                className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 mb-4"
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: currentStage === 'parsing' ? [0, 360] : 0,
                }}
                transition={{
                  scale: { duration: 2, repeat: Infinity },
                  rotate: { duration: 3, repeat: Infinity, ease: 'linear' },
                }}
              >
                {currentStage === 'complete' ? (
                  <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={3} />
                ) : (
                  <Loader2 className="w-12 h-12 text-white animate-spin" />
                )}
              </motion.div>

              <h2 className="text-2xl font-bold text-white mb-2">
                {currentStageConfig?.label}
              </h2>
              <p className="text-muted-foreground text-sm">
                {currentStageConfig?.description}
              </p>

              {/* Show items count during parsing */}
              {currentStage === 'parsing' && itemsCount !== undefined && (
                <motion.p
                  className="text-purple-400 font-semibold mt-3"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  ✨ Found {itemsCount} menu items
                </motion.p>
              )}

              {/* Show upload percentage */}
              {currentStage === 'uploading' && uploadProgress > 0 && (
                <motion.div
                  className="mt-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <p className="text-blue-400 font-semibold mt-2">
                    {uploadProgress}%
                  </p>
                </motion.div>
              )}
            </div>

            {/* Stage Progress Indicators */}
            <div className="space-y-3">
              {stages.slice(0, -1).map((stage, index) => {
                const isCompleted = index < currentStageIndex;
                const isCurrent = index === currentStageIndex;
                const StageIcon = stage.icon;

                return (
                  <motion.div
                    key={stage.key}
                    className={`flex items-center gap-4 p-3  transition-all ${
                      isCurrent
                        ? 'bg-white/10 border-2 border-orange-500/50'
                        : isCompleted
                        ? 'bg-green-500/10 border border-green-500/30'
                        : 'bg-white/5 border border-white/10'
                    }`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    {/* Stage Icon */}
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        isCompleted
                          ? 'bg-green-500'
                          : isCurrent
                          ? 'bg-gradient-to-br from-orange-500 to-pink-500'
                          : 'bg-zinc-700'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-white" strokeWidth={3} />
                      ) : isCurrent ? (
                        <StageIcon className="w-5 h-5 text-white animate-pulse" />
                      ) : (
                        <StageIcon className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>

                    {/* Stage Label */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-semibold text-sm ${
                          isCompleted
                            ? 'text-green-400'
                            : isCurrent
                            ? 'text-white'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {stage.label}
                      </p>
                      {isCurrent && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {stage.description.split('...')[0]}...
                        </p>
                      )}
                    </div>

                    {/* Status Indicator */}
                    {isCurrent && (
                      <motion.div
                        className="flex-shrink-0"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <Loader2 className="w-4 h-4 text-orange-500" />
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Completion Message */}
            {currentStage === 'complete' && (
              <motion.div
                className="mt-6 p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500/30"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p className="text-center text-green-300 font-semibold">
                  🎉 Menu uploaded successfully!
                </p>
                {itemsCount !== undefined && (
                  <p className="text-center text-green-400 text-sm mt-1">
                    {itemsCount} items added to your menu
                  </p>
                )}
              </motion.div>
            )}

            {/* Help Text */}
            {currentStage !== 'complete' && (
              <motion.p
                className="text-center text-xs text-muted-foreground mt-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                Please wait while we process your menu. This may take a minute...
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
