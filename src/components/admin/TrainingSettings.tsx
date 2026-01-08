/**
 * Training Settings Component
 * Access to Voice AI training walkthrough from Settings
 */

import { useNavigate } from 'react-router-dom';
import { PlayCircle, CheckCircle2, RotateCcw, Mic } from 'lucide-react';
import {
  useTrainingStore,
  TRAINING_MODULES,
  VOICE_PRESETS,
  isTrainingComplete,
} from '../../stores/trainingStore';

export function TrainingSettings() {
  const navigate = useNavigate();
  const {
    completedModules,
    totalProgress,
    voicePreset,
    voiceEnabled,
    setVoicePreset,
    setVoiceEnabled,
    resetProgress,
  } = useTrainingStore();

  const allComplete = isTrainingComplete(completedModules);

  const handleStartTraining = () => {
    navigate('/training');
  };

  const handleResetProgress = () => {
    if (window.confirm('Are you sure you want to reset all training progress? This cannot be undone.')) {
      resetProgress();
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🎙️</span>
        </div>
        <h2 className="text-xl font-bold">Voice AI Training</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Learn to use your POS with an AI voice assistant
        </p>
      </div>

      {/* Progress Card */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Training Progress</span>
          <span className="text-sm text-muted-foreground">{totalProgress}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${totalProgress}%` }}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{completedModules.length} of {TRAINING_MODULES.length} modules completed</span>
          {allComplete && (
            <span className="text-green-400 font-medium">All Complete!</span>
          )}
        </div>
      </div>

      {/* Module List */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium px-1">Training Modules</h3>
        <div className="space-y-2">
          {TRAINING_MODULES.map((module) => {
            const isCompleted = completedModules.includes(module.id);
            return (
              <div
                key={module.id}
                className={`
                  flex items-center gap-3 p-3 rounded-lg border transition-colors
                  ${isCompleted ? 'bg-green-500/5 border-green-500/30' : 'bg-card border-border'}
                `}
              >
                <span className="text-xl">{module.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{module.title}</span>
                    {isCompleted && (
                      <CheckCircle2 size={14} className="text-green-400" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {module.description}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  ~{module.estimatedMinutes} min
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Voice Settings */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium px-1">Voice Settings</h3>

        {/* Voice Enabled Toggle */}
        <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <Mic size={18} className="text-muted-foreground" />
            <span className="text-sm">Voice Assistant</span>
          </div>
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`
              relative w-12 h-6 rounded-full transition-colors
              ${voiceEnabled ? 'bg-accent' : 'bg-muted'}
            `}
          >
            <div
              className={`
                absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                ${voiceEnabled ? 'left-7' : 'left-1'}
              `}
            />
          </button>
        </div>

        {/* Voice Preset Selector */}
        {voiceEnabled && (
          <div className="p-3 bg-card rounded-lg border border-border">
            <label className="text-sm text-muted-foreground mb-2 block">Voice Style</label>
            <select
              value={voicePreset}
              onChange={(e) => setVoicePreset(e.target.value as any)}
              className="w-full p-2 bg-background border border-border rounded-lg text-sm"
            >
              {VOICE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} - {preset.description}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 pt-4">
        <button
          onClick={handleStartTraining}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-accent text-white font-bold uppercase tracking-wider text-sm shadow-lg shadow-accent/20 hover:scale-[1.02] transition-all"
        >
          <PlayCircle size={20} />
          {completedModules.length > 0 ? 'Continue Training' : 'Start Training'}
        </button>

        {completedModules.length > 0 && (
          <button
            onClick={handleResetProgress}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-muted-foreground font-medium text-sm hover:bg-white/10 transition-all"
          >
            <RotateCcw size={16} />
            Reset Progress
          </button>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-center">
        <p className="text-sm text-blue-200">
          The AI assistant will guide you through each feature with voice instructions and
          interactive practice scenarios.
        </p>
      </div>
    </div>
  );
}

export default TrainingSettings;
