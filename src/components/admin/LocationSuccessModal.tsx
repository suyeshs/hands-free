import { useState } from 'react';
import { CheckCircle, Copy, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';

interface LocationSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationData: {
    locationName: string;
    subdomain: string;
    activationCode: string;
    googleRating?: number;
    googleTotalReviews?: number;
  };
}

export function LocationSuccessModal({
  isOpen,
  onClose,
  locationData,
}: LocationSuccessModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyActivationCode = async () => {
    try {
      await navigator.clipboard.writeText(locationData.activationCode);
      setCopied(true);
      toast.success('Activation code copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy activation code');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card shadow-xl max-w-md w-full mx-4">
        {/* Success Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-6 rounded-t-lg text-center">
          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-white">
            Location Created Successfully!
          </h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Location Details */}
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium">Location</p>
              <p className="text-lg font-semibold text-foreground">{locationData.locationName}</p>
            </div>

            {locationData.googleRating && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-yellow-500">⭐ {locationData.googleRating}</span>
                {locationData.googleTotalReviews && (
                  <span className="text-muted-foreground">
                    ({locationData.googleTotalReviews.toLocaleString()} reviews)
                  </span>
                )}
              </div>
            )}

            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium">Subdomain</p>
              <p className="text-sm text-foreground font-mono bg-surface-2 px-2 py-1 rounded break-all">
                {locationData.subdomain}
              </p>
            </div>
          </div>

          {/* Activation Code Section */}
          <div className="space-y-3 bg-orange-50 border-2 border-orange-200 p-4">
            <div>
              <p className="text-xs text-orange-700 uppercase font-semibold mb-2">
                Activation Code
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-card border-2 border-orange-300 px-4 py-3">
                  <p className="text-2xl font-bold text-orange-900 tracking-wider text-center font-mono">
                    {locationData.activationCode}
                  </p>
                </div>
                <button
                  onClick={handleCopyActivationCode}
                  className="px-4 py-3 bg-orange-600 text-white hover:bg-orange-700 transition-colors flex items-center gap-2"
                  title="Copy activation code"
                >
                  {copied ? (
                    <CheckCheck className="w-5 h-5" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="bg-card border border-orange-200 p-3">
              <p className="text-xs text-orange-800">
                <strong>Important:</strong> Save this activation code. You'll need it to activate this location on other POS devices.
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 p-4 space-y-2">
            <p className="text-sm font-semibold text-blue-900">Next Steps:</p>
            <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
              <li>Share the activation code with your location manager</li>
              <li>On the location's POS device, enter the activation code</li>
              <li>The location will be activated and ready to use</li>
            </ol>
          </div>

          {/* Sharing Options */}
          <div className="text-xs text-muted-foreground text-center">
            <p>Share via: WhatsApp • SMS • Email • Print</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-surface-2 rounded-b-lg flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-green-600 text-white hover:bg-green-700 font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
