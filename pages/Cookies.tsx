import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Cookie, Settings, BarChart3, Shield } from 'lucide-react';
import { Footer } from '../components/Footer';

export function Cookies() {
  return (
    <div className="min-h-screen bg-warm-charcoal text-warm-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-warm-charcoal/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-warm-white transition-colors mb-4">
            <ArrowLeft size={18} />
            <span>Back to Home</span>
          </Link>
          <h1 className="text-4xl font-display font-semibold">Cookie Policy</h1>
          <p className="text-gray-400 mt-2">Last updated: November 2024</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="prose prose-invert prose-gray max-w-none">

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">1. What Are Cookies?</h2>
            <p className="text-gray-400 leading-relaxed">
              Cookies are small text files that are stored on your device (computer, tablet, or mobile) when you visit
              a website. They are widely used to make websites work more efficiently, provide a better user experience,
              and give website owners useful information about how their site is being used.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">2. How We Use Cookies</h2>
            <p className="text-gray-400 leading-relaxed mb-6">
              HandsFree.tech uses cookies for various purposes. Here's a breakdown of the types of cookies we use:
            </p>

            {/* Cookie Types */}
            <div className="space-y-4">
              {/* Essential Cookies */}
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-saffron/20 flex items-center justify-center flex-shrink-0">
                    <Shield className="text-saffron" size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-medium text-warm-white mb-2">Essential Cookies</h3>
                    <p className="text-sm text-gray-500 mb-3">Always Active</p>
                    <p className="text-gray-400 text-sm leading-relaxed mb-3">
                      These cookies are necessary for the website to function properly. They enable core functionality
                      such as security, network management, and accessibility. You cannot opt out of these cookies.
                    </p>
                    <div className="bg-black/20 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-2">Examples:</p>
                      <ul className="text-xs text-gray-400 space-y-1">
                        <li>• Session management cookies</li>
                        <li>• Security cookies (CSRF protection)</li>
                        <li>• Load balancing cookies</li>
                        <li>• Cookie consent preferences</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Functional Cookies */}
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-honey/20 flex items-center justify-center flex-shrink-0">
                    <Settings className="text-honey" size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-medium text-warm-white mb-2">Functional Cookies</h3>
                    <p className="text-sm text-gray-500 mb-3">Optional</p>
                    <p className="text-gray-400 text-sm leading-relaxed mb-3">
                      These cookies enable enhanced functionality and personalization. They may be set by us or by
                      third-party providers whose services we use on our pages.
                    </p>
                    <div className="bg-black/20 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-2">Examples:</p>
                      <ul className="text-xs text-gray-400 space-y-1">
                        <li>• Language preferences</li>
                        <li>• Theme settings (dark/light mode)</li>
                        <li>• Previously entered form data</li>
                        <li>• User interface customizations</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Analytics Cookies */}
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-paprika/20 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="text-paprika" size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-medium text-warm-white mb-2">Analytics Cookies</h3>
                    <p className="text-sm text-gray-500 mb-3">Optional</p>
                    <p className="text-gray-400 text-sm leading-relaxed mb-3">
                      These cookies help us understand how visitors interact with our website. They help us measure
                      and improve the performance of our site.
                    </p>
                    <div className="bg-black/20 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-2">Examples:</p>
                      <ul className="text-xs text-gray-400 space-y-1">
                        <li>• Page view statistics</li>
                        <li>• Traffic source tracking</li>
                        <li>• User journey analysis</li>
                        <li>• Feature usage metrics</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">3. Cloudflare Cookies</h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              Our website uses Cloudflare for security and performance optimization. Cloudflare may set the following
              cookies:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-warm-white font-medium">Cookie Name</th>
                    <th className="text-left py-3 px-4 text-warm-white font-medium">Purpose</th>
                    <th className="text-left py-3 px-4 text-warm-white font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody className="text-gray-400">
                  <tr className="border-b border-white/5">
                    <td className="py-3 px-4 font-mono text-xs">__cflb</td>
                    <td className="py-3 px-4">Load balancing</td>
                    <td className="py-3 px-4">Session</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-3 px-4 font-mono text-xs">__cf_bm</td>
                    <td className="py-3 px-4">Bot management</td>
                    <td className="py-3 px-4">30 minutes</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-3 px-4 font-mono text-xs">cf_clearance</td>
                    <td className="py-3 px-4">Security challenge</td>
                    <td className="py-3 px-4">1 year</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">4. Managing Your Cookie Preferences</h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              You have several options for managing cookies:
            </p>

            <div className="space-y-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h4 className="font-medium text-warm-white mb-2">Cookie Consent Banner</h4>
                <p className="text-gray-400 text-sm">
                  When you first visit our website, you'll see a cookie consent banner. You can choose to accept all
                  cookies or manage your preferences for optional cookies.
                </p>
              </div>

              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h4 className="font-medium text-warm-white mb-2">Browser Settings</h4>
                <p className="text-gray-400 text-sm mb-3">
                  Most web browsers allow you to control cookies through their settings. You can:
                </p>
                <ul className="list-disc list-inside text-gray-400 text-sm space-y-1 ml-2">
                  <li>Block all cookies</li>
                  <li>Block third-party cookies only</li>
                  <li>Clear cookies when you close your browser</li>
                  <li>Receive a notification when a cookie is set</li>
                </ul>
              </div>

              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h4 className="font-medium text-warm-white mb-2">Browser-Specific Instructions</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                  <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-saffron text-sm hover:underline">Chrome</a>
                  <a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer" className="text-saffron text-sm hover:underline">Firefox</a>
                  <a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-saffron text-sm hover:underline">Safari</a>
                  <a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-saffron text-sm hover:underline">Edge</a>
                </div>
              </div>
            </div>

            <p className="text-gray-400 leading-relaxed mt-4">
              <strong className="text-warm-white">Note:</strong> Blocking certain cookies may impact your experience on
              our website and limit the services we can offer you.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">5. Do Not Track Signals</h2>
            <p className="text-gray-400 leading-relaxed">
              Some browsers have a "Do Not Track" feature that signals to websites that you do not want your online
              activity tracked. Our website currently does not respond to Do Not Track signals, but you can manage
              your cookie preferences using the methods described above.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">6. Updates to This Policy</h2>
            <p className="text-gray-400 leading-relaxed">
              We may update this Cookie Policy from time to time to reflect changes in our practices or for other
              operational, legal, or regulatory reasons. Please check this page periodically for updates. The "Last
              updated" date at the top of this policy indicates when it was last revised.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">7. Contact Us</h2>
            <p className="text-gray-400 leading-relaxed">
              If you have any questions about our use of cookies, please contact us:
            </p>
            <div className="mt-4 bg-white/5 rounded-xl p-6 border border-white/10">
              <p className="text-warm-white font-medium">Stonepot (OPC) Pvt. Ltd.</p>
              <p className="text-gray-400 mt-2">Email: hello@handsfree.tech</p>
              <p className="text-gray-400">Website: handsfree.tech</p>
            </div>
          </section>

        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
