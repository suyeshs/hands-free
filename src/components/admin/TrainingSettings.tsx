/**
 * Training Settings Component
 * Access to Voice AI training walkthrough from Settings
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayCircle, CheckCircle2, RotateCcw, Mic, AlertCircle, Rocket } from 'lucide-react';
import {
  useTrainingStore,
  TRAINING_MODULES,
  VOICE_PRESETS,
  isTrainingComplete,
} from '../../stores/trainingStore';
import { useProvisioningStore } from '../../stores/provisioningStore';

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

  const { isTrainingMode, setTrainingMode, goLive } = useProvisioningStore();
  const [showGoLiveConfirm, setShowGoLiveConfirm] = useState(false);
  const [confirmChecklist, setConfirmChecklist] = useState({
    testOrders: false,
    menuReviewed: false,
    settingsComplete: false,
    readyForCustomers: false,
  });

  const allComplete = isTrainingComplete(completedModules);
  const allChecked = Object.values(confirmChecklist).every(Boolean);

  const handleStartTraining = () => {
    navigate('/training');
  };

  const handleResetProgress = () => {
    if (window.confirm('Are you sure you want to reset all training progress? This cannot be undone.')) {
      resetProgress();
    }
  };

  const handleToggleTrainingMode = () => {
    if (isTrainingMode) {
      // Switching from training to live - show confirmation
      setShowGoLiveConfirm(true);
    } else {
      // Switching from live to training - simple confirmation
      if (window.confirm('Switch back to Training Mode? Test orders will not sync to cloud.')) {
        setTrainingMode(true);
        window.location.reload();
      }
    }
  };

  const handleConfirmGoLive = () => {
    if (!allChecked) return;
    goLive();
    setShowGoLiveConfirm(false);
    window.location.reload();
  };

  const toggleChecklistItem = (key: keyof typeof confirmChecklist) => {
    setConfirmChecklist((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="p-4 space-y-6">
      {/* Training Mode Toggle Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium px-1">System Mode</h3>
        <div className={`p-4 rounded-xl border-2 ${isTrainingMode ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isTrainingMode ? 'bg-yellow-500/20' : 'bg-green-500/20'}`}>
                {isTrainingMode ? (
                  <span className="text-xl">🎓</span>
                ) : (
                  <Rocket size={20} className="text-green-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">
                    {isTrainingMode ? 'Training Mode' : 'Live Mode'}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${isTrainingMode ? 'bg-yellow-400' : 'bg-green-400'} animate-pulse`} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {isTrainingMode
                    ? 'Orders are not synced to cloud'
                    : 'Orders are synced and invoices active'}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleToggleTrainingMode}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all ${
              isTrainingMode
                ? 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/20'
                : 'bg-yellow-500 text-yellow-950 hover:bg-yellow-600 shadow-lg shadow-yellow-500/20'
            }`}
          >
            {isTrainingMode ? 'Switch to Live Mode' : 'Switch to Training Mode'}
          </button>
        </div>

        {isTrainingMode && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
            <p className="text-xs text-blue-200">
              <strong>Training Mode:</strong> Perfect for practice! Orders won't affect real data or invoices.
            </p>
          </div>
        )}
      </div>

      {/* Go Live Confirmation Dialog */}
      {showGoLiveConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-2xl p-6 max-w-md w-full animate-fade-in shadow-2xl">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Rocket size={32} className="text-green-400" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-wider mb-2">
                Ready to Go Live?
              </h2>
              <p className="text-muted-foreground text-sm">
                Please confirm the following before going live
              </p>
            </div>

            {/* Checklist */}
            <div className="space-y-3 mb-6">
              <ChecklistItem
                checked={confirmChecklist.testOrders}
                onChange={() => toggleChecklistItem('testOrders')}
                label="I have tested creating orders in training mode"
              />
              <ChecklistItem
                checked={confirmChecklist.menuReviewed}
                onChange={() => toggleChecklistItem('menuReviewed')}
                label="I have reviewed my menu items and prices"
              />
              <ChecklistItem
                checked={confirmChecklist.settingsComplete}
                onChange={() => toggleChecklistItem('settingsComplete')}
                label="My restaurant settings (GST, invoice) are correct"
              />
              <ChecklistItem
                checked={confirmChecklist.readyForCustomers}
                onChange={() => toggleChecklistItem('readyForCustomers')}
                label="I am ready to accept real customer orders"
              />
            </div>

            {/* Warning */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-6">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-200">
                  Once you go live, all orders will be real and synced to the cloud. You can still switch back to training mode later.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowGoLiveConfirm(false);
                  setConfirmChecklist({
                    testOrders: false,
                    menuReviewed: false,
                    settingsComplete: false,
                    readyForCustomers: false,
                  });
                }}
                className="flex-1 py-3 rounded-xl bg-surface-2 border border-border text-foreground font-bold text-sm hover:bg-surface-3 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmGoLive}
                disabled={!allChecked}
                className="flex-1 py-3 rounded-xl bg-green-500 text-white font-bold text-sm shadow-lg shadow-green-500/20 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 transition-all"
              >
                Go Live!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-border" />
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

interface ChecklistItemProps {
  checked: boolean;
  onChange: () => void;
  label: string;
}

function ChecklistItem({ checked, onChange, label }: ChecklistItemProps) {
  return (
    <button
      onClick={onChange}
      className={`w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3 ${
        checked
          ? 'bg-green-500/10 border-green-500/30'
          : 'bg-surface-2 border-border hover:bg-surface-3'
      }`}
    >
      <div
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
          checked
            ? 'bg-green-500 border-green-500'
            : 'border-muted-foreground/30'
        }`}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className={`text-sm ${checked ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </button>
  );
}

export default TrainingSettings;
