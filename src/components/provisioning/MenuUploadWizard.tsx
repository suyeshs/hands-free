/**
 * Menu Upload Wizard
 * Wraps the existing MenuOnboarding component for provisioning flow
 */

import { useState } from 'react';
import { useProvisioningStore } from '../../stores/provisioningStore';
import { useTenantStore } from '../../stores/tenantStore';
import { MenuOnboarding } from '../admin/MenuOnboarding';
import { SimpleFooter } from './WizardNavigation';
import { useMenuStore } from '../../stores/menuStore';

export function MenuUploadWizard() {
  const { markStepComplete, nextStep } = useProvisioningStore();
  const { tenant } = useTenantStore();
  const { items } = useMenuStore();

  const [hasMenu, setHasMenu] = useState<boolean | null>(null);

  const tenantId =
    tenant?.tenantId || import.meta.env.VITE_DEFAULT_TENANT_ID || 'demo-restaurant';

  // Check if menu already exists
  const menuExists = items && items.length > 0;

  const handleContinue = () => {
    markStepComplete('menu_upload');
    nextStep();
  };

  // If menu already exists, show a different UI
  if (menuExists) {
    return (
      <div className="glass-panel rounded-2xl border border-border p-8 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-black uppercase tracking-wider mb-2">
            Menu Ready
          </h1>
          <p className="text-muted-foreground text-sm">
            Your menu has been loaded with {items.length} items
          </p>
        </div>

        {/* Menu summary */}
        <div className="bg-white/5 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-accent">{items.length}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Items</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-accent">
                {new Set(items.map((item) => item.category_id)).size}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Categories</div>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <button
            onClick={handleContinue}
            className="w-full py-4 rounded-xl bg-accent text-white font-bold uppercase tracking-widest text-sm shadow-lg shadow-accent/20 hover:scale-[1.02] transition-all"
          >
            Continue with Current Menu
          </button>
          <button
            onClick={() => setHasMenu(false)}
            className="w-full py-4 rounded-xl bg-white/5 border border-white/10 text-foreground font-bold uppercase tracking-widest text-sm hover:bg-white/10 transition-all"
          >
            Update Menu
          </button>
        </div>
      </div>
    );
  }

  // Initial choice - no menu yet
  if (hasMenu === null) {
    return (
      <div className="glass-panel rounded-2xl border border-border p-8 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📋</span>
          </div>
          <h1 className="text-xl font-black uppercase tracking-wider mb-2">
            Menu Setup
          </h1>
          <p className="text-muted-foreground text-sm">
            Set up your menu items for the POS system
          </p>
        </div>

        {/* Options */}
        <div className="space-y-4">
          <button
            onClick={() => setHasMenu(true)}
            className="w-full p-6 rounded-xl bg-accent/10 border border-accent/30 text-left hover:bg-accent/20 transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <span className="text-2xl">☁️</span>
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-1">Sync from HandsFree Cloud</h3>
                <p className="text-sm text-muted-foreground">
                  If you've already set up your menu on the HandsFree platform, sync it here
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setHasMenu(false)}
            className="w-full p-6 rounded-xl bg-white/5 border border-white/10 text-left hover:bg-white/10 transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <span className="text-2xl">📄</span>
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-1">Upload Menu Document</h3>
                <p className="text-sm text-muted-foreground">
                  Upload an Excel or PDF file with your menu items
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // Show the MenuOnboarding component
  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={() => setHasMenu(null)}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to options
      </button>

      {/* Menu Onboarding */}
      <div className="glass-panel rounded-2xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-bold">
            {hasMenu ? 'Sync Menu from Cloud' : 'Upload Menu'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {hasMenu
              ? 'Click sync to pull your menu from the HandsFree platform'
              : 'Upload your menu document to import items'}
          </p>
        </div>
        <div className="p-4 max-h-[500px] overflow-auto">
          <MenuOnboarding tenantId={tenantId} />
        </div>
      </div>

      {/* Continue button (visible when menu is synced) */}
      {menuExists && (
        <SimpleFooter
          label="Continue to Configuration"
          onClick={handleContinue}
        />
      )}
    </div>
  );
}

export default MenuUploadWizard;
