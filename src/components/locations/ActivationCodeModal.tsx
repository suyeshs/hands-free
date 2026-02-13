/**
 * Activation Code Modal
 * Displays activation code after location creation
 * Master can copy code or print QR code to share with location manager
 */

import { useState } from 'react';
import { Copy, Check, Printer, X, MapPin } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ActivationCodeModalProps {
  code: string;
  locationName: string;
  onClose: () => void;
}

export function ActivationCodeModal({
  code,
  locationName,
  onClose,
}: ActivationCodeModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy code');
    }
  };

  const handlePrint = () => {
    // Create a printable page with QR code and instructions
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Location Activation Code - ${locationName}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              max-width: 600px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
            }
            h1 {
              color: #333;
              margin-bottom: 10px;
            }
            .location-name {
              font-size: 24px;
              color: #666;
              margin-bottom: 30px;
            }
            .code-box {
              background: #f5f5f5;
              border: 3px dashed #333;
              padding: 30px;
              text-align: center;
              margin: 30px 0;
              border-radius: 8px;
            }
            .code {
              font-size: 48px;
              font-weight: bold;
              letter-spacing: 4px;
              color: #000;
              font-family: 'Courier New', monospace;
            }
            .instructions {
              background: #e3f2fd;
              border-left: 4px solid #2196f3;
              padding: 20px;
              margin: 30px 0;
            }
            .instructions h3 {
              margin-top: 0;
              color: #1976d2;
            }
            .instructions ol {
              margin: 10px 0;
              padding-left: 20px;
            }
            .instructions li {
              margin: 8px 0;
              line-height: 1.6;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #ccc;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
            @media print {
              body {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🏢 Location Activation Code</h1>
            <div class="location-name">${locationName}</div>
          </div>

          <div class="code-box">
            <div class="code">${code}</div>
          </div>

          <div class="instructions">
            <h3>📱 Setup Instructions for Location Manager</h3>
            <ol>
              <li>Install the restaurant POS app on your device</li>
              <li>Open the app and start the setup wizard</li>
              <li>Select <strong>"Activate Location"</strong></li>
              <li>Enter this activation code: <strong>${code}</strong></li>
              <li>Click <strong>"Activate"</strong> and wait for setup to complete</li>
              <li>Your location will be ready to take orders in 30 seconds!</li>
            </ol>
          </div>

          <div class="footer">
            <p>⚠️ This code can only be used once. Keep it secure.</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl max-w-lg w-full animate-fade-in">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                <Check size={24} className="text-success" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Location Created!</h2>
                <p className="text-sm text-muted-foreground">{locationName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-2 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Activation Code Display */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={18} className="text-primary" />
              <h3 className="font-semibold text-foreground">Activation Code</h3>
            </div>

            <div className="relative">
              <div className={cn(
                "bg-surface-1 border-2 border-dashed rounded-xl p-6 text-center",
                "border-primary/50"
              )}>
                <div className="text-4xl font-bold tracking-wider font-mono text-foreground mb-2">
                  {code}
                </div>
                <p className="text-xs text-muted-foreground">
                  Can only be used once
                </p>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="status-info p-4 rounded-xl">
            <h4 className="font-semibold text-sm mb-2">📱 Share with Location Manager</h4>
            <p className="text-sm opacity-90">
              Give this code to your location manager. They'll enter it during
              device setup to automatically configure their POS and sync all data.
            </p>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleCopy}
              disabled={copied}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-colors",
                copied
                  ? "bg-success text-white"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {copied ? (
                <>
                  <Check size={18} />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={18} />
                  Copy Code
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-surface-3 hover:bg-surface-2 text-foreground font-semibold rounded-lg transition-colors"
            >
              <Printer size={18} />
              Print
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface-1/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-card hover:bg-surface-2 text-foreground font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
