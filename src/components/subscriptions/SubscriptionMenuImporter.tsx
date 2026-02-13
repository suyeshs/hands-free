/**
 * Subscription Menu Importer Component
 * UI to import complete menu (150+ items) into database
 * Handles BOTH a la carte and subscription menu setup
 */

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, CheckCircle, AlertCircle, Loader, X, FileSpreadsheet } from 'lucide-react';
import { importCompleteSubscriptionMenu, importFromExcelData } from '../../scripts/importSubscriptionMenuFromMd';
import { cn } from '../../lib/utils';
import * as XLSX from 'xlsx';

export function SubscriptionMenuImporter() {
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    totalImported: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImport() {
    setIsImporting(true);
    setResult(null);

    try {
      const importResult = await importCompleteSubscriptionMenu();
      setResult(importResult);
    } catch (error) {
      setResult({
        success: false,
        totalImported: 0,
        errors: [`Fatal error: ${error}`],
      });
    } finally {
      setIsImporting(false);
    }
  }

  async function handleFileImport() {
    if (!selectedFile) return;

    setIsImporting(true);
    setResult(null);

    try {
      // Read the Excel file
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      // Assume first sheet contains menu items
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(firstSheet);

      // Parse the Excel data into expected format
      const menuItems = data.map((row: any) => ({
        name: row['Item Name'] || row['name'] || row['Name'],
        category: row['Category'] || row['category'],
        price: parseFloat(row['Price'] || row['price']) || 0,
        description: row['Description'] || row['description'] || '',
        isVeg: row['Vegetarian'] === 'Yes' || row['Veg'] === 'Yes' || row['isVeg'] === true,
      }));

      // Import using the parsed data
      const importResult = await importFromExcelData(menuItems);
      setResult(importResult);
    } catch (error) {
      setResult({
        success: false,
        totalImported: 0,
        errors: [`Fatal error: ${error}`],
      });
    } finally {
      setIsImporting(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
    }
  }

  return (
    <div className="glass-panel p-8 rounded-lg max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary flex items-center justify-center mx-auto mb-4">
          <Upload className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Import Complete Menu</h2>
        <p className="text-muted-foreground">
          Import 150+ items for both a la carte and subscription services
        </p>
      </div>

      {/* What will be imported */}
      <div className="glass-panel p-4 rounded-lg mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-3 uppercase">What will be imported:</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-foreground font-medium">5 Cuisine Types:</span> North Indian,
              South Indian, Chinese, Continental, Children's Menu
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-foreground font-medium">3 Subscription Plans:</span> 5-day,
              10-day, and 20-day weekday plans
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-foreground font-medium">150+ Menu Items:</span>
              <ul className="mt-1 ml-4 space-y-1 list-disc">
                <li>Breakfast (Daily + South Indian + Weekend Special)</li>
                <li>Chinese (Starters, Main Course, Soups)</li>
                <li>Indian (Biryani, Rice, Breads, Gravys, Seafood)</li>
                <li>Continental (Starters, Steaks, Pasta, Sizzlers)</li>
                <li>Evening Snacks (Pizza, Burgers, Desserts)</li>
                <li>Daily Lunch Combos (for a la carte)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Import Note */}
      <div className="glass-panel p-4 rounded-lg mb-6 border border-blue-500/30">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-foreground">
            <p className="font-semibold text-blue-400 mb-1">Important:</p>
            <p>
              This menu supports <span className="text-foreground font-medium">BOTH</span>:
            </p>
            <ul className="mt-2 space-y-1 list-disc ml-4">
              <li>
                <span className="text-foreground">A la carte ordering</span> - Regular menu with
                combos for walk-in and online orders
              </li>
              <li>
                <span className="text-foreground">Subscription service</span> - Weekly rotating menus
                using the same items
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Import Options */}
      {!result && (
        <div className="space-y-4">
          {/* Option 1: Default Menu */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleImport}
            disabled={isImporting}
            className={cn(
              'w-full py-4 rounded-lg font-semibold text-lg',
              'bg-gradient-to-br from-primary to-primary',
              'text-white shadow-lg shadow-primary/30',
              'hover:shadow-primary/50 transition-all',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center gap-3'
            )}
          >
            {isImporting && !selectedFile ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Importing... Please wait
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Import Default Menu (150+ items)
              </>
            )}
          </motion.button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Option 2: Excel Upload */}
          <div className="glass-panel p-4 rounded-lg border border-border">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!selectedFile ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'w-full py-3 rounded-lg font-medium',
                  'bg-muted hover:bg-muted/80 text-foreground',
                  'transition-all flex items-center justify-center gap-2'
                )}
              >
                <FileSpreadsheet className="w-5 h-5" />
                Choose Excel File
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-green-400" />
                    <span className="text-sm font-medium text-foreground">{selectedFile.name}</span>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="p-1 hover:bg-muted rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleFileImport}
                  disabled={isImporting}
                  className={cn(
                    'w-full py-3 rounded-lg font-semibold',
                    'bg-gradient-to-br from-green-600 to-green-700',
                    'text-white shadow-lg shadow-green-600/30',
                    'hover:shadow-green-600/50 transition-all',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'flex items-center justify-center gap-2'
                  )}
                >
                  {isImporting && selectedFile ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Importing from Excel...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Import from Excel
                    </>
                  )}
                </motion.button>
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-2">
              Excel file should have columns: Item Name, Category, Price, Description, Vegetarian
            </p>
          </div>
        </div>
      )}

      {/* Import Result */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'p-6 rounded-lg',
            result.success
              ? 'glass-panel border border-green-500/30'
              : 'glass-panel border border-red-500/30'
          )}
        >
          <div className="flex items-start gap-4">
            {result.success ? (
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <X className="w-6 h-6 text-red-400" />
              </div>
            )}

            <div className="flex-1">
              <h3
                className={cn(
                  'text-lg font-bold mb-2',
                  result.success ? 'text-green-400' : 'text-red-400'
                )}
              >
                {result.success ? 'Import Successful!' : 'Import Failed'}
              </h3>

              <p className="text-foreground mb-3">
                {result.success
                  ? `Successfully imported ${result.totalImported} items to your database.`
                  : 'Some items failed to import. Please check the errors below.'}
              </p>

              {result.success && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>✓ Cuisine types created</p>
                  <p>✓ Subscription plans created</p>
                  <p>✓ All menu items imported</p>
                  <p className="mt-3 text-foreground">
                    Next step: Go to <span className="font-semibold">Subscription Menu Manager</span>{' '}
                    to create weekly menus
                  </p>
                </div>
              )}

              {!result.success && result.errors.length > 0 && (
                <div className="mt-3 max-h-40 overflow-y-auto">
                  <p className="text-sm font-semibold text-red-400 mb-2">Errors:</p>
                  <div className="space-y-1">
                    {result.errors.map((error, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        • {error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setResult(null)}
            className="mt-4 w-full py-2 rounded-lg glass-panel hover:bg-muted text-sm text-foreground"
          >
            Close
          </button>
        </motion.div>
      )}
    </div>
  );
}
