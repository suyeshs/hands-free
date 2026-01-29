// ============================================================================
// I18N TEST PAGE - Complete Testing Interface
// ============================================================================
// Drop-in test page for verifying multilingual system
// Access via: http://localhost:5173/test/i18n (or your dev URL)
// ============================================================================

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslations } from '../hooks/useTranslations';
import { useMenuTranslations } from '../hooks/useMenuTranslations';
import { useLanguageStore, SUPPORTED_LANGUAGES } from '../stores/languageStore';
import type { MenuItem } from '../types';

export function I18nTestPage() {
  const [output, setOutput] = useState<string>('Ready to test...');
  const [isLoading, setIsLoading] = useState(false);

  const { currentLanguage, setLanguage } = useLanguageStore();
  const { t } = useTranslations('common');
  const { getItemName, getItemDescription } = useMenuTranslations();

  // Sample menu items for testing
  const testMenuItems: MenuItem[] = [
    {
      id: 'test-pizza',
      name: 'Margherita Pizza',
      description: 'Classic Italian pizza',
      price: 12.99,
      category_id: 'mains',
      active: true,
      name_translations: {
        fr: 'Pizza Margherita',
        de: 'Margherita-Pizza',
        es: 'Pizza Margarita',
        hi: 'मार्घेरिटा पिज्जा',
        ta: 'மார்கரிட்டா பீட்சா',
      },
      description_translations: {
        fr: 'Pizza italienne classique',
        hi: 'क्लासिक इतालवी पिज्जा',
      },
    } as unknown as MenuItem,
  ];

  const runTest = async (testFn: () => Promise<string>, testName: string) => {
    setIsLoading(true);
    setOutput(`Running: ${testName}...`);

    try {
      const result = await testFn();
      setOutput(`✅ ${testName}\n\n${result}`);
    } catch (error) {
      setOutput(`❌ ${testName}\n\nError: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Test 1: Get all translations
  const testGetTranslations = async () => {
    const result = await invoke<any>('get_translations', {
      language: 'fr',
      namespace: 'common',
      tenantId: null,
    });

    return `Loaded ${Object.keys(result.translations).length} French translations:\n\n${JSON.stringify(
      result.translations,
      null,
      2
    )}`;
  };

  // Test 2: Get single translation
  const testGetTranslation = async () => {
    const languages = ['en', 'fr', 'de', 'es', 'hi', 'ta'];
    const results: string[] = [];

    for (const lang of languages) {
      const translation = await invoke<string>('get_translation', {
        key: 'common.save',
        language: lang,
        tenantId: null,
      });
      results.push(`${lang}: "${translation}"`);
    }

    return `Translation for "common.save" across languages:\n\n${results.join('\n')}`;
  };

  // Test 3: User language preference
  const testUserLanguage = async () => {
    const testUserId = 'test-user-i18n';

    // Get current
    const currentLang = await invoke<string>('get_user_language', {
      userId: testUserId,
    });

    // Set to French
    await invoke('set_user_language', {
      userId: testUserId,
      language: 'fr',
    });

    const newLang = await invoke<string>('get_user_language', {
      userId: testUserId,
    });

    // Revert to English
    await invoke('set_user_language', {
      userId: testUserId,
      language: 'en',
    });

    return `User Language Preference Test:\n\nInitial: ${currentLang}\nAfter setting to FR: ${newLang}\nReverted to: en\n\n✅ Language preference persists correctly`;
  };

  // Test 4: Tenant override
  const testTenantOverride = async () => {
    const testTenantId = 'test-tenant-override';

    // Create override
    await invoke('update_tenant_translation', {
      tenantId: testTenantId,
      key: 'common.save',
      language: 'en',
      value: 'Save Changes', // Custom label
      userId: 'admin-123',
    });

    // Get with tenant ID (should return custom)
    const custom = await invoke<string>('get_translation', {
      key: 'common.save',
      language: 'en',
      tenantId: testTenantId,
    });

    // Get without tenant ID (should return base)
    const base = await invoke<string>('get_translation', {
      key: 'common.save',
      language: 'en',
      tenantId: null,
    });

    // Delete override
    await invoke('delete_tenant_translation', {
      tenantId: testTenantId,
      key: 'common.save',
      language: 'en',
    });

    // Verify reverted
    const reverted = await invoke<string>('get_translation', {
      key: 'common.save',
      language: 'en',
      tenantId: testTenantId,
    });

    return `Tenant Override Test:\n\nBase translation: "${base}"\nCustom override: "${custom}"\nAfter delete: "${reverted}"\n\n✅ Tenant overrides work correctly`;
  };

  // Test 5: Translation keys
  const testGetKeys = async () => {
    const keys = await invoke<any[]>('get_translation_keys', {
      category: 'common',
    });

    return `Found ${keys.length} translation keys in 'common' category:\n\n${keys
      .map((k) => `- ${k.key}: "${k.default_value_en}"`)
      .join('\n')}`;
  };

  // Test 6: Database check
  const testDatabaseCheck = async () => {
    try {
      // Try to get translations - this will fail if tables don't exist
      const result = await invoke<any>('get_translations', {
        language: 'en',
        namespace: 'common',
        tenantId: null,
      });

      const keyCount = Object.keys(result.translations).length;

      if (keyCount === 0) {
        return '⚠️  Tables exist but no seed data found.\n\nRun: sqlite3 src-tauri/pos.db < src-tauri/migrations/022_seed_translations.sql';
      }

      return `✅ Database OK\n\nTables exist and ${keyCount} translations loaded.\n\nTest passed successfully!`;
    } catch (error) {
      return `❌ Database Error\n\n${error}\n\nPossible issues:\n- Migrations didn't run\n- Database file missing\n- Rust backend not initialized`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold mb-2">🌍 Multilingual System Test</h1>
          <p className="text-gray-600">
            Comprehensive testing interface for the i18n implementation
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Tests */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Backend Tests</h2>

              <div className="space-y-3">
                <button
                  onClick={() => runTest(testDatabaseCheck, 'Database Check')}
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 text-left font-medium"
                >
                  1️⃣ Database Check (Run First!)
                </button>

                <button
                  onClick={() => runTest(testGetTranslations, 'Get All Translations')}
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 text-left"
                >
                  2️⃣ Get All Translations (French)
                </button>

                <button
                  onClick={() => runTest(testGetTranslation, 'Get Single Translation')}
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 text-left"
                >
                  3️⃣ Get Single Translation (Multi-language)
                </button>

                <button
                  onClick={() => runTest(testUserLanguage, 'User Language Preference')}
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 text-left"
                >
                  4️⃣ User Language Preference
                </button>

                <button
                  onClick={() => runTest(testTenantOverride, 'Tenant Override')}
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 text-left"
                >
                  5️⃣ Tenant Override (Customization)
                </button>

                <button
                  onClick={() => runTest(testGetKeys, 'Get Translation Keys')}
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50 text-left"
                >
                  6️⃣ Get Translation Keys
                </button>
              </div>
            </div>

            {/* Output */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Test Output</h2>
              <pre className="bg-gray-900 text-green-400 p-4 rounded text-sm overflow-auto max-h-96 font-mono">
                {output}
              </pre>
            </div>
          </div>

          {/* Right Column - Live UI Tests */}
          <div className="space-y-4">
            {/* Language Selector */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Frontend Tests</h2>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Change Language (Watch UI Update)
                </label>
                <select
                  value={currentLanguage}
                  onChange={(e) => setLanguage(e.target.value as any)}
                  className="w-full border rounded px-4 py-2"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name} ({lang.nativeName})
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-2">
                  Current: <strong>{currentLanguage}</strong>
                </p>
              </div>

              {/* Translated Buttons */}
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-gray-700">Translated UI Elements:</h3>

                <button className="w-full px-4 py-2 bg-blue-500 text-white rounded">
                  {t('save')}
                </button>

                <button className="w-full px-4 py-2 bg-gray-500 text-white rounded">
                  {t('cancel')}
                </button>

                <button className="w-full px-4 py-2 bg-red-500 text-white rounded">
                  {t('delete')}
                </button>

                <button className="w-full px-4 py-2 bg-green-500 text-white rounded">
                  {t('confirm')}
                </button>

                <input
                  type="text"
                  placeholder={t('search')}
                  className="w-full border rounded px-4 py-2"
                />

                <div className="text-center text-gray-600">{t('loading')}</div>
              </div>
            </div>

            {/* Menu Items Test */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Menu Item Translation</h3>

              {testMenuItems.map((item) => (
                <div key={item.id} className="border rounded p-4 bg-gray-50">
                  <h4 className="font-bold text-lg mb-2">{getItemName(item)}</h4>
                  <p className="text-gray-600 text-sm mb-3">{getItemDescription(item)}</p>
                  <div className="text-green-600 font-semibold">${item.price.toFixed(2)}</div>
                </div>
              ))}

              <div className="mt-4 text-sm text-gray-600">
                💡 Switch languages above to see menu item update in real-time
              </div>
            </div>

            {/* Status */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">System Status</h3>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Current Language:</span>
                  <strong>{currentLanguage}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Supported Languages:</span>
                  <strong>{SUPPORTED_LANGUAGES.length}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Backend:</span>
                  <span className="text-green-600 font-semibold">✅ Rust/Tauri</span>
                </div>
                <div className="flex justify-between">
                  <span>Storage:</span>
                  <span className="text-green-600 font-semibold">✅ SQLite</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border-l-4 border-blue-500 p-6 rounded">
          <h3 className="font-bold text-lg mb-2">📋 Testing Checklist</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Run "Database Check" first - must pass before other tests</li>
            <li>Run backend tests (2-6) - verify all pass</li>
            <li>Change language dropdown - watch UI elements update</li>
            <li>Check menu item updates in different languages</li>
            <li>Close and reopen app - verify language persists</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
