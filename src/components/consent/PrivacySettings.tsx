/**
 * Privacy Settings & Consent Management Page
 *
 * Allows users to view and manage their consent preferences
 * GDPR Article 7(3), DPDP Section 6 compliant
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ConsentPurpose, ConsentRecord, ConsentStatus } from '@/lib/consent/types';
import { getConsentManager } from '@/lib/consent/ConsentManager';
import {
  Shield,
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';

interface PrivacySettingsProps {
  userId?: string;
  deviceId: string;
}

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({ userId, deviceId }) => {
  const [consents, setConsents] = useState<Map<ConsentPurpose, ConsentRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [withdrawDialog, setWithdrawDialog] = useState<{
    open: boolean;
    purpose?: ConsentPurpose;
  }>({ open: false });
  const [exportDialog, setExportDialog] = useState(false);
  const [eraseDialog, setEraseDialog] = useState(false);

  useEffect(() => {
    loadConsents();
  }, [userId, deviceId]);

  async function loadConsents() {
    try {
      setLoading(true);
      const manager = getConsentManager();
      const activeConsents = await manager.getActiveConsents(userId || null, deviceId);
      setConsents(activeConsents);
    } catch (error) {
      console.error('Failed to load consents:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleWithdrawConsent = async (purpose: ConsentPurpose) => {
    try {
      const manager = getConsentManager();
      await manager.withdrawConsent(userId || null, deviceId, purpose, 'User request');
      await loadConsents();
      setWithdrawDialog({ open: false });
    } catch (error) {
      console.error('Failed to withdraw consent:', error);
      alert('Failed to withdraw consent. Please try again.');
    }
  };

  const handleExportData = async () => {
    if (!userId) {
      alert('User ID required for data export');
      return;
    }

    try {
      const manager = getConsentManager();
      const data = await manager.exportUserData(userId);

      // Create downloadable JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `privacy-data-${userId}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setExportDialog(false);
    } catch (error) {
      console.error('Failed to export data:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  const handleEraseData = async () => {
    if (!userId) {
      alert('User ID required for data erasure');
      return;
    }

    try {
      const manager = getConsentManager();
      await manager.eraseUserData(userId, 'User requested erasure via Privacy Settings');

      // Create data subject request
      await manager.createDataSubjectRequest('erasure', userId, {
        source: 'privacy_settings',
      });

      alert('Data erasure request submitted. This may take up to 30 days to complete.');
      setEraseDialog(false);
    } catch (error) {
      console.error('Failed to erase data:', error);
      alert('Failed to submit erasure request. Please try again.');
    }
  };

  const getStatusBadge = (status: ConsentStatus) => {
    const badges = {
      granted: <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>,
      denied: <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Denied</Badge>,
      withdrawn: <Badge variant="secondary"><XCircle className="w-3 h-3 mr-1" />Withdrawn</Badge>,
      expired: <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Expired</Badge>,
      pending: <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>,
      not_required: <Badge variant="outline">Not Required</Badge>,
    };
    return badges[status];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8" />
            Privacy & Consent Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage how your data is used and exercise your privacy rights
          </p>
        </div>
      </div>

      {/* Data Rights (GDPR/DPDP) */}
      <Card>
        <CardHeader>
          <CardTitle>Your Privacy Rights</CardTitle>
          <CardDescription>
            Under privacy regulations (GDPR, DPDP Act), you have the right to access, export, and delete your data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setExportDialog(true)}
          >
            <Download className="w-4 h-4 mr-2" />
            Download My Data (GDPR Article 15, DPDP Section 11)
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={() => setEraseDialog(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete My Data (GDPR Article 17, DPDP Section 12)
          </Button>
        </CardContent>
      </Card>

      {/* Active Consents */}
      <Card>
        <CardHeader>
          <CardTitle>Active Consents</CardTitle>
          <CardDescription>
            You can withdraw your consent at any time
          </CardDescription>
        </CardHeader>
        <CardContent>
          {consents.size === 0 ? (
            <Alert>
              <AlertDescription>
                No active consents found. Essential services are always enabled.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {Array.from(consents.entries()).map(([purpose, record]) => (
                <div key={purpose} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{purpose.replace(/_/g, ' ').toUpperCase()}</h3>
                      {getStatusBadge(record.status)}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <p>Granted: {format(record.granted_at, 'PPpp')}</p>
                      {record.expires_at && (
                        <p className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Expires: {format(record.expires_at, 'PPpp')}
                        </p>
                      )}
                      <p className="text-xs">Method: {record.method}</p>
                      <p className="text-xs">Version: {record.consent_version}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWithdrawDialog({ open: true, purpose })}
                    disabled={record.status !== 'granted'}
                  >
                    Withdraw
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Encryption Notice */}
      <Alert>
        <Shield className="w-4 h-4" />
        <AlertDescription>
          <strong>Your data is protected:</strong> All your data is encrypted end-to-end. Even we cannot access your data without your permission.
        </AlertDescription>
      </Alert>

      {/* Withdraw Consent Dialog */}
      <AlertDialog
        open={withdrawDialog.open}
        onOpenChange={(open) => setWithdrawDialog({ open, purpose: withdrawDialog.purpose })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw Consent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to withdraw consent for{' '}
              <strong>{withdrawDialog.purpose?.replace(/_/g, ' ')}</strong>?
              This will stop the associated data processing immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => withdrawDialog.purpose && handleWithdrawConsent(withdrawDialog.purpose)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Withdraw Consent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Data Dialog */}
      <AlertDialog open={exportDialog} onOpenChange={setExportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export Your Data</AlertDialogTitle>
            <AlertDialogDescription>
              We will export all your consent records, audit logs, and privacy requests in JSON format.
              This may take a few moments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExportData}>
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Erase Data Dialog */}
      <AlertDialog open={eraseDialog} onOpenChange={setEraseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete All My Data
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                <strong>Warning:</strong> This action will permanently delete all your personal data.
              </p>
              <p>This includes:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>All consent records</li>
                <li>Personal information</li>
                <li>Usage history</li>
                <li>Preferences and settings</li>
              </ul>
              <p className="text-destructive font-medium">
                This action cannot be undone and will be completed within 30 days.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEraseData}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete My Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
