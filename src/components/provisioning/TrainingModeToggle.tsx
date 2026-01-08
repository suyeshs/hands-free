/**
 * Training Mode Toggle Component
 * Final step before going live - choose training or live mode
 * Now includes option for voice AI training walkthrough
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProvisioningStore } from '../../stores/provisioningStore';

export function TrainingModeToggle() {
  const navigate = useNavigate();
  const { setTrainingMode, completeProvisioning, goLive } = useProvisioningStore();

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmChecklist, setConfirmChecklist] = useState({
    testOrders: false,
    menuReviewed: false,
    settingsComplete: false,
    readyForCustomers: false,
  });

  const allChecked = Object.values(confirmChecklist).every(Boolean);

  const handleTrainingMode = () => {
    setTrainingMode(true);
    completeProvisioning();
  };

  const handleTrainingWalkthrough = () => {
    setTrainingMode(true);
    completeProvisioning();
    // Navigate to training walkthrough after provisioning
    setTimeout(() => {
      navigate('/training');
    }, 100);
  };

  const handleGoLiveClick = () => {
    setShowConfirmation(true);
  };

  const handleConfirmGoLive = () => {
    if (!allChecked) return;
    goLive();
  };

  const toggleChecklistItem = (key: keyof typeof confirmChecklist) => {
    setConfirmChecklist((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Go Live confirmation dialog
  if (showConfirmation) {
    return (
      <div className="glass-panel rounded-2xl border border-border p-8 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🚀</span>
          </div>
          <h1 className="text-xl font-black uppercase tracking-wider mb-2">
            Ready to Go Live?
          </h1>
          <p className="text-muted-foreground text-sm">
            Please confirm the following before going live
          </p>
        </div>

        {/* Checklist */}
        <div className="space-y-3 mb-8">
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
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
          <p className="text-sm text-yellow-200">
            <span className="font-bold">Note:</span> Once you go live, all orders will be real and
            will be synced to the cloud. You can still switch to training mode later from Settings.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => setShowConfirmation(false)}
            className="flex-1 py-4 rounded-xl bg-white/5 border border-white/10 text-foreground font-bold uppercase tracking-widest text-sm hover:bg-white/10 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmGoLive}
            disabled={!allChecked}
            className="flex-1 py-4 rounded-xl bg-green-500 text-white font-bold uppercase tracking-widest text-sm shadow-lg shadow-green-500/20 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 transition-all"
          >
            Go Live!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl border border-border p-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🎯</span>
        </div>
        <h1 className="text-xl font-black uppercase tracking-wider mb-2">
          Choose Your Mode
        </h1>
        <p className="text-muted-foreground text-sm">
          Start in training mode to practice, or go live immediately
        </p>
      </div>

      {/* Mode Options */}
      <div className="space-y-4 mb-8">
        {/* Voice AI Training Walkthrough */}
        <button
          onClick={handleTrainingWalkthrough}
          className="w-full p-6 rounded-xl bg-accent/10 border-2 border-accent/50 text-left hover:bg-accent/15 transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-accent/20 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <span className="text-3xl">🎙️</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-lg text-foreground">Voice AI Training</h3>
                <span className="text-xs bg-accent/30 text-accent px-2 py-0.5 rounded-full font-bold uppercase">
                  Best Experience
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Learn with a voice AI assistant guiding you step-by-step
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <span className="text-accent">✓</span>
                  Interactive voice-guided walkthrough
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent">✓</span>
                  Practice with simulated orders
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent">✓</span>
                  Covers POS, payments, KDS, and more
                </li>
              </ul>
            </div>
          </div>
        </button>

        {/* Training Mode (Self-guided) */}
        <button
          onClick={handleTrainingMode}
          className="w-full p-6 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-left hover:bg-yellow-500/15 transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-yellow-500/20 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <span className="text-3xl">🎓</span>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-foreground mb-1">Self-Guided Training</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Practice on your own without affecting real data
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <span className="text-yellow-400">✓</span>
                  All orders marked as "TEST"
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-yellow-400">✓</span>
                  No orders synced to cloud
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-yellow-400">✓</span>
                  Easy to clear test data before going live
                </li>
              </ul>
            </div>
          </div>
        </button>

        {/* Go Live */}
        <button
          onClick={handleGoLiveClick}
          className="w-full p-6 rounded-xl bg-green-500/10 border border-green-500/30 text-left hover:bg-green-500/15 transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-green-500/20 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <span className="text-3xl">🚀</span>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-foreground mb-1">Go Live Now</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Start accepting real orders immediately
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  Real orders synced to cloud
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  Invoice numbers start counting
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  Analytics and reports active
                </li>
              </ul>
            </div>
          </div>
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-center">
        <p className="text-sm text-blue-200">
          You can switch between Training and Live mode anytime from Settings
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
      className={`w-full p-4 rounded-xl border text-left transition-all flex items-center gap-4 ${
        checked
          ? 'bg-green-500/10 border-green-500/30'
          : 'bg-white/5 border-white/10 hover:bg-white/10'
      }`}
    >
      <div
        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
          checked
            ? 'bg-green-500 border-green-500'
            : 'border-white/30'
        }`}
      >
        {checked && (
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className={`text-sm ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </button>
  );
}

export default TrainingModeToggle;
