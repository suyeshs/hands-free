/**
 * Universal Consent Dialog Component
 *
 * GDPR, DPDP, CCPA compliant consent collection UI
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ConsentPurpose,
  ConsentMethod,
  ConsentRequest,
  ConsentResponse,
  ConsentConfig,
  PrivacyRegulation,
} from '@/lib/consent/types';
import { getConsentManager } from '@/lib/consent/ConsentManager';
import { Shield, Lock, Cookie, BarChart, Mail, MessageSquare, MapPin, Users } from 'lucide-react';

interface ConsentDialogProps {
  open: boolean;
  onClose: () => void;
  request: ConsentRequest;
  onResponse?: (response: ConsentResponse) => void | Promise<void>;
  blocking?: boolean; // Can't close without responding
}

/**
 * Get icon for consent purpose
 */
function getPurposeIcon(purpose: ConsentPurpose): React.ReactNode {
  const iconMap: Record<string, React.ReactNode> = {
    essential_services: <Shield className="w-5 h-5" />,
    security: <Lock className="w-5 h-5" />,
    marketing_email: <Mail className="w-5 h-5" />,
    marketing_sms: <MessageSquare className="w-5 h-5" />,
    marketing_push: <MessageSquare className="w-5 h-5" />,
    analytics: <BarChart className="w-5 h-5" />,
    personalization: <Users className="w-5 h-5" />,
    location_based: <MapPin className="w-5 h-5" />,
    third_party_advertising: <Cookie className="w-5 h-5" />,
  };

  return iconMap[purpose] || <Shield className="w-5 h-5" />;
}

/**
 * Get regulation-specific text
 */
function getRegulationText(regulation: PrivacyRegulation): {
  title: string;
  description: string;
  acceptLabel: string;
  rejectLabel: string;
} {
  const textMap: Record<PrivacyRegulation, any> = {
    [PrivacyRegulation.GDPR]: {
      title: 'Your Privacy Choices',
      description: 'We value your privacy. Please review and accept the data processing purposes below.',
      acceptLabel: 'Accept All',
      rejectLabel: 'Reject All',
    },
    [PrivacyRegulation.DPDP]: {
      title: 'आपकी गोपनीयता विकल्प / Your Privacy Choices',
      description: 'भारतीय डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम के अनुसार, कृपया नीचे दिए गए उद्देश्यों की समीक्षा करें।',
      acceptLabel: 'सभी स्वीकार करें / Accept All',
      rejectLabel: 'सभी अस्वीकार करें / Reject All',
    },
    [PrivacyRegulation.CCPA]: {
      title: 'Do Not Sell My Personal Information',
      description: 'California residents have the right to opt-out of the sale of personal information.',
      acceptLabel: 'Allow',
      rejectLabel: 'Do Not Sell',
    },
    [PrivacyRegulation.CPRA]: {
      title: 'Your California Privacy Rights',
      description: 'You have the right to limit the use of your sensitive personal information.',
      acceptLabel: 'Allow',
      rejectLabel: 'Limit Use',
    },
    [PrivacyRegulation.LGPD]: {
      title: 'Suas Escolhas de Privacidade',
      description: 'Valorizamos sua privacidade. Revise e aceite os propósitos de processamento abaixo.',
      acceptLabel: 'Aceitar Tudo',
      rejectLabel: 'Rejeitar Tudo',
    },
    [PrivacyRegulation.PIPEDA]: {
      title: 'Your Privacy Choices',
      description: 'We respect your privacy rights under Canadian law. Please review your consent options.',
      acceptLabel: 'Accept All',
      rejectLabel: 'Decline All',
    },
    [PrivacyRegulation.POPIA]: {
      title: 'Your Privacy Choices',
      description: 'In compliance with South African privacy law, please review your consent options.',
      acceptLabel: 'Accept All',
      rejectLabel: 'Decline All',
    },
    [PrivacyRegulation.APPI]: {
      title: 'プライバシー設定 / Privacy Settings',
      description: '個人情報保護法に基づき、データ処理目的をご確認ください。',
      acceptLabel: 'すべて承認 / Accept All',
      rejectLabel: 'すべて拒否 / Reject All',
    },
  };

  return textMap[regulation] || textMap[PrivacyRegulation.GDPR];
}

export const ConsentDialog: React.FC<ConsentDialogProps> = ({
  open,
  onClose,
  request,
  onResponse,
  blocking = false,
}) => {
  const [configs, setConfigs] = useState<Map<ConsentPurpose, ConsentConfig>>(new Map());
  const [consents, setConsents] = useState<Map<ConsentPurpose, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'simple' | 'detailed'>('simple');

  const regulationText = getRegulationText(request.regulation);

  // Load consent configurations
  useEffect(() => {
    loadConfigs();
  }, [request]);

  async function loadConfigs() {
    try {
      const manager = getConsentManager();
      const configMap = new Map<ConsentPurpose, ConsentConfig>();
      const consentMap = new Map<ConsentPurpose, boolean>();

      // Load configs and default values
      for (const purpose of request.purposes) {
        // TODO: Load from database
        consentMap.set(purpose, false);
      }

      setConfigs(configMap);
      setConsents(consentMap);
    } catch (error) {
      console.error('Failed to load consent configs:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleAcceptAll = async () => {
    const response: ConsentResponse = {
      request_id: request.device_id, // Should be actual request ID
      consents: new Map(
        request.purposes.map(purpose => [purpose, true])
      ),
      timestamp: Date.now(),
      method: ConsentMethod.EXPLICIT_BUTTON,
    };

    if (onResponse) {
      await onResponse(response);
    }

    const manager = getConsentManager();
    await manager.recordConsentResponse(response);

    onClose();
  };

  const handleRejectAll = async () => {
    const response: ConsentResponse = {
      request_id: request.device_id,
      consents: new Map(
        request.purposes
          .filter(purpose => {
            const config = configs.get(purpose);
            return !config?.essential; // Can't reject essential
          })
          .map(purpose => [purpose, false])
      ),
      timestamp: Date.now(),
      method: ConsentMethod.EXPLICIT_BUTTON,
    };

    if (onResponse) {
      await onResponse(response);
    }

    const manager = getConsentManager();
    await manager.recordConsentResponse(response);

    onClose();
  };

  const handleSavePreferences = async () => {
    const response: ConsentResponse = {
      request_id: request.device_id,
      consents: new Map(consents),
      timestamp: Date.now(),
      method: ConsentMethod.EXPLICIT_CHECKBOX,
    };

    if (onResponse) {
      await onResponse(response);
    }

    const manager = getConsentManager();
    await manager.recordConsentResponse(response);

    onClose();
  };

  const handleToggle = (purpose: ConsentPurpose, value: boolean) => {
    const config = configs.get(purpose);

    // Can't toggle essential services
    if (config?.essential) {
      return;
    }

    setConsents(prev => new Map(prev).set(purpose, value));
  };

  const renderSimpleView = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{regulationText.description}</p>

      <div className="bg-muted p-4 rounded-lg space-y-2">
        <p className="text-sm font-medium">We will use your data for:</p>
        <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
          {request.purposes.map(purpose => {
            const config = configs.get(purpose);
            return <li key={purpose}>{config?.title || purpose}</li>;
          })}
        </ul>
      </div>

      <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-medium">Your data is encrypted end-to-end</span>
        </div>
      </div>
    </div>
  );

  const renderDetailedView = () => (
    <ScrollArea className="max-h-[400px] pr-4">
      <div className="space-y-3">
        {request.purposes.map(purpose => {
          const config = configs.get(purpose);
          const isGranted = consents.get(purpose) || false;
          const isEssential = config?.essential || false;

          return (
            <div
              key={purpose}
              className={`p-4 border rounded-lg ${
                isEssential ? 'bg-muted border-muted' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-0.5">{getPurposeIcon(purpose)}</div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium">
                        {config?.title || purpose}
                      </h4>
                      {isEssential && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {config?.description || 'No description available'}
                    </p>
                    {config?.learn_more_url && (
                      <a
                        href={config.learn_more_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Learn more
                      </a>
                    )}
                    {config?.expires_after_days && (
                      <p className="text-xs text-muted-foreground">
                        Valid for {config.expires_after_days} days
                      </p>
                    )}
                  </div>
                </div>
                <Switch
                  checked={isEssential || isGranted}
                  onCheckedChange={(checked) => handleToggle(purpose, checked)}
                  disabled={isEssential}
                />
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={blocking ? undefined : onClose}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={blocking ? undefined : onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {regulationText.title}
          </DialogTitle>
          <DialogDescription>
            {request.regulation === PrivacyRegulation.DPDP && (
              <span className="text-xs">
                As per Digital Personal Data Protection Act, 2023
              </span>
            )}
            {request.regulation === PrivacyRegulation.GDPR && (
              <span className="text-xs">
                As per GDPR Article 6 & 7
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="simple">Simple</TabsTrigger>
            <TabsTrigger value="detailed">Customize</TabsTrigger>
          </TabsList>

          <TabsContent value="simple" className="space-y-4">
            {renderSimpleView()}
          </TabsContent>

          <TabsContent value="detailed" className="space-y-4">
            {renderDetailedView()}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleRejectAll}
            disabled={blocking}
            className="w-full sm:w-auto"
          >
            {regulationText.rejectLabel}
          </Button>
          {activeTab === 'detailed' && (
            <Button
              variant="secondary"
              onClick={handleSavePreferences}
              className="w-full sm:w-auto"
            >
              Save Preferences
            </Button>
          )}
          <Button
            onClick={handleAcceptAll}
            className="w-full sm:w-auto"
          >
            {regulationText.acceptLabel}
          </Button>
        </DialogFooter>

        <div className="text-xs text-muted-foreground text-center pt-2">
          You can withdraw your consent anytime in Settings → Privacy
        </div>
      </DialogContent>
    </Dialog>
  );
};
