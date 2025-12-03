import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Globe, Server } from 'lucide-react';
import { Footer } from '../components/Footer';

export function Privacy() {
  return (
    <div className="min-h-screen bg-warm-charcoal text-warm-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-warm-charcoal/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-warm-white transition-colors mb-4">
            <ArrowLeft size={18} />
            <span>Back to Home</span>
          </Link>
          <h1 className="text-4xl font-display font-semibold">Privacy Policy</h1>
          <p className="text-gray-400 mt-2">Last updated: November 2024</p>
        </div>
      </div>

      {/* Security Highlights */}
      <div className="border-b border-white/5 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
              <Shield className="text-saffron" size={24} />
              <div>
                <p className="text-sm font-medium text-warm-white">Cloudflare Protected</p>
                <p className="text-xs text-gray-500">Enterprise-grade security</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
              <Lock className="text-saffron" size={24} />
              <div>
                <p className="text-sm font-medium text-warm-white">End-to-End Encryption</p>
                <p className="text-xs text-gray-500">Data encrypted in transit & at rest</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
              <Globe className="text-saffron" size={24} />
              <div>
                <p className="text-sm font-medium text-warm-white">GDPR & CCPA Compliant</p>
                <p className="text-xs text-gray-500">Your rights protected globally</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="prose prose-invert prose-gray max-w-none">

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">1. Introduction</h2>
            <p className="text-gray-400 leading-relaxed">
              At HandsFree.tech, operated by Stonepot (OPC) Pvt. Ltd. ("Company", "we", "us", or "our"), we take your
              privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information
              when you use our AI-powered voice ordering platform ("Service").
            </p>
            <p className="text-gray-400 leading-relaxed mt-4">
              We are committed to protecting your privacy and ensuring the security of your data. Our infrastructure
              is powered by Cloudflare, providing enterprise-grade security and protection.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">2. Information We Collect</h2>

            <h3 className="text-lg font-display font-medium text-saffron mb-3">2.1 Information You Provide</h3>
            <ul className="list-disc list-inside text-gray-400 space-y-2 ml-4 mb-6">
              <li><strong>Account Information:</strong> Name, email address, business name, and contact details</li>
              <li><strong>Business Data:</strong> Menu items, pricing, and restaurant configuration</li>
              <li><strong>Payment Information:</strong> Processed securely through our payment providers</li>
              <li><strong>Communications:</strong> Support requests and feedback you send us</li>
            </ul>

            <h3 className="text-lg font-display font-medium text-saffron mb-3">2.2 Automatically Collected Information</h3>
            <ul className="list-disc list-inside text-gray-400 space-y-2 ml-4">
              <li><strong>Usage Data:</strong> How you interact with the Service</li>
              <li><strong>Device Information:</strong> Browser type, operating system, and device identifiers</li>
              <li><strong>Log Data:</strong> IP address, access times, and pages viewed</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">3. How We Use Your Information</h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-gray-400 space-y-2 ml-4">
              <li>Provide, maintain, and improve our Service</li>
              <li>Process orders and transactions</li>
              <li>Send you technical notices and support messages</li>
              <li>Respond to your comments, questions, and requests</li>
              <li>Analyze usage patterns to enhance user experience</li>
              <li>Detect, investigate, and prevent fraudulent or unauthorized activity</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">4. Data Security</h2>
            <div className="bg-gradient-to-br from-saffron/10 to-transparent rounded-xl p-6 border border-saffron/20">
              <div className="flex items-start gap-4">
                <Server className="text-saffron mt-1" size={24} />
                <div>
                  <h3 className="text-lg font-display font-medium text-warm-white mb-2">Enterprise-Grade Protection</h3>
                  <p className="text-gray-400 leading-relaxed mb-4">
                    Your data is protected by industry-leading security measures:
                  </p>
                  <ul className="list-disc list-inside text-gray-400 space-y-2 ml-4">
                    <li><strong>Cloudflare Infrastructure:</strong> DDoS protection, WAF, and SSL/TLS encryption</li>
                    <li><strong>Encryption at Rest:</strong> All stored data is encrypted using AES-256</li>
                    <li><strong>Encryption in Transit:</strong> All data transfers use TLS 1.3</li>
                    <li><strong>Access Controls:</strong> Strict role-based access to sensitive data</li>
                    <li><strong>Regular Audits:</strong> Continuous security monitoring and assessments</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">5. Data Sharing</h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              We do not sell your personal information. We may share your information only in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-gray-400 space-y-2 ml-4">
              <li><strong>With Your Consent:</strong> When you explicitly authorize us to share</li>
              <li><strong>Service Providers:</strong> With trusted partners who assist in operating our Service</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">6. Data Retention</h2>
            <p className="text-gray-400 leading-relaxed">
              We retain your personal information only for as long as necessary to fulfill the purposes outlined in this
              Privacy Policy, unless a longer retention period is required by law. When you delete your account, we will
              delete or anonymize your personal information within 30 days, except where we are required to retain certain
              information for legal or compliance purposes.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">7. Your Rights</h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              Depending on your location, you may have the following rights regarding your personal data:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h4 className="font-medium text-warm-white mb-2">GDPR Rights (EU/EEA)</h4>
                <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                  <li>Right to access your data</li>
                  <li>Right to rectification</li>
                  <li>Right to erasure ("right to be forgotten")</li>
                  <li>Right to restrict processing</li>
                  <li>Right to data portability</li>
                  <li>Right to object</li>
                </ul>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h4 className="font-medium text-warm-white mb-2">CCPA Rights (California)</h4>
                <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                  <li>Right to know what data is collected</li>
                  <li>Right to delete personal information</li>
                  <li>Right to opt-out of data sales</li>
                  <li>Right to non-discrimination</li>
                </ul>
              </div>
            </div>

            <p className="text-gray-400 leading-relaxed mt-4">
              To exercise any of these rights, please contact us at hello@handsfree.tech.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">8. Multilingual Services</h2>
            <p className="text-gray-400 leading-relaxed">
              Our Service supports over 40 languages to serve diverse customer bases. Voice interactions may be processed
              to provide accurate ordering services. We do not store voice recordings beyond the immediate transaction
              processing needs. Transcripts may be retained for quality assurance and service improvement, with all
              personally identifiable information anonymized.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">9. Cookies</h2>
            <p className="text-gray-400 leading-relaxed">
              We use cookies and similar tracking technologies to enhance your experience. For detailed information
              about the cookies we use and your choices, please see our{' '}
              <Link to="/cookies" className="text-saffron hover:underline">Cookie Policy</Link>.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">10. Children's Privacy</h2>
            <p className="text-gray-400 leading-relaxed">
              Our Service is not intended for individuals under the age of 18. We do not knowingly collect personal
              information from children. If you believe we have collected information from a child, please contact us
              immediately.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">11. International Data Transfers</h2>
            <p className="text-gray-400 leading-relaxed">
              Your information may be transferred to and processed in countries other than your own. We ensure that
              any such transfers comply with applicable data protection laws and that your information remains protected
              to the standards described in this policy.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">12. Changes to This Policy</h2>
            <p className="text-gray-400 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting
              the new Privacy Policy on this page and updating the "Last updated" date. We encourage you to review this
              Privacy Policy periodically.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">13. Contact Us</h2>
            <p className="text-gray-400 leading-relaxed">
              If you have any questions about this Privacy Policy or our data practices, please contact us:
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
