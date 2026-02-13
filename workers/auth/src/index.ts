import { issuer } from "@openauthjs/openauth";
import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare";
import { PasswordProvider } from "@openauthjs/openauth/provider/password";
import { PasswordUI } from "@openauthjs/openauth/ui/password";
import { createSubjects } from "@openauthjs/openauth/subject";
import { object, string, array, optional, literal } from "valibot";
import {
  initiateRegistration,
  verifyRegistration,
  initiateAuthentication,
  verifyAuthentication,
  listUserCredentials,
  deleteCredential,
} from "./passkey";
import { sendMagicLinkEmail } from "./email";

// ========================================
// Type Definitions
// ========================================

type UserContext = 'platform' | 'tenant';

interface PlatformUserRecord {
  id: string;
  email: string;
  role: string;
  tenant_ids: string | null;
}

interface TenantUserRecord {
  id: string;
  email: string;
  role: string;
  tenant_id: string;
}

interface TenantRecord {
  id: string;
  company_name: string | null;
  theme_config: string | null;
}

// OAuth Client Configuration
interface OAuthClient {
  clientId: string;
  allowedRedirectUris: (string | RegExp)[];
  context: 'platform' | 'tenant';
}

// ========================================
// OAuth Client Registry
// ========================================

const OAUTH_CLIENTS: Record<string, OAuthClient> = {
  'admin-app': {
    clientId: 'admin-app',
    allowedRedirectUris: [
      'https://setup.handsfree.tech',
      'https://setup.handsfree.tech/auth/callback',
      'https://stonepot-admin.pages.dev',
      'https://stonepot-admin.pages.dev/auth/callback',
      // Allow Cloudflare Pages preview deployments with pattern matching
      /^https:\/\/[a-f0-9]+\.stonepot-admin\.pages\.dev$/,
      /^https:\/\/[a-f0-9]+\.stonepot-admin\.pages\.dev\/auth\/callback$/,
    ],
    context: 'platform',
  },
};

// ========================================
// Subject Definitions
// ========================================

const subjects = createSubjects({
  // Platform users (super admins and store owners)
  platformUser: object({
    id: string(),
    email: string(),
    role: string(),
    tenantIds: optional(array(string())),
    context: literal('platform'),
  }),
  
  // Tenant users (store customers)
  tenantUser: object({
    id: string(),
    email: string(),
    role: string(),
    tenantId: string(),
    context: literal('tenant'),
  }),
});

// ========================================
// CORS Helper
// ========================================

function getCorsHeaders(origin: string): Headers {
  const allowedOrigins = [
    'https://setup.handsfree.tech',
    'https://stonepot-admin.pages.dev',
  ];

  const allowedPatterns = [
    /^https:\/\/[a-f0-9]+\.stonepot-admin\.pages\.dev$/,
  ];

  const isAllowed = allowedOrigins.includes(origin) || 
                    allowedPatterns.some(pattern => pattern.test(origin));

  const headers = new Headers({
    'Content-Type': 'application/json',
  });

  if (isAllowed) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Access-Control-Max-Age', '86400');
  }

  return headers;
}

// ========================================
// Main Worker Handler
// ========================================

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';
    
    // Handle CORS preflight requests for passkey API
    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/passkey')) {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin),
      });
    }
    
    // Determine authentication context
    const clientId = url.searchParams.get('client_id');
    const referer = request.headers.get('referer') || '';
    
    let authContext: UserContext;
    let tenantId: string | null = null;
    
    // Validate redirect_uri for OAuth authorize requests
    if (url.pathname === '/authorize' && clientId) {
      const requestedRedirectUri = url.searchParams.get('redirect_uri');
      if (requestedRedirectUri && !validateRedirectUri(clientId, requestedRedirectUri)) {
        return new Response(
          `Client ${clientId} is not authorized to use this redirect_uri: ${requestedRedirectUri}`,
          { 
            status: 400,
            headers: { 'Content-Type': 'text/plain' }
          }
        );
      }
    }
    
    // Platform authentication detection (admin-app)
    // Check client_id, referer, origin, and OpenAuth internal routes
    const isPlatformContext =
      clientId === 'admin-app' ||
      referer.includes('setup.handsfree.tech') ||
      referer.includes('stonepot-admin.pages.dev') ||
      origin.includes('setup.handsfree.tech') ||
      origin.includes('stonepot-admin.pages.dev') ||
      // OpenAuth internal routes on workers.dev domain default to platform
      (url.hostname.includes('stonepot-oauth.suyesh.workers.dev') && 
       (url.pathname.startsWith('/password/') || url.pathname.startsWith('/authorize')));
    
    if (isPlatformContext) {
      authContext = 'platform';
      console.log('[Auth] Platform context detected', { clientId, referer, origin, pathname: url.pathname });
    } else {
      // Tenant authentication (store customers)
      authContext = 'tenant';
      tenantId = clientId || extractTenantFromDomain(url.hostname) || extractTenantFromReferer(referer);
      
      if (!tenantId) {
        return new Response('Invalid authentication context: tenant ID required', { 
          status: 400,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
      
      console.log(`[Auth] Tenant context detected: ${tenantId}`);
      
      // Verify tenant exists and is active
      const tenant = await env.AUTH_DB.prepare(
        'SELECT id, company_name FROM tenants WHERE id = ? AND is_active = 1'
      ).bind(tenantId).first<TenantRecord>();
      
      if (!tenant) {
        return new Response(`Tenant not found or inactive: ${tenantId}`, { 
          status: 404,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    }
    
    // API endpoint for getting current session
    if (url.pathname === "/session" && request.method === "GET") {
      try {
        // OpenAuth stores session in KV - we need to verify the session cookie
        const cookies = request.headers.get('Cookie') || '';
        const sessionId = cookies.match(/openauth\.session=([^;]+)/)?.[1];
        
        if (!sessionId) {
          return new Response(JSON.stringify({ error: 'No session found' }), {
            status: 401,
            headers: getCorsHeaders(origin)
          });
        }
        
        // Get session from KV storage
        const sessionKey = `session:${sessionId}`;
        const sessionData = await env.AUTH_STORAGE.get(sessionKey, 'json');
        
        if (!sessionData) {
          return new Response(JSON.stringify({ error: 'Session expired or invalid' }), {
            status: 401,
            headers: getCorsHeaders(origin)
          });
        }
        
        return new Response(JSON.stringify(sessionData), {
          status: 200,
          headers: getCorsHeaders(origin)
        });
      } catch (error) {
        console.error('[Session] Failed to get session:', error);
        return new Response(JSON.stringify({ error: 'Failed to get session' }), {
          status: 500,
          headers: getCorsHeaders(origin)
        });
      }
    }
    
    // ========================================
    // Passkey API Endpoints
    // ========================================
    
    // POST /api/passkey/register/init - Start passkey registration
    if (url.pathname === "/api/passkey/register/init" && request.method === "POST") {
      try {
        const body = await request.json() as { userId: string; email: string; userName: string };
        
        if (!body.userId || !body.email || !body.userName) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: getCorsHeaders(origin)
          });
        }

        const result = await initiateRegistration(
          env,
          body.userId,
          body.email,
          body.userName,
          origin || url.origin
        );

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: getCorsHeaders(origin)
        });
      } catch (error) {
        console.error('[Passkey] Registration init failed:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to initiate passkey registration',
          message: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: getCorsHeaders(origin)
        });
      }
    }

    // POST /api/passkey/register/verify - Complete passkey registration
    if (url.pathname === "/api/passkey/register/verify" && request.method === "POST") {
      try {
        const body = await request.json() as { userId: string; response: any };
        
        if (!body.userId || !body.response) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: getCorsHeaders(origin)
          });
        }

        const result = await verifyRegistration(
          env,
          body.userId,
          body.response,
          origin || url.origin
        );

        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: getCorsHeaders(origin)
        });
      } catch (error) {
        console.error('[Passkey] Registration verify failed:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to verify passkey registration',
          message: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: getCorsHeaders(origin)
        });
      }
    }

    // POST /api/passkey/auth/init - Start passkey authentication
    if (url.pathname === "/api/passkey/auth/init" && request.method === "POST") {
      try {
        const body = await request.json() as { email?: string };

        // Use the origin from request headers (the actual client domain)
        const result = await initiateAuthentication(
          env,
          body.email,
          origin || url.origin
        );

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: getCorsHeaders(origin)
        });
      } catch (error) {
        console.error('[Passkey] Authentication init failed:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to initiate passkey authentication',
          message: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: getCorsHeaders(origin)
        });
      }
    }

    // POST /api/passkey/auth/verify - Complete passkey authentication
    if (url.pathname === "/api/passkey/auth/verify" && request.method === "POST") {
      try {
        const body = await request.json() as { response: any };
        
        if (!body.response) {
          return new Response(JSON.stringify({ error: 'Missing authentication response' }), {
            status: 400,
            headers: getCorsHeaders(origin)
          });
        }

        const result = await verifyAuthentication(
          env,
          body.response,
          origin || url.origin
        );

        if (result.success && result.userId && result.email) {
          // Create session token for the authenticated user
          const subject = await handlePlatformAuth(ctx, result.email, env);
          
          // Generate access token (simple JWT-like structure)
          const token = await generateToken(env, {
            sub: subject.id,
            email: subject.email,
            role: subject.properties?.role || 'owner',
            context: 'platform',
            iat: Date.now(),
            exp: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
          });

          // Set httpOnly cookie with access token
          const headers = new Headers({
            'Content-Type': 'application/json',
          });

          // Set session cookie (httpOnly, secure)
          headers.append('Set-Cookie', 
            `auth_token=${token}; ` +
            `Path=/; ` +
            `HttpOnly; ` +
            `Secure; ` +
            `SameSite=Lax; ` +
            `Domain=.handsfree.tech; ` +
            `Max-Age=${7 * 24 * 60 * 60}` // 7 days
          );

          return new Response(JSON.stringify({
            success: true,
            user: {
              id: result.userId,
              email: result.email
            }
          }), {
            status: 200,
            headers,
          });
        }

        return new Response(JSON.stringify({ 
          success: false,
          error: 'Authentication failed'
        }), {
          status: 401,
          headers: getCorsHeaders(origin)
        });
      } catch (error) {
        console.error('[Passkey] Authentication verify failed:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to verify passkey authentication',
          message: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: getCorsHeaders(origin)
        });
      }
    }

    // GET /api/passkey/list - List user's passkeys
    if (url.pathname === "/api/passkey/list" && request.method === "GET") {
      try {
        const userId = url.searchParams.get('userId');
        
        if (!userId) {
          return new Response(JSON.stringify({ error: 'Missing userId parameter' }), {
            status: 400,
            headers: getCorsHeaders(origin)
          });
        }

        const credentials = await listUserCredentials(env, userId);

        return new Response(JSON.stringify({ credentials }), {
          status: 200,
          headers: getCorsHeaders(origin)
        });
      } catch (error) {
        console.error('[Passkey] List credentials failed:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to list passkeys',
          message: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: getCorsHeaders(origin)
        });
      }
    }

    // DELETE /api/passkey/delete - Delete a passkey
    if (url.pathname === "/api/passkey/delete" && request.method === "DELETE") {
      try {
        const body = await request.json() as { userId: string; credentialId: string };
        
        if (!body.userId || !body.credentialId) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: getCorsHeaders(origin)
          });
        }

        const success = await deleteCredential(env, body.userId, body.credentialId);

        return new Response(JSON.stringify({ success }), {
          status: success ? 200 : 404,
          headers: getCorsHeaders(origin)
        });
      } catch (error) {
        console.error('[Passkey] Delete credential failed:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to delete passkey',
          message: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: getCorsHeaders(origin)
        });
      }
    }

    // API endpoint for creating users programmatically (for tenant signups)
    if (url.pathname === "/api/users/create" && request.method === "POST") {
      try {
        const body = await request.json() as {
          email: string;
          role: 'super_admin' | 'store_owner';
          tenantIds?: string[];
        };
        
        if (!body.email || !body.role) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: getCorsHeaders(origin)
          });
        }
        
        // Check if user already exists
        const existing = await env.AUTH_DB.prepare(
          'SELECT id FROM platform_user WHERE email = ?'
        ).bind(body.email).first();
        
        if (existing) {
          return new Response(JSON.stringify({ 
            error: 'User already exists',
            userId: existing.id
          }), {
            status: 409,
            headers: getCorsHeaders(origin)
          });
        }
        
        // Create new platform user
        const tenantIdsJson = body.tenantIds ? JSON.stringify(body.tenantIds) : null;
        await env.AUTH_DB.prepare(
          'INSERT INTO platform_user (email, role, tenant_ids) VALUES (?, ?, ?)'
        ).bind(body.email, body.role, tenantIdsJson).run();
        
        return new Response(JSON.stringify({ 
          success: true,
          message: 'User created successfully'
        }), {
          status: 201,
          headers: getCorsHeaders(origin)
        });
      } catch (error) {
        console.error('[API] User creation failed:', error);
        return new Response(JSON.stringify({ error: 'Failed to create user' }), {
          status: 500,
          headers: getCorsHeaders(origin)
        });
      }
    }
    
    // Demo OAuth flow handlers
    if (url.pathname === "/") {
      url.searchParams.set("redirect_uri", url.origin + "/callback");
      url.searchParams.set("client_id", clientId || "demo-client");
      url.searchParams.set("response_type", "code");
      url.pathname = "/authorize";
      return Response.redirect(url.toString());
    } else if (url.pathname === "/callback") {
      return Response.json({
        message: "OAuth flow complete!",
        context: authContext,
        tenant: tenantId,
        params: Object.fromEntries(url.searchParams.entries()),
      });
    }
    
    // Get redirect URI from query params
    const redirectUri = url.searchParams.get('redirect_uri') || url.origin;
    
    // OpenAuth issuer with context-aware configuration
    return issuer({
      storage: CloudflareStorage({
        namespace: env.AUTH_STORAGE as any, // Type assertion due to @cloudflare/workers-types version mismatch
      }),
      subjects,
      providers: {
        password: PasswordProvider(
          PasswordUI({
            sendCode: async (email, code) => {
              const context = authContext === 'platform' ? 'Platform Admin' : `Tenant: ${tenantId}`;
              console.log(`[${context}] Sending magic link to ${email}`);
              
              // Send magic link email via MailChannels
              try {
                const sent = await sendMagicLinkEmail(email, code);
                if (sent) {
                  console.log(`[Email] Magic link sent successfully to ${email}`);
                } else {
                  console.error(`[Email] Failed to send magic link to ${email}`);
                  // Fallback: log the code for development
                  console.log(`[Email] FALLBACK - Magic link code: ${code}`);
                }
              } catch (error) {
                console.error(`[Email] Error sending magic link:`, error);
                // Fallback: log the code for development
                console.log(`[Email] FALLBACK - Magic link code: ${code}`);
              }
            },
            copy: {
              input_code: "Enter the code from your email",
            },
          }),
        ),
      },
      theme: await getThemeForContext(authContext, tenantId, env),
      // Allow callback to handle redirect URI validation
      allow: async (input) => {
        // For admin-app client, validate against our whitelist
        if (input.clientID === 'admin-app') {
          const isValid = validateRedirectUri(input.clientID, input.redirectURI);
          if (!isValid) {
            console.error(`[Auth] Rejected redirect_uri: ${input.redirectURI} for client: ${input.clientID}`);
          }
          return isValid;
        }
        // For other clients (tenants), allow all for now
        // TODO: Implement per-tenant redirect URI validation
        return true;
      },
      success: async (ctx, value) => {
        // Create and return the appropriate subject based on context
        if (authContext === 'platform') {
          return await handlePlatformAuth(ctx, value.email, env);
        } else {
          return await handleTenantAuth(ctx, value.email, tenantId!, env);
        }
      },
    }).fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;

// ========================================
// Helper Functions
// ========================================

function validateRedirectUri(clientId: string, redirectUri: string): boolean {
  const client = OAUTH_CLIENTS[clientId];
  if (!client) {
    console.error(`[Auth] Unknown client: ${clientId}`);
    return false;
  }

  // Check exact matches and regex patterns
  for (const allowed of client.allowedRedirectUris) {
    if (typeof allowed === 'string') {
      if (redirectUri === allowed) {
        return true;
      }
    } else if (allowed instanceof RegExp) {
      if (allowed.test(redirectUri)) {
        return true;
      }
    }
  }

  console.error(`[Auth] Invalid redirect_uri for client ${clientId}: ${redirectUri}`);
  return false;
}

function extractTenantFromDomain(domain: string): string | null {
  // Extract from: suyesh-corp.handsfree.tech → suyesh-corp
  const match = domain.match(/^([^.]+)\.handsfree\.tech$/);
  return match ? match[1] : null;
}

function extractTenantFromReferer(referer: string): string | null {
  if (!referer) return null;
  try {
    const url = new URL(referer);
    return extractTenantFromDomain(url.hostname);
  } catch {
    return null;
  }
}

async function getThemeForContext(
  context: UserContext,
  tenantId: string | null,
  env: Env
) {
  if (context === 'platform') {
    // Platform admin theme
    return {
      title: "Facemash Platform Admin",
      primary: "#0ea5e9", // Sky blue
      favicon: "https://workers.cloudflare.com/favicon.ico",
      logo: {
        light: "https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/fa5a3023-7da9-466b-98a7-4ce01ee6c700/public",
        dark: "https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/db1e5c92-d3a6-4ea9-3e72-155844211f00/public",
      },
    };
  } else {
    // Tenant-specific theme
    try {
      const tenant = await env.AUTH_DB.prepare(
        'SELECT company_name, theme_config FROM tenants WHERE id = ?'
      ).bind(tenantId!).first<TenantRecord>();
      
      if (tenant?.theme_config) {
        try {
          const customTheme = JSON.parse(tenant.theme_config);
          return {
            title: `${tenant.company_name || 'Store'} Admin`,
            ...customTheme,
          };
        } catch (e) {
          console.error('Failed to parse tenant theme config:', e);
        }
      }
      
      // Default tenant theme
      return {
        title: `${tenant?.company_name || 'Store'} Admin`,
        primary: "#6366f1", // Indigo
        favicon: "https://workers.cloudflare.com/favicon.ico",
      };
    } catch (error) {
      console.error('Error loading tenant theme:', error);
      return {
        title: "Store Admin",
        primary: "#6366f1",
        favicon: "https://workers.cloudflare.com/favicon.ico",
      };
    }
  }
}

// ========================================
// Token Generation
// ========================================

async function generateToken(env: Env, payload: any): Promise<string> {
  // Create a simple base64-encoded token with signature
  // In production, use proper JWT with signing
  const tokenData = JSON.stringify(payload);
  const tokenBase64 = btoa(tokenData);
  
  // For now, return the base64 encoded payload
  // TODO: Add proper HMAC signing with a secret key
  return tokenBase64;
}

// ========================================
// Platform Authentication Handler
// ========================================

async function handlePlatformAuth(ctx: any, email: string, env: Env) {
  console.log(`[Platform Auth] Processing login for: ${email}`);
  
  // Check if user exists
  let user = await env.AUTH_DB.prepare(
    'SELECT id, email, role, tenant_ids FROM platform_user WHERE email = ?'
  )
    .bind(email)
    .first<PlatformUserRecord>();

  if (!user) {
    // Create new platform user as store_owner by default
    console.log(`[Platform Auth] Creating new store_owner: ${email}`);
    
    await env.AUTH_DB.prepare(
      'INSERT INTO platform_user (email, role) VALUES (?, ?)'
    )
      .bind(email, 'store_owner')
      .run();
    
    // Fetch the created user
    user = await env.AUTH_DB.prepare(
      'SELECT id, email, role, tenant_ids FROM platform_user WHERE email = ?'
    )
      .bind(email)
      .first<PlatformUserRecord>();
  }

  if (!user) {
    throw new Error(`Unable to create platform user: ${email}`);
  }

  // Parse tenant_ids JSON array
  const tenantIds = user.tenant_ids ? JSON.parse(user.tenant_ids) : [];

  // Update last_login
  await env.AUTH_DB.prepare(
    'UPDATE platform_user SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
  )
    .bind(user.id)
    .run();

  console.log(
    `[Platform Auth] Success: ${user.email} (${user.role}) - Tenants: [${tenantIds.join(', ') || 'none'}]`
  );

  return ctx.subject("platformUser", {
    id: user.id,
    email: user.email,
    role: user.role,
    tenantIds,
    context: 'platform' as const,
  });
}

// ========================================
// Tenant Authentication Handler
// ========================================

async function handleTenantAuth(ctx: any, email: string, tenantId: string, env: Env) {
  console.log(`[Tenant Auth] Processing login for: ${email} → ${tenantId}`);
  
  // Check if user exists for this tenant
  let user = await env.AUTH_DB.prepare(
    'SELECT id, email, role FROM tenant_user WHERE email = ? AND tenant_id = ?'
  )
    .bind(email, tenantId)
    .first<TenantUserRecord>();

  if (!user) {
    // Create new tenant user as customer by default
    console.log(`[Tenant Auth] Creating new customer: ${email} for ${tenantId}`);
    
    await env.AUTH_DB.prepare(
      'INSERT INTO tenant_user (email, tenant_id, role) VALUES (?, ?, ?)'
    )
      .bind(email, tenantId, 'customer')
      .run();
    
    // Fetch the created user
    user = await env.AUTH_DB.prepare(
      'SELECT id, email, role FROM tenant_user WHERE email = ? AND tenant_id = ?'
    )
      .bind(email, tenantId)
      .first<TenantUserRecord>();
  }

  if (!user) {
    throw new Error(`Unable to create tenant user: ${email} for tenant: ${tenantId}`);
  }

  // Update last_login
  await env.AUTH_DB.prepare(
    'UPDATE tenant_user SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
  )
    .bind(user.id)
    .run();

  console.log(
    `[Tenant Auth] Success: ${user.email} → ${tenantId} (${user.role})`
  );

  return ctx.subject("tenantUser", {
    id: user.id,
    email: user.email,
    role: user.role,
    tenantId,
    context: 'tenant' as const,
  });
}
