/**
 * Legal Pages HTML Generator
 * Serves tenant-branded Privacy Policy, Terms & Conditions, and Cookie Policy pages
 * Follows the same pattern as generateConversationHTML in index.ts
 */

// ─── Shared styles ────────────────────────────────────────────────────────────

function baseStyles(theme: any): string {
  return `
    :root {
      --primary:    ${theme.colors?.primary    || '#F28C38'};
      --secondary:  ${theme.colors?.secondary  || '#1A0F0B'};
      --bg:         ${theme.colors?.background || '#1A0F0B'};
      --surface:    ${theme.colors?.surface    || 'rgba(255,255,255,0.05)'};
      --text:       ${theme.colors?.text       || '#FFF8F0'};
      --text-muted: ${theme.colors?.textMuted  || 'rgba(255,248,240,0.5)'};
      --border:     ${theme.colors?.border     || 'rgba(255,255,255,0.08)'};
      --font:       ${theme.typography?.fontFamily || 'system-ui, -apple-system, sans-serif'};
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html { scroll-behavior: smooth; }

    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
      min-height: 100vh;
      padding-bottom: 200px; /* ensure content is never hidden behind fixed cookie banner */
    }

    a { color: var(--primary); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* Header */
    .hdr {
      border-bottom: 1px solid var(--border);
      background: rgba(26,15,11,0.85);
      backdrop-filter: blur(12px);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .hdr-inner {
      max-width: 860px;
      margin: 0 auto;
      padding: 20px 24px;
    }
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      color: var(--text-muted);
      margin-bottom: 12px;
    }
    .back-link:hover { color: var(--text); text-decoration: none; }
    .page-title { font-size: 2rem; font-weight: 600; }
    .page-subtitle { font-size: 14px; color: var(--text-muted); margin-top: 4px; }

    /* Content */
    .content {
      max-width: 860px;
      margin: 0 auto;
      padding: 48px 24px;
    }

    section { margin-bottom: 48px; }

    h2 {
      font-size: 1.35rem;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--text);
    }

    h3 {
      font-size: 1.05rem;
      font-weight: 500;
      color: var(--primary);
      margin-bottom: 10px;
      margin-top: 20px;
    }

    p { color: var(--text-muted); margin-bottom: 12px; }

    ul, ol {
      color: var(--text-muted);
      padding-left: 20px;
      margin-bottom: 12px;
    }
    li { margin-bottom: 6px; }
    li strong { color: var(--text); }

    /* Cards */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px;
      margin-bottom: 16px;
    }
    .card-title { font-size: 1rem; font-weight: 500; color: var(--text); margin-bottom: 8px; }
    .card-sub   { font-size: 12px; color: var(--text-muted); margin-bottom: 10px; }

    /* Highlight box */
    .highlight {
      background: linear-gradient(135deg, rgba(242,140,56,0.08) 0%, transparent 100%);
      border: 1px solid rgba(242,140,56,0.2);
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 16px;
    }
    .highlight-icon { font-size: 1.4rem; margin-bottom: 10px; }
    .highlight h3   { color: var(--text); margin-top: 0; }

    /* Grid */
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    @media (max-width: 600px) { .grid-2 { grid-template-columns: 1fr; } }

    /* Badge */
    .badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 500;
      color: var(--primary);
      background: rgba(242,140,56,0.12);
      border-radius: 999px;
      padding: 2px 10px;
      margin-bottom: 8px;
    }

    /* Security highlights (Privacy page) */
    .security-bar {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      padding: 24px;
      border-bottom: 1px solid var(--border);
      background: rgba(255,255,255,0.02);
    }
    @media (max-width: 600px) { .security-bar { grid-template-columns: 1fr; } }
    .sec-item {
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px;
    }
    .sec-icon { font-size: 1.4rem; }
    .sec-label { font-size: 13px; font-weight: 500; color: var(--text); }
    .sec-desc  { font-size: 11px; color: var(--text-muted); }

    /* Table */
    table { width: 100%; border-collapse: collapse; font-size: 14px; overflow: hidden; border-radius: 10px; }
    thead th {
      text-align: left;
      padding: 12px 16px;
      color: var(--text);
      font-weight: 500;
      border-bottom: 1px solid var(--border);
    }
    tbody td { padding: 12px 16px; color: var(--text-muted); border-bottom: 1px solid var(--border); }
    tbody tr:last-child td { border-bottom: none; }
    .mono { font-family: monospace; font-size: 12px; color: var(--primary); }

    /* Footer */
    .footer {
      border-top: 1px solid var(--border);
      padding: 28px 24px;
      background: var(--bg);
    }
    .footer-inner {
      max-width: 860px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      font-size: 13px;
      color: var(--text-muted);
    }
    .footer-links { display: flex; flex-wrap: wrap; gap: 20px; }
    .footer-links a { color: var(--text-muted); }
    .footer-links a:hover { color: var(--text); text-decoration: none; }

    /* Cookie consent banner */
    #cookie-banner {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      z-index: 9999;
      padding: 16px;
      display: none;
    }
    #cookie-banner.visible { display: block; }
    .cookie-inner {
      max-width: 820px;
      margin: 0 auto;
      background: rgba(26,15,11,0.97);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 24px;
      box-shadow: 0 -8px 40px rgba(0,0,0,0.4);
    }
    .cookie-main { display: flex; align-items: flex-start; gap: 16px; }
    .cookie-icon { font-size: 2rem; flex-shrink: 0; }
    .cookie-title { font-size: 1rem; font-weight: 600; color: var(--text); margin-bottom: 6px; }
    .cookie-desc  { font-size: 13px; color: var(--text-muted); line-height: 1.6; margin-bottom: 16px; }
    .cookie-btns  { display: flex; flex-wrap: wrap; gap: 10px; }
    .btn-primary {
      padding: 10px 20px;
      background: var(--primary);
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-primary:hover { opacity: 0.9; }
    .btn-secondary {
      padding: 10px 20px;
      background: rgba(255,255,255,0.06);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-secondary:hover { background: rgba(255,255,255,0.1); }
    .btn-ghost {
      padding: 10px 16px;
      background: none;
      color: var(--text-muted);
      border: none;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn-ghost:hover { color: var(--text); }

    /* Prefs panel */
    .prefs-panel { display: none; }
    .prefs-panel.visible { display: block; }
    .pref-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 10px;
    }
    .pref-label { font-size: 14px; font-weight: 500; color: var(--text); }
    .pref-desc  { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .toggle {
      width: 46px; height: 24px;
      border-radius: 999px;
      background: rgba(255,255,255,0.1);
      border: none;
      cursor: pointer;
      position: relative;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    .toggle.on { background: rgba(242,140,56,0.3); }
    .toggle::after {
      content: '';
      position: absolute;
      width: 18px; height: 18px;
      border-radius: 50%;
      background: #888;
      top: 3px; left: 3px;
      transition: transform 0.2s, background 0.2s;
    }
    .toggle.on::after { transform: translateX(22px); background: var(--primary); }
    .toggle.locked { opacity: 0.5; cursor: not-allowed; }
  `;
}

// ─── Cookie consent script (vanilla JS, no deps) ──────────────────────────────

function cookieConsentScript(tenantId: string, baseUrl: string): string {
  const key = `hf_cookie_consent_${tenantId}`;
  const prefsKey = `hf_cookie_prefs_${tenantId}`;
  return `
  (function() {
    var KEY   = '${key}';
    var PREFS = '${prefsKey}';
    var banner = document.getElementById('cookie-banner');
    var prefsPanel = document.getElementById('cookie-prefs');
    var mainPanel  = document.getElementById('cookie-main-panel');

    if (!localStorage.getItem(KEY)) {
      banner.classList.add('visible');
    }

    function save(prefs) {
      localStorage.setItem(KEY, '1');
      localStorage.setItem(PREFS, JSON.stringify(prefs));
      banner.classList.remove('visible');
    }

    document.getElementById('btn-accept-all').addEventListener('click', function() {
      save({ essential: true, functional: true, analytics: true });
    });

    document.getElementById('btn-essential').addEventListener('click', function() {
      save({ essential: true, functional: false, analytics: false });
    });

    document.getElementById('btn-manage').addEventListener('click', function() {
      mainPanel.classList.remove('visible');
      prefsPanel.classList.add('visible');
    });

    document.getElementById('btn-back').addEventListener('click', function() {
      prefsPanel.classList.remove('visible');
      mainPanel.classList.add('visible');
    });

    document.getElementById('btn-save-prefs').addEventListener('click', function() {
      var functional = document.getElementById('toggle-functional').classList.contains('on');
      var analytics  = document.getElementById('toggle-analytics').classList.contains('on');
      save({ essential: true, functional: functional, analytics: analytics });
    });

    document.getElementById('btn-accept-all-prefs').addEventListener('click', function() {
      save({ essential: true, functional: true, analytics: true });
    });

    // Toggles
    ['toggle-functional', 'toggle-analytics'].forEach(function(id) {
      var el = document.getElementById(id);
      el.addEventListener('click', function() { el.classList.toggle('on'); });
    });
  })();
  `;
}

// ─── Shared footer + nav HTML ─────────────────────────────────────────────────

function footerHTML(tenantName: string, year: number, baseUrl: string): string {
  return `
  <footer class="footer">
    <div class="footer-inner">
      <span>© ${year} ${tenantName}. Powered by HandsFree.tech</span>
      <nav class="footer-links">
        <a href="${baseUrl}/">Home</a>
        <a href="${baseUrl}/ui/privacy">Privacy Policy</a>
        <a href="${baseUrl}/ui/terms">Terms &amp; Conditions</a>
        <a href="${baseUrl}/ui/cookies">Cookie Policy</a>
      </nav>
    </div>
  </footer>`;
}

function cookieBannerHTML(baseUrl: string): string {
  return `
  <div id="cookie-banner">
    <div class="cookie-inner">

      <div id="cookie-main-panel" class="cookie-main visible">
        <div class="cookie-icon">🍪</div>
        <div style="flex:1">
          <div class="cookie-title">We use cookies</div>
          <div class="cookie-desc">
            We use cookies to improve your browsing experience and provide personalised features.
            Read our <a href="${baseUrl}/ui/cookies">Cookie Policy</a> to learn more.
          </div>
          <div class="cookie-btns">
            <button class="btn-primary"    id="btn-accept-all">✓ Accept All</button>
            <button class="btn-secondary"  id="btn-essential">Essential Only</button>
            <button class="btn-ghost"      id="btn-manage">⚙ Manage Preferences</button>
          </div>
        </div>
      </div>

      <div id="cookie-prefs" class="prefs-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <span style="font-size:1rem;font-weight:600;color:var(--text)">Cookie Preferences</span>
          <button class="btn-ghost" id="btn-back">← Back</button>
        </div>

        <div class="pref-row">
          <div>
            <div class="pref-label">Essential Cookies</div>
            <div class="pref-desc">Required for the site to function. Cannot be disabled.</div>
          </div>
          <button class="toggle on locked" disabled title="Always active"></button>
        </div>

        <div class="pref-row">
          <div>
            <div class="pref-label">Functional Cookies</div>
            <div class="pref-desc">Enhanced features and personalization.</div>
          </div>
          <button class="toggle on" id="toggle-functional"></button>
        </div>

        <div class="pref-row">
          <div>
            <div class="pref-label">Analytics Cookies</div>
            <div class="pref-desc">Help us improve the ordering experience.</div>
          </div>
          <button class="toggle on" id="toggle-analytics"></button>
        </div>

        <div style="display:flex;gap:10px;margin-top:16px">
          <button class="btn-primary"   style="flex:1" id="btn-save-prefs">Save Preferences</button>
          <button class="btn-secondary" id="btn-accept-all-prefs">Accept All</button>
        </div>
        <p style="font-size:12px;color:var(--text-muted);text-align:center;margin-top:12px">
          Learn more in our <a href="${baseUrl}/ui/cookies">Cookie Policy</a>
        </p>
      </div>

    </div>
  </div>`;
}

function wrapPage(opts: {
  title: string;
  theme: any;
  tenantName: string;
  tenantId: string;
  baseUrl: string;
  headerContent: string;
  bodyContent: string;
  extraTopContent?: string;
}): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.title} — ${opts.tenantName}</title>
  <style>${baseStyles(opts.theme)}</style>
</head>
<body>

  <header class="hdr">
    <div class="hdr-inner">
      <a class="back-link" href="${opts.baseUrl}/">← Back to Home</a>
      ${opts.headerContent}
    </div>
  </header>

  ${opts.extraTopContent || ''}

  <main class="content">
    ${opts.bodyContent}
  </main>

  ${cookieBannerHTML(opts.baseUrl)}

  <script>${cookieConsentScript(opts.tenantId, opts.baseUrl)}</script>
</body>
</html>`;
}

// ─── Privacy Policy ───────────────────────────────────────────────────────────

export function generatePrivacyHTML(theme: any, tenantName: string, tenantId: string, contactEmail: string, baseUrl: string): string {
  return wrapPage({
    title: 'Privacy Policy',
    theme,
    tenantName,
    tenantId,
    baseUrl,
    headerContent: `
      <h1 class="page-title">Privacy Policy</h1>
      <p class="page-subtitle">Last updated: November 2024</p>`,
    extraTopContent: `
      <div class="security-bar">
        <div class="sec-item"><span class="sec-icon">🛡️</span><div><div class="sec-label">Cloudflare Protected</div><div class="sec-desc">Enterprise-grade security</div></div></div>
        <div class="sec-item"><span class="sec-icon">🔒</span><div><div class="sec-label">End-to-End Encryption</div><div class="sec-desc">Data encrypted in transit &amp; at rest</div></div></div>
        <div class="sec-item"><span class="sec-icon">🌐</span><div><div class="sec-label">GDPR &amp; CCPA Compliant</div><div class="sec-desc">Your rights protected globally</div></div></div>
      </div>`,
    bodyContent: `
      <section>
        <h2>1. Introduction</h2>
        <p>${tenantName} ("we", "us", or "our") is committed to protecting your privacy.
        This Privacy Policy explains how we collect, use, and safeguard your information
        when you use our ordering platform powered by Stonepot (OPC) Pvt. Ltd.</p>
        <p>Our infrastructure is powered by Cloudflare, providing enterprise-grade security and global performance.</p>
      </section>

      <section>
        <h2>2. Information We Collect</h2>
        <h3>2.1 Information You Provide</h3>
        <ul>
          <li><strong>Order Information:</strong> Items ordered, special instructions, and preferences</li>
          <li><strong>Contact Details:</strong> Phone number for order confirmation</li>
          <li><strong>Payment Information:</strong> Processed securely through our payment providers</li>
          <li><strong>Communications:</strong> Support requests and feedback</li>
        </ul>
        <h3>2.2 Automatically Collected</h3>
        <ul>
          <li><strong>Usage Data:</strong> How you interact with the Service</li>
          <li><strong>Device Information:</strong> Browser type, OS, device identifiers</li>
          <li><strong>Log Data:</strong> IP address, access times, pages viewed</li>
        </ul>
      </section>

      <section>
        <h2>3. How We Use Your Information</h2>
        <ul>
          <li>Process and fulfil your orders</li>
          <li>Send order confirmation and status updates</li>
          <li>Provide customer support</li>
          <li>Improve our Service and user experience</li>
          <li>Detect and prevent fraudulent activity</li>
          <li>Comply with legal obligations</li>
        </ul>
      </section>

      <section>
        <h2>4. Data Security</h2>
        <div class="highlight">
          <div class="highlight-icon">🔐</div>
          <h3>Enterprise-Grade Protection</h3>
          <ul>
            <li><strong>Cloudflare Infrastructure:</strong> DDoS protection, WAF, and SSL/TLS encryption</li>
            <li><strong>Encryption at Rest:</strong> All stored data encrypted using AES-256</li>
            <li><strong>Encryption in Transit:</strong> All data transfers use TLS 1.3</li>
            <li><strong>Access Controls:</strong> Strict role-based access to sensitive data</li>
          </ul>
        </div>
      </section>

      <section>
        <h2>5. Data Sharing</h2>
        <p>We do not sell your personal information. We may share data only in these circumstances:</p>
        <ul>
          <li><strong>With Your Consent:</strong> When you explicitly authorize sharing</li>
          <li><strong>Service Providers:</strong> Trusted partners who help operate our Service</li>
          <li><strong>Legal Requirements:</strong> When required by law</li>
          <li><strong>Business Transfers:</strong> In connection with a merger or acquisition</li>
        </ul>
      </section>

      <section>
        <h2>6. Your Rights</h2>
        <div class="grid-2">
          <div class="card">
            <div class="card-title">GDPR Rights (EU/EEA)</div>
            <ul style="padding-left:16px;font-size:13px">
              <li>Right to access your data</li>
              <li>Right to rectification</li>
              <li>Right to erasure</li>
              <li>Right to restrict processing</li>
              <li>Right to data portability</li>
              <li>Right to object</li>
            </ul>
          </div>
          <div class="card">
            <div class="card-title">DPDP &amp; CCPA Rights</div>
            <ul style="padding-left:16px;font-size:13px">
              <li>Right to know what data is collected</li>
              <li>Right to delete personal information</li>
              <li>Right to opt-out of data sales</li>
              <li>Right to non-discrimination</li>
              <li>Right to data portability (India)</li>
            </ul>
          </div>
        </div>
        <p>To exercise any of these rights, contact us at <a href="mailto:${contactEmail}">${contactEmail}</a>.</p>
      </section>

      <section>
        <h2>7. Voice &amp; Multilingual Services</h2>
        <p>Our platform supports voice ordering in multiple languages. Voice interactions are
        processed only for the duration of your order. We do not store voice recordings beyond
        immediate transaction needs. Transcripts may be retained for quality assurance with
        personally identifiable information anonymized.</p>
      </section>

      <section>
        <h2>8. Cookies</h2>
        <p>We use cookies to enhance your experience. See our <a href="${baseUrl}/ui/cookies">Cookie Policy</a> for details.</p>
      </section>

      <section>
        <h2>9. Contact Us</h2>
        <div class="card">
          <div class="card-title">${tenantName}</div>
          <p style="margin-top:8px">Email: <a href="mailto:${contactEmail}">${contactEmail}</a></p>
          <p>Platform: Powered by HandsFree.tech</p>
        </div>
      </section>
    `,
  });
}

// ─── Terms & Conditions ───────────────────────────────────────────────────────

export function generateTermsHTML(theme: any, tenantName: string, tenantId: string, contactEmail: string, baseUrl: string): string {
  return wrapPage({
    title: 'Terms & Conditions',
    theme,
    tenantName,
    tenantId,
    baseUrl,
    headerContent: `
      <h1 class="page-title">Terms &amp; Conditions</h1>
      <p class="page-subtitle">Last updated: November 2024</p>`,
    bodyContent: `
      <section>
        <h2>1. Introduction</h2>
        <p>Welcome to ${tenantName} ("Service"). By accessing or using our ordering platform,
        powered by Stonepot (OPC) Pvt. Ltd., you agree to be bound by these Terms &amp; Conditions.
        If you do not agree to these Terms, please do not use our Service.</p>
      </section>

      <section>
        <h2>2. Description of Service</h2>
        <p>${tenantName} provides an AI-powered voice and digital ordering platform. Our Service includes:</p>
        <ul>
          <li>AI voice ordering in multiple languages</li>
          <li>Digital menu browsing and ordering</li>
          <li>Order processing and status tracking</li>
          <li>Table and delivery order management</li>
        </ul>
      </section>

      <section>
        <h2>3. User Responsibilities</h2>
        <p>When using our Service, you agree to:</p>
        <ul>
          <li>Provide accurate order and contact information</li>
          <li>Use the Service only for lawful purposes</li>
          <li>Not attempt to disrupt or interfere with the Service</li>
          <li>Honour all orders you place through the platform</li>
        </ul>
      </section>

      <section>
        <h2>4. Orders &amp; Payments</h2>
        <p>By placing an order you agree to pay all applicable charges and provide valid payment
        information. Prices are inclusive of applicable taxes unless stated otherwise and may
        change without prior notice.</p>
      </section>

      <section>
        <h2>5. Cancellation &amp; Refund Policy</h2>
        <div class="card">
          <h3 style="margin-top:0">Cancellations</h3>
          <p>Orders may be cancelled within a short window after placement, before preparation begins.
          Once an order is being prepared, cancellation may not be possible. Contact restaurant staff directly.</p>
          <h3>Refunds</h3>
          <p>Refund requests are evaluated case-by-case. You may be eligible if:</p>
          <ul>
            <li>Your order was not fulfilled due to restaurant unavailability</li>
            <li>Items received materially differ from what was ordered</li>
            <li>A technical issue caused a duplicate charge</li>
          </ul>
          <p style="margin-top:10px">To request a refund, contact <a href="mailto:${contactEmail}">${contactEmail}</a> with your order details.</p>
        </div>
      </section>

      <section>
        <h2>6. Intellectual Property</h2>
        <p>All platform software, features, and functionality are owned by Stonepot (OPC) Pvt. Ltd.
        and are protected by applicable intellectual property laws.</p>
        <p>Restaurant branding, menu content, and images remain the property of ${tenantName}.</p>
      </section>

      <section>
        <h2>7. Prohibited Uses</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any illegal or unauthorized purpose</li>
          <li>Attempt unauthorized access to any part of the Service</li>
          <li>Interfere with or disrupt the Service or its servers</li>
          <li>Place fraudulent or abusive orders</li>
          <li>Use automated tools to scrape or misuse the Service</li>
        </ul>
      </section>

      <section>
        <h2>8. Limitation of Liability</h2>
        <ul>
          <li>The Service is provided "as is" without warranties of any kind</li>
          <li>We are not responsible for the quality or safety of food items</li>
          <li>Our total liability shall not exceed the amount paid for the specific order in dispute</li>
          <li>We shall not be liable for indirect, incidental, or consequential damages</li>
        </ul>
      </section>

      <section>
        <h2>9. Governing Law</h2>
        <p>These Terms are governed by the laws of India. Disputes shall be resolved through
        good faith negotiations, then mediation, and finally binding arbitration under the
        Indian Arbitration and Conciliation Act, 1996.</p>
      </section>

      <section>
        <h2>10. Contact Us</h2>
        <div class="card">
          <div class="card-title">${tenantName}</div>
          <p style="margin-top:8px">Email: <a href="mailto:${contactEmail}">${contactEmail}</a></p>
          <p>Platform: Powered by HandsFree.tech</p>
        </div>
      </section>
    `,
  });
}

// ─── Cookie Policy ────────────────────────────────────────────────────────────

export function generateCookiesHTML(theme: any, tenantName: string, tenantId: string, contactEmail: string, baseUrl: string): string {
  return wrapPage({
    title: 'Cookie Policy',
    theme,
    tenantName,
    tenantId,
    baseUrl,
    headerContent: `
      <h1 class="page-title">Cookie Policy</h1>
      <p class="page-subtitle">Last updated: November 2024</p>`,
    bodyContent: `
      <section>
        <h2>1. What Are Cookies?</h2>
        <p>Cookies are small text files stored on your device when you visit a website. They help
        websites function efficiently, deliver a better user experience, and give operators useful
        insights into how the site is being used.</p>
      </section>

      <section>
        <h2>2. Cookies We Use</h2>

        <div class="card">
          <div style="display:flex;align-items:flex-start;gap:14px">
            <span style="font-size:1.5rem">🛡️</span>
            <div>
              <div class="card-title">Essential Cookies</div>
              <div class="badge">Always Active</div>
              <p style="font-size:13px">Necessary for the website to function. Includes session management,
              security (CSRF protection), load balancing, and consent storage. Cannot be disabled.</p>
            </div>
          </div>
        </div>

        <div class="card">
          <div style="display:flex;align-items:flex-start;gap:14px">
            <span style="font-size:1.5rem">⚙️</span>
            <div>
              <div class="card-title">Functional Cookies</div>
              <div class="badge" style="background:rgba(232,185,35,0.12);color:#E8B923">Optional</div>
              <p style="font-size:13px">Enable enhanced features and personalization: language preferences,
              theme settings, cart persistence, and UI customizations.</p>
            </div>
          </div>
        </div>

        <div class="card">
          <div style="display:flex;align-items:flex-start;gap:14px">
            <span style="font-size:1.5rem">📊</span>
            <div>
              <div class="card-title">Analytics Cookies</div>
              <div class="badge" style="background:rgba(217,69,62,0.12);color:#D9453E">Optional</div>
              <p style="font-size:13px">Help us understand how visitors interact with the site:
              page views, traffic sources, popular menu items, and order funnel analysis.</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2>3. Cloudflare Cookies</h2>
        <p>Our platform uses Cloudflare for security and performance. Cloudflare may set:</p>
        <div class="card" style="padding:0;overflow:hidden">
          <table>
            <thead><tr><th>Cookie</th><th>Purpose</th><th>Duration</th></tr></thead>
            <tbody>
              <tr><td class="mono">__cflb</td><td>Load balancing</td><td>Session</td></tr>
              <tr><td class="mono">__cf_bm</td><td>Bot management</td><td>30 minutes</td></tr>
              <tr><td class="mono">cf_clearance</td><td>Security challenge</td><td>1 year</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>4. Managing Cookie Preferences</h2>

        <div class="card">
          <div class="card-title">Cookie Consent Banner</div>
          <p style="font-size:13px">When you first visit, you'll see a cookie consent banner. You can accept all,
          choose essential only, or manage preferences individually.</p>
        </div>

        <div class="card">
          <div class="card-title">Browser Settings</div>
          <p style="font-size:13px;margin-bottom:10px">You can also manage cookies through your browser:</p>
          <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:13px">
            <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener">Chrome</a>
            <a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener">Firefox</a>
            <a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener">Safari</a>
            <a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener">Edge</a>
          </div>
        </div>

        <p style="font-size:13px"><strong style="color:var(--text)">Note:</strong> Blocking certain cookies may affect your experience and limit available features.</p>
      </section>

      <section>
        <h2>5. Updates to This Policy</h2>
        <p>We may update this Cookie Policy periodically. Check this page for the latest version.
        The "Last updated" date at the top reflects the most recent revision.</p>
      </section>

      <section>
        <h2>6. Contact Us</h2>
        <div class="card">
          <div class="card-title">${tenantName}</div>
          <p style="margin-top:8px">Email: <a href="mailto:${contactEmail}">${contactEmail}</a></p>
          <p>Platform: Powered by HandsFree.tech</p>
        </div>
      </section>
    `,
  });
}

// ─── Request handler ──────────────────────────────────────────────────────────

export async function handleLegalPageUI(
  request: Request,
  env: any,
  page: 'privacy' | 'terms' | 'cookies'
): Promise<Response> {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenant') || 'default';
  const baseUrl  = url.origin;

  // Load tenant theme — mirrors handleConversationUI pattern
  let theme: any = null;
  try {
    if (env.THEME_KV) {
      const cacheKey = `theme:${tenantId}`;
      theme = await env.THEME_KV.get(cacheKey, { type: 'json' });
    }
    if (!theme && env.DB) {
      const result = await env.DB.prepare(
        'SELECT theme_json FROM themes WHERE tenant_id = ?'
      ).bind(tenantId).first();
      if (result) theme = JSON.parse(result.theme_json as string);
    }
  } catch (e) {
    console.error('[legal-pages] theme load error:', e);
  }

  // Fallback theme — warm dark palette used across the platform
  if (!theme) {
    theme = {
      colors: {
        primary: '#F28C38',
        secondary: '#1A0F0B',
        background: '#1A0F0B',
        surface: 'rgba(255,255,255,0.05)',
        text: '#FFF8F0',
        textMuted: 'rgba(255,248,240,0.5)',
        border: 'rgba(255,255,255,0.08)',
      },
      typography: { fontFamily: 'system-ui, -apple-system, sans-serif' },
    };
  }

  // Resolve tenant display name and contact
  const tenantName   = theme.name || tenantId;
  const contactEmail = theme.contactEmail || 'hello@handsfree.tech';

  let html: string;
  if (page === 'privacy') {
    html = generatePrivacyHTML(theme, tenantName, tenantId, contactEmail, baseUrl);
  } else if (page === 'terms') {
    html = generateTermsHTML(theme, tenantName, tenantId, contactEmail, baseUrl);
  } else {
    html = generateCookiesHTML(theme, tenantName, tenantId, contactEmail, baseUrl);
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
