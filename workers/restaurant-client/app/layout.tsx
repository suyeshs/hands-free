import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { RestaurantProvider } from './contexts/RestaurantContext';
import { MenuProvider } from './contexts/MenuContext';
import { ClientLayout } from '../components/ClientLayout';
import { fetchTheme } from './lib/theme-loader';
import { generateCSSVariables } from './lib/css-generator';
import { fetchRestaurantProfile, getFallbackProfile } from './lib/restaurant-config-loader';
import { headers } from 'next/headers';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// Force dynamic rendering to detect tenant from hostname
export const dynamic = 'force-dynamic';

/**
 * Generate dynamic metadata for each tenant
 * This makes each restaurant have their own title, description, and OG tags
 */
export async function generateMetadata(): Promise<Metadata> {
  try {
    // Get tenant ID from middleware
    const headersList = headers();
    const tenantId = headersList.get('x-tenant-id') || 'demo';
    const hostname = headersList.get('x-original-host') || headersList.get('host') || 'localhost';

    // Fetch restaurant profile to get tenant-specific branding
    let profile = null;
    try {
      const { env } = await getCloudflareContext();
      if (env?.TENANTS_DB) {
        profile = await fetchRestaurantProfile(tenantId, env.TENANTS_DB);
      }
    } catch (error) {
      console.error('[Metadata] Error fetching profile:', error);
    }

    // Use profile data or fallback
    profile = profile || getFallbackProfile(tenantId);

    // Build tenant-specific metadata
    const title = `${profile.name} | Order Online`;
    const description = profile.about || `Order delicious ${profile.cuisine} food from ${profile.name}. Voice-powered ordering with multimodal display.`;
    const siteUrl = `https://${hostname}`;
    const logoUrl = profile.brandIdentity?.logo || `${siteUrl}/default-restaurant-logo.png`;

    return {
      title: {
        default: title,
        template: `%s | ${profile.name}`,
      },
      description,
      keywords: [
        profile.name,
        profile.cuisine,
        'restaurant',
        'online ordering',
        'food delivery',
        'voice ordering',
        'multimodal',
      ],
      authors: [{ name: profile.name }],
      creator: profile.name,
      publisher: profile.name,
      viewport: {
        width: 'device-width',
        initialScale: 1,
        maximumScale: 1,
        userScalable: false,
      },
      robots: {
        index: true,
        follow: true,
      },
      openGraph: {
        type: 'website',
        locale: 'en_US',
        url: siteUrl,
        siteName: profile.name,
        title,
        description,
        images: [
          {
            url: logoUrl,
            width: 1200,
            height: 630,
            alt: `${profile.name} Logo`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [logoUrl],
      },
      icons: {
        icon: profile.brandIdentity?.logo || '/favicon.ico',
        apple: profile.brandIdentity?.logo || '/apple-touch-icon.png',
      },
      applicationName: profile.name,
      appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: profile.name,
      },
      other: {
        'mobile-web-app-capable': 'yes', // Modern standard for PWA
      },
    };
  } catch (error) {
    console.error('[Metadata] Error generating metadata:', error);
    // Return fallback metadata
    return {
      title: 'Handsfree Restaurant',
      description: 'Voice-powered restaurant ordering with multimodal display',
      viewport: {
        width: 'device-width',
        initialScale: 1,
        maximumScale: 1,
        userScalable: false,
      },
    };
  }
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  try {
    // Get tenant ID from middleware (set from request.url in middleware.ts)
    const headersList = headers();
    const tenantId = headersList.get('x-tenant-id') || 'demo';
    const hostname = headersList.get('x-original-host') || headersList.get('host') || 'unknown';

    // Get Cloudflare context for D1 database access
    let profile = null;
    try {
      const { env } = await getCloudflareContext();

      // Fetch restaurant profile directly from D1 database
      if (env?.TENANTS_DB) {
        const restaurantProfile = await fetchRestaurantProfile(tenantId, env.TENANTS_DB);
        profile = restaurantProfile || getFallbackProfile(tenantId);
      } else {
        console.warn('[Layout] TENANTS_DB not available, using fallback profile');
        profile = getFallbackProfile(tenantId);
      }
    } catch (error) {
      console.error('[Layout] Error fetching restaurant profile:', error);
      profile = getFallbackProfile(tenantId);
    }

    // Fetch theme server-side - pass tenant ID for CDN lookup
    // This enables tenant-specific themes from KV storage
    let theme;
    try {
      theme = await fetchTheme(tenantId !== 'demo' ? tenantId : undefined);
    } catch (error) {
      console.error('[Layout] Error fetching theme:', error);
      // fetchTheme should handle errors internally, but just in case
      theme = await fetchTheme(); // Try with default
    }

    // Generate CSS variables from theme
    let cssVariables = '';
    try {
      cssVariables = generateCSSVariables(theme);
    } catch (error) {
      console.error('[Layout] Error generating CSS variables:', error);
      cssVariables = ''; // Empty CSS if generation fails
    }

    // Debug logging
    console.log('[Layout] All headers:', Array.from(headersList.entries()).map(([k, v]) => `${k}=${v}`).join(', '));
    console.log('[Layout] Hostname:', hostname);
    console.log('[Layout] Tenant ID:', tenantId);
    console.log('[Layout] Profile:', profile ? profile.name : 'null');
    console.log('[Layout] Theme:', theme.meta?.name || 'Unknown');

    return (
      <html lang="en">
        <head>
          {/* Inject dynamic theme CSS variables */}
          <style
            id="theme-variables"
            dangerouslySetInnerHTML={{ __html: cssVariables }}
          />
          {/* Debug info */}
          <meta name="x-tenant-id" content={tenantId} />
          <meta name="x-restaurant-name" content={profile?.name || 'unknown'} />
        </head>
        <body className="antialiased">
          <ClientLayout>
            <RestaurantProvider initialProfile={profile}>
              <ThemeProvider initialTheme={theme}>
                <MenuProvider>
                  {children}
                </MenuProvider>
              </ThemeProvider>
            </RestaurantProvider>
          </ClientLayout>
        </body>
      </html>
    );
  } catch (error) {
    console.error('[Layout] Fatal error:', error);
    // Return a basic error page
    return (
      <html lang="en">
        <head><title>Error</title></head>
        <body>
          <div style={{padding: '20px'}}>
            <h1>Application Error</h1>
            <p>Sorry, something went wrong. Please try again later.</p>
          </div>
        </body>
      </html>
    );
  }
}
