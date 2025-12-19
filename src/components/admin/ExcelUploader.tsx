import { useState, useRef } from 'react';
import { Upload, Download, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import backendApi, { MenuItem } from '../../lib/backendApi';

interface ExcelUploaderProps {
  tenantId: string;
  onParsed: (items: MenuItem[], confidence?: number) => void;
}

export function ExcelUploader({ tenantId, onParsed }: ExcelUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useSmartUpload, setUseSmartUpload] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    try {
      setUploading(true);
      setError(null);

      if (useSmartUpload) {
        console.log('Smart uploading document:', file.name);
        const result = await backendApi.uploadSmart(tenantId, file);
        console.log('Smart parsing complete:', {
          count: result.count,
          confidence: result.confidence
        });
        onParsed(result.items, result.confidence);
      } else {
        console.log('Uploading Excel file:', file.name);
        const result = await backendApi.uploadExcel(tenantId, file);
        console.log('Excel parsed successfully:', result);
        onParsed(result.items);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await backendApi.downloadTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'menu-template-global.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Template download error:', err);
      setError('Failed to download template');
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-2xl font-bold">Upload Menu Document</h2>
          {useSmartUpload && (
            <span className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
              <Sparkles className="w-3 h-3" />
              AI-Powered
            </span>
          )}
        </div>
        <p className="text-gray-600">
          {useSmartUpload
            ? 'Upload your existing menu in any format - PDF, Excel, Word, or images. Our AI will extract and structure the data automatically.'
            : 'Download the template, fill in your menu items, and upload it here.'}
        </p>
      </div>

      {/* Upload Mode Toggle */}
      <div className="mb-6 flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={useSmartUpload}
            onChange={() => setUseSmartUpload(true)}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-purple-600" />
            Smart Upload (Any Format)
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={!useSmartUpload}
            onChange={() => setUseSmartUpload(false)}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium">Template-Based Upload</span>
        </label>
      </div>

      {/* Download Template Button (only for template mode) */}
      {!useSmartUpload && (
        <div className="mb-8">
          <Button
            onClick={handleDownloadTemplate}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Download Excel Template
          </Button>
          <p className="text-sm text-gray-500 mt-2">
            Template includes support for multi-language names, dietary restrictions, allergens, variants, and more.
          </p>
        </div>
      )}

      {/* Upload Area */}
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
            <p className="text-lg font-medium">Parsing Excel file...</p>
            <p className="text-sm text-gray-500 mt-2">Please wait while we process your menu</p>
          </div>
        ) : (
          <>
            <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold mb-2">
              {useSmartUpload
                ? 'Drag & drop your menu document here'
                : 'Drag & drop your Excel file here'}
            </h3>
            <p className="text-gray-500 mb-4">or</p>
            <input
              ref={fileInputRef}
              type="file"
              accept={useSmartUpload
                ? ".pdf,.xlsx,.xls,.csv,.docx,.jpg,.jpeg,.png,.webp"
                : ".xlsx,.xls,.csv"}
              onChange={handleFileInput}
              className="hidden"
              disabled={uploading}
            />
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={handleBrowseClick}
            >
              Browse Files
            </Button>
            <p className="text-sm text-gray-400 mt-4">
              {useSmartUpload
                ? 'Supports PDF, Excel, Word, and images (max 10MB)'
                : 'Supports .xlsx, .xls, and .csv files (max 10MB)'}
            </p>
          </>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 font-medium">Upload Error</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          {useSmartUpload && (
            <p className="text-red-600 text-sm mt-2">
              Try switching to Template-Based Upload if the smart upload fails.
            </p>
          )}
        </div>
      )}

      {/* Info Section */}
      <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">What happens next?</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          {useSmartUpload ? (
            <>
              <li>• AI will extract menu items from your document</li>
              <li>• You'll see extracted items with confidence scores</li>
              <li>• Review and edit any fields as needed</li>
              <li>• Then upload photos that will auto-match to your items</li>
            </>
          ) : (
            <>
              <li>• Your Excel file will be parsed and validated</li>
              <li>• You'll see a preview of all menu items</li>
              <li>• You can edit any details before confirming</li>
              <li>• Then upload photos that will auto-match to your items</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}

export default ExcelUploader;
