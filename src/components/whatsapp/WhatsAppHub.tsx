import { useState } from 'react';
import { Settings, Inbox, FileText, BarChart3 } from 'lucide-react';
import { WhatsAppSettings } from './WhatsAppSettings';
import { WhatsAppInbox } from './WhatsAppInbox';
import { WhatsAppTemplates } from './WhatsAppTemplates';
import { WhatsAppAnalytics } from './WhatsAppAnalytics';

type Tab = 'settings' | 'inbox' | 'templates' | 'analytics';

const TABS: Array<{ id: Tab; label: string; icon: typeof Settings }> = [
  { id: 'settings', label: 'Account', icon: Settings },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

export function WhatsAppHub() {
  const [tab, setTab] = useState<Tab>('settings');

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-green-600 text-green-700 font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'settings' && <WhatsAppSettings />}
      {tab === 'inbox' && <WhatsAppInbox />}
      {tab === 'templates' && <WhatsAppTemplates />}
      {tab === 'analytics' && <WhatsAppAnalytics />}
    </div>
  );
}

export default WhatsAppHub;
