// Dual detection: Accept-Language for website language, cf.country for demo restaurant

const supportedLocales = ['en', 'es', 'pt-BR', 'de', 'fr', 'it', 'nl', 'pl', 'th', 'vi', 'id', 'ms', 'tl', 'ja'];

// Parse Accept-Language header and get best match
function parseAcceptLanguage(header: string | null): string {
  if (!header) return 'en';

  // Parse "en-US,en;q=0.9,ja;q=0.8" format
  const languages = header.split(',').map(lang => {
    const [code, qValue] = lang.trim().split(';q=');
    return {
      code: code.split('-')[0].toLowerCase(), // 'en-US' -> 'en'
      fullCode: code.toLowerCase(),            // Keep 'pt-BR' as is
      q: qValue ? parseFloat(qValue) : 1
    };
  }).sort((a, b) => b.q - a.q);

  // Find first supported match
  for (const lang of languages) {
    // Check full code first (pt-BR)
    if (supportedLocales.includes(lang.fullCode)) return lang.fullCode;
    // Then check base code (pt -> pt-BR for Brazil)
    const baseMatch = supportedLocales.find(l => l.startsWith(lang.code));
    if (baseMatch) return baseMatch;
  }

  return 'en'; // Default
}

interface CFRequest extends Request {
  cf?: {
    country?: string;
    city?: string;
    timezone?: string;
  };
}

interface Context {
  request: CFRequest;
  next: () => Promise<Response>;
}

export async function onRequest(context: Context) {
  const { request } = context;
  const url = new URL(request.url);

  // Skip for API routes
  if (url.pathname.startsWith('/api/')) {
    return context.next();
  }

  // Skip for static assets
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map|json)$/)) {
    return context.next();
  }

  // Check if already has locale prefix
  const pathParts = url.pathname.split('/').filter(Boolean);

  if (supportedLocales.includes(pathParts[0])) {
    // Already has locale, inject country data for demo restaurant selection
    const response = await context.next();
    const country = request.cf?.country || 'US';

    // Clone response and add country header for client-side demo selection
    const newHeaders = new Headers(response.headers);
    newHeaders.set('X-Detected-Country', country);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }

  // Check for stored preference cookie first
  const cookies = request.headers.get('Cookie') || '';
  const preferredLocale = cookies.match(/preferred_locale=([\w-]+)/)?.[1];

  if (preferredLocale && supportedLocales.includes(preferredLocale)) {
    url.pathname = `/${preferredLocale}${url.pathname}`;
    return Response.redirect(url.toString(), 302);
  }

  // Detect from Accept-Language header (more accurate than country)
  const acceptLanguage = request.headers.get('Accept-Language');
  const locale = parseAcceptLanguage(acceptLanguage);

  url.pathname = `/${locale}${url.pathname}`;
  return Response.redirect(url.toString(), 302);
}
