'use client';

import { useEffect, useState } from 'react';

export default function DebugCookiesPage() {
  const [cookies, setCookies] = useState<string>('');
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get all cookies
    const allCookies = document.cookie;
    setCookies(allCookies);

    // Test session endpoint
    fetch('https://auth.handsfree.tech/auth/session', {
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        setSessionData(data);
        setLoading(false);
      })
      .catch(err => {
        setSessionData({ error: err.message });
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Cookie Debug Page</h1>

      <div className="space-y-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Client-Side Cookies</h2>
          <div className="bg-gray-100 p-4 rounded font-mono text-sm overflow-x-auto">
            {cookies || 'No cookies found'}
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              <strong>Has admin_access_token:</strong> {cookies.includes('admin_access_token') ? '✅ YES' : '❌ NO'}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Has admin_refresh_token:</strong> {cookies.includes('admin_refresh_token') ? '✅ YES' : '❌ NO'}
            </p>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Session Check Response</h2>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="bg-gray-100 p-4 rounded font-mono text-sm overflow-x-auto">
              <pre>{JSON.stringify(sessionData, null, 2)}</pre>
            </div>
          )}
          {sessionData && (
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                <strong>Authenticated:</strong> {sessionData.authenticated ? '✅ YES' : '❌ NO'}
              </p>
              {sessionData.success === false && (
                <p className="text-sm text-red-600 mt-2">
                  <strong>Error:</strong> {sessionData.error || 'Unknown error'}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
            <li>First, log in at <a href="/auth/login" className="text-blue-600 underline">/auth/login</a></li>
            <li>After successful login, come back to this page</li>
            <li>Check if cookies are present and if the session is valid</li>
            <li>If cookies are missing, there's a cookie-setting issue</li>
            <li>If cookies exist but session fails, there's a validation issue</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
