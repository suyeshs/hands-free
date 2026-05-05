/**
 * Compliance Reporting Dashboard
 *
 * Generate and view compliance reports for GDPR, DPDP, CCPA, etc.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { PrivacyRegulation, ConsentComplianceReport, ConsentPurpose } from '@/lib/consent/types';
import { getConsentManager } from '@/lib/consent/ConsentManager';
import { FileText, Download, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';
import { format, subDays } from 'date-fns';

export const ComplianceReport: React.FC = () => {
  const [regulation, setRegulation] = useState<PrivacyRegulation>(PrivacyRegulation.GDPR);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [report, setReport] = useState<ConsentComplianceReport | null>(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    try {
      setLoading(true);
      const manager = getConsentManager();

      const now = Date.now();
      const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
      const startDate = subDays(now, daysMap[dateRange]).getTime();

      const complianceReport = await manager.generateComplianceReport(
        regulation,
        startDate,
        now
      );

      setReport(complianceReport);
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate compliance report');
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${regulation}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getIssueSeverityColor = (severity: string) => {
    const colors = {
      critical: 'destructive',
      warning: 'warning',
      info: 'secondary',
    };
    return colors[severity as keyof typeof colors] || 'secondary';
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="w-8 h-8" />
            Compliance Reporting
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate compliance reports for regulatory audits
          </p>
        </div>
      </div>

      {/* Report Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Report</CardTitle>
          <CardDescription>Select regulation and date range</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Regulation</label>
              <Select
                value={regulation}
                onValueChange={(v) => setRegulation(v as PrivacyRegulation)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(PrivacyRegulation).map((reg) => (
                    <SelectItem key={reg} value={reg}>
                      {reg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={generateReport} disabled={loading} className="w-full">
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Results */}
      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.total_users.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Consents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.total_consents.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Consent Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {report.consent_rate.toFixed(1)}%
                </div>
                <Progress value={report.consent_rate} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Issues Found
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {report.issues.length}
                </div>
                {report.issues.length === 0 && (
                  <div className="flex items-center gap-1 text-sm text-green-600 mt-1">
                    <CheckCircle className="w-4 h-4" />
                    Compliant
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Consent Breakdown */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Consent Breakdown by Purpose</CardTitle>
                  <CardDescription>
                    Period: {format(report.period.start, 'PP')} -{' '}
                    {format(report.period.end, 'PP')}
                  </CardDescription>
                </div>
                <Button onClick={downloadReport} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export JSON
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Purpose</TableHead>
                    <TableHead className="text-right">Granted</TableHead>
                    <TableHead className="text-right">Denied</TableHead>
                    <TableHead className="text-right">Withdrawn</TableHead>
                    <TableHead className="text-right">Grant Rate</TableHead>
                    <TableHead>Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.by_purpose.map((item) => (
                    <TableRow key={item.purpose}>
                      <TableCell className="font-medium">
                        {item.purpose.replace(/_/g, ' ').toUpperCase()}
                      </TableCell>
                      <TableCell className="text-right">{item.granted.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{item.denied.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{item.withdrawn.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span>{item.rate.toFixed(1)}%</span>
                          <Progress value={item.rate} className="w-16" />
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.rate >= 80 ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-yellow-600" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Compliance Issues */}
          {report.issues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  Compliance Issues
                </CardTitle>
                <CardDescription>
                  Issues requiring attention for {regulation} compliance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.issues.map((issue, index) => (
                    <div key={index} className="border-l-4 border-l-destructive pl-4 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={getIssueSeverityColor(issue.severity) as any}>
                              {issue.severity.toUpperCase()}
                            </Badge>
                            <span className="font-medium">{issue.type}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{issue.description}</p>
                          <p className="text-xs text-muted-foreground">
                            Affected users: {issue.affected_users}
                          </p>
                          <div className="mt-2 p-2 bg-muted rounded text-sm">
                            <strong>Recommendation:</strong> {issue.recommendation}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Audit Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Audit Trail Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Total Changes</div>
                  <div className="text-2xl font-bold">
                    {report.audit_summary.total_changes.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Admin Overrides</div>
                  <div className="text-2xl font-bold">
                    {report.audit_summary.admin_overrides}
                  </div>
                  {report.audit_summary.admin_overrides > 0 && (
                    <div className="text-xs text-yellow-600 mt-1">Requires review</div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Expired Consents</div>
                  <div className="text-2xl font-bold">
                    {report.audit_summary.expired_consents}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Renewals</div>
                  <div className="text-2xl font-bold">
                    {report.audit_summary.renewed_consents}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
