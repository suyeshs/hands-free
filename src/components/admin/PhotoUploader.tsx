import { useState, useRef } from 'react';
import { Upload, Check, AlertCircle, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import backendApi, { PhotoMatchResult } from '../../lib/backendApi';

interface PhotoUploaderProps {
  tenantId: string;
  onComplete: () => void;
  onBack: () => void;
}

export function PhotoUploader({ tenantId, onComplete, onBack }: PhotoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<{
    total: number;
    matched: number;
    unmatched: number;
    results: {
      matched: PhotoMatchResult[];
      unmatched: PhotoMatchResult[];
      uploaded: PhotoMatchResult[];
    };
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList) => {
    if (!files || files.length === 0) return;

    try {
      setUploading(true);
      setError(null);

      console.log('Uploading photos:', files.length);
      const result = await backendApi.uploadPhotos(tenantId, files);

      console.log('Photos uploaded successfully:', result);
      setUploadResults(result);
    } catch (err) {
      console.error('Photo upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);

    const files = e.dataTransfer.files;
    if (files) {
      handleFileSelect(files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      handleFileSelect(files);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Upload Menu Photos</h2>
          <p className="text-gray-600">
            Upload photos of your dishes. We'll automatically match them to your menu items.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          {uploadResults && (
            <Button
              onClick={onComplete}
              className="bg-green-500 hover:bg-green-600"
            >
              Complete Onboarding
            </Button>
          )}
        </div>
      </div>

      {/* Upload Area */}
      {!uploadResults && (
        <div
          className={`border-2 border-dashed rounded-xl p-16 text-center transition-colors ${
            dragging
              ? 'border-orange-500 bg-orange-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          {uploading ? (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-lg font-medium">Uploading and matching photos...</p>
              <p className="text-sm text-gray-500 mt-2">This may take a moment</p>
            </div>
          ) : (
            <>
              <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold mb-2">
                Drag & drop your photos here
              </h3>
              <p className="text-gray-500 mb-4">or</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                onChange={handleFileInput}
                className="hidden"
                disabled={uploading}
                multiple
              />
              <Button
                className="bg-orange-500 hover:bg-orange-600"
                onClick={handleBrowseClick}
              >
                Browse Files
              </Button>
              <p className="text-sm text-gray-400 mt-4">
                Supports JPEG, PNG, WebP, HEIC (max 50 photos)
              </p>
            </>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 font-medium">Upload Error</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Results */}
      {uploadResults && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-900">{uploadResults.total}</div>
              <div className="text-sm text-blue-700">Total Photos</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-900">{uploadResults.matched}</div>
              <div className="text-sm text-green-700">Successfully Matched</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-900">{uploadResults.unmatched}</div>
              <div className="text-sm text-yellow-700">Unmatched</div>
            </div>
          </div>

          {/* Matched Photos */}
          {uploadResults.results.matched.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <Check className="w-5 h-5 text-green-600 mr-2" />
                Successfully Matched Photos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {uploadResults.results.matched.map((result, index) => (
                  <div
                    key={index}
                    className="bg-white border border-green-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="aspect-video bg-gray-100 rounded-lg mb-3 overflow-hidden">
                      <img
                        src={result.imageUrl}
                        alt={result.filename}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium truncate" title={result.filename}>
                        {result.filename}
                      </div>
                      <div className="flex items-center text-sm text-green-700">
                        <Check className="w-4 h-4 mr-1" />
                        Matched to: {result.matchedItem?.name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unmatched Photos */}
          {uploadResults.results.unmatched.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                Unmatched Photos
              </h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  These photos couldn't be automatically matched to menu items. You can manually assign them later in the menu management page.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {uploadResults.results.unmatched.map((result, index) => (
                  <div
                    key={index}
                    className="bg-white border border-yellow-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="aspect-video bg-gray-100 rounded-lg mb-3 overflow-hidden">
                      {result.imageUrl ? (
                        <img
                          src={result.imageUrl}
                          alt={result.filename}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium truncate" title={result.filename}>
                        {result.filename}
                      </div>
                      <div className="flex items-center text-sm text-yellow-700">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        No match found
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Section */}
      {!uploadResults && (
        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">How photo matching works</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Name your photos similar to your menu item names for best results</li>
            <li>• Example: "chicken-tikka.jpg" will match "Chicken Tikka Masala"</li>
            <li>• Supports multi-language names from your menu</li>
            <li>• Unmatched photos can be manually assigned later</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default PhotoUploader;
