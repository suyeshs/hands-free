/**
 * Help & Support Panel
 * Provides access to help resources, diagnostics, and system status
 */

import { useNavigate } from 'react-router-dom';
import {
  HelpCircle,
  ExternalLink,
  Activity,
  BookOpen,
  MessageCircle,
  Youtube,
  Rocket,
} from 'lucide-react';
import { useProvisioningStore } from '../../stores/provisioningStore';
import { cn } from '../../lib/utils';

export function HelpSupportPanel() {
  const navigate = useNavigate();
  const { isTrainingMode } = useProvisioningStore();

  const resources = [
    {
      id: 'getting-started',
      title: 'Getting Started Guide',
      description: 'Learn the basics of your POS system',
      icon: BookOpen,
      action: () => {
        // Could link to documentation or open a modal
        window.open('https://docs.example.com/getting-started', '_blank');
      },
    },
    {
      id: 'video-tutorials',
      title: 'Video Tutorials',
      description: 'Watch step-by-step video guides',
      icon: Youtube,
      action: () => {
        window.open('https://youtube.com/@yourrestaurantpos', '_blank');
      },
    },
    {
      id: 'contact-support',
      title: 'Contact Support',
      description: 'Get help from our support team',
      icon: MessageCircle,
      action: () => {
        window.open('mailto:support@example.com', '_blank');
      },
    },
    {
      id: 'diagnostics',
      title: 'System Diagnostics',
      description: 'Check system health and device status',
      icon: Activity,
      action: () => {
        navigate('/diagnostics');
      },
    },
  ];

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-gray-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <HelpCircle size={36} className="text-gray-600" />
        </div>
        <h2 className="text-xl font-bold">Help & Support</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Resources and assistance for your POS system
        </p>
      </div>

      {/* System Status */}
      <div className={cn(
        'p-4 rounded-xl border-2',
        isTrainingMode
          ? 'bg-yellow-500/10 border-yellow-500/30'
          : 'bg-green-500/10 border-green-500/30'
      )}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Rocket size={20} className={isTrainingMode ? 'text-yellow-600' : 'text-green-600'} />
            <span className="font-bold text-foreground">
              System Status
            </span>
          </div>
          <span className={cn(
            'w-2 h-2 rounded-full animate-pulse',
            isTrainingMode ? 'bg-yellow-400' : 'bg-green-400'
          )} />
        </div>
        <p className="text-sm text-muted-foreground">
          {isTrainingMode
            ? 'Training Mode - Orders are not synced to cloud'
            : 'Live Mode - System is operational'}
        </p>
        {isTrainingMode && (
          <button
            onClick={() => navigate('/settings')}
            className="mt-3 text-sm text-yellow-600 hover:text-yellow-700 font-medium flex items-center gap-1"
          >
            Switch to Live Mode
            <ExternalLink size={14} />
          </button>
        )}
      </div>

      {/* Help Resources */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium px-1 text-muted-foreground uppercase tracking-wider">
          Help Resources
        </h3>
        {resources.map((resource) => {
          const ResourceIcon = resource.icon;
          return (
            <button
              key={resource.id}
              onClick={resource.action}
              className="w-full p-4 rounded-xl bg-card border border-border hover:bg-surface-2 hover:border-accent/50 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ResourceIcon size={24} className="text-accent" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-0.5 flex items-center gap-2">
                    {resource.title}
                    <ExternalLink size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {resource.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Tips */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <h4 className="font-bold text-foreground mb-2 flex items-center gap-2">
          <span className="text-lg">💡</span>
          Quick Tips
        </h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            <span>Use <strong>Training Mode</strong> to practice without affecting real data</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            <span>Check <strong>Diagnostics</strong> if you experience sync issues</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            <span>Pin frequently used settings as favorites for quick access</span>
          </li>
        </ul>
      </div>

      {/* Version Info */}
      <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
        <p>Restaurant POS v1.0.0</p>
        <p className="mt-1">
          Need help? Contact support at{' '}
          <a
            href="mailto:support@example.com"
            className="text-accent hover:underline"
          >
            support@example.com
          </a>
        </p>
      </div>
    </div>
  );
}

export default HelpSupportPanel;
