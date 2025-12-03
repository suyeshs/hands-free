import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Footer } from '../components/Footer';

export function Terms() {
  return (
    <div className="min-h-screen bg-warm-charcoal text-warm-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-warm-charcoal/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-warm-white transition-colors mb-4">
            <ArrowLeft size={18} />
            <span>Back to Home</span>
          </Link>
          <h1 className="text-4xl font-display font-semibold">Terms & Conditions</h1>
          <p className="text-gray-400 mt-2">Last updated: November 2024</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="prose prose-invert prose-gray max-w-none">

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">1. Introduction</h2>
            <p className="text-gray-400 leading-relaxed">
              Welcome to HandsFree.tech ("Service"), operated by Stonepot (OPC) Pvt. Ltd. ("Company", "we", "us", or "our").
              By accessing or using our AI-powered voice ordering platform, you agree to be bound by these Terms & Conditions
              ("Terms"). If you do not agree to these Terms, please do not use our Service.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">2. Description of Service</h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              HandsFree.tech provides an AI-powered voice ordering system for restaurants and food service businesses. Our Service includes:
            </p>
            <ul className="list-disc list-inside text-gray-400 space-y-2 ml-4">
              <li>AI voice ordering capabilities supporting 40+ languages</li>
              <li>Integration with existing POS systems</li>
              <li>Menu management and order processing tools</li>
              <li>Analytics and business intelligence features</li>
              <li>Customer relationship management tools</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">3. User Accounts & Responsibilities</h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              When you create an account with us, you agree to:
            </p>
            <ul className="list-disc list-inside text-gray-400 space-y-2 ml-4">
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of any unauthorized use</li>
              <li>Use the Service only for lawful business purposes</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">4. Subscription & Payments</h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              Our Service is offered on a subscription basis. By subscribing, you agree to:
            </p>
            <ul className="list-disc list-inside text-gray-400 space-y-2 ml-4">
              <li>Pay all applicable fees based on your selected plan</li>
              <li>Provide valid payment information</li>
              <li>Authorize recurring charges for subscription renewals</li>
            </ul>
            <p className="text-gray-400 leading-relaxed mt-4">
              Prices are subject to change with 30 days advance notice. All fees are exclusive of applicable taxes.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">5. Refund & Cancellation Policy</h2>
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h3 className="text-lg font-display font-medium text-saffron mb-3">Cancellation</h3>
              <p className="text-gray-400 leading-relaxed mb-4">
                You may cancel your subscription at any time through your account settings or by contacting us at hello@handsfree.tech.
                Upon cancellation:
              </p>
              <ul className="list-disc list-inside text-gray-400 space-y-2 ml-4 mb-6">
                <li>Your subscription will remain active until the end of your current billing period</li>
                <li>You will retain access to all features until the subscription expires</li>
                <li>No prorated refunds will be issued for partial billing periods</li>
              </ul>

              <h3 className="text-lg font-display font-medium text-saffron mb-3">Refunds</h3>
              <p className="text-gray-400 leading-relaxed mb-4">
                Refund requests are evaluated on a case-by-case basis. You may be eligible for a refund if:
              </p>
              <ul className="list-disc list-inside text-gray-400 space-y-2 ml-4">
                <li>You request a refund within 14 days of your initial purchase</li>
                <li>The Service was materially unavailable during your subscription period</li>
                <li>Technical issues on our end prevented you from using the Service</li>
              </ul>
              <p className="text-gray-400 leading-relaxed mt-4">
                To request a refund, contact us at hello@handsfree.tech with your account details and reason for the request.
              </p>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">6. Intellectual Property</h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              All content, features, and functionality of the Service, including but not limited to software, text, graphics,
              logos, and trademarks, are owned by Stonepot (OPC) Pvt. Ltd. and are protected by international copyright,
              trademark, and other intellectual property laws.
            </p>
            <p className="text-gray-400 leading-relaxed">
              You retain ownership of your data and content uploaded to the Service. By using the Service, you grant us
              a limited license to process and store your data as necessary to provide the Service.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">7. Prohibited Uses</h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              You agree not to:
            </p>
            <ul className="list-disc list-inside text-gray-400 space-y-2 ml-4">
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Reverse engineer or attempt to extract source code</li>
              <li>Resell or redistribute the Service without authorization</li>
              <li>Use the Service to transmit harmful or malicious content</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">8. Service Availability & Modifications</h2>
            <p className="text-gray-400 leading-relaxed">
              We strive to maintain 99.9% uptime but do not guarantee uninterrupted access to the Service. We reserve the
              right to modify, suspend, or discontinue any aspect of the Service with reasonable notice. We will not be
              liable for any modification, suspension, or discontinuation of the Service.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">9. Limitation of Liability</h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              To the maximum extent permitted by law:
            </p>
            <ul className="list-disc list-inside text-gray-400 space-y-2 ml-4">
              <li>The Service is provided "as is" without warranties of any kind</li>
              <li>We shall not be liable for any indirect, incidental, special, or consequential damages</li>
              <li>Our total liability shall not exceed the amount paid by you in the 12 months prior to the claim</li>
              <li>We are not responsible for third-party integrations or services</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">10. Indemnification</h2>
            <p className="text-gray-400 leading-relaxed">
              You agree to indemnify and hold harmless Stonepot (OPC) Pvt. Ltd. and its officers, directors, employees,
              and agents from any claims, damages, losses, or expenses arising from your use of the Service or violation
              of these Terms.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">11. Termination</h2>
            <p className="text-gray-400 leading-relaxed">
              We may terminate or suspend your account immediately, without prior notice, for conduct that we believe
              violates these Terms or is harmful to other users, us, or third parties. Upon termination, your right to
              use the Service will cease immediately.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">12. Governing Law & Dispute Resolution</h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising
              from these Terms or your use of the Service shall be resolved through:
            </p>
            <ol className="list-decimal list-inside text-gray-400 space-y-2 ml-4">
              <li>Good faith negotiations between the parties</li>
              <li>Mediation, if negotiations fail</li>
              <li>Binding arbitration in accordance with Indian Arbitration and Conciliation Act, 1996</li>
            </ol>
            <p className="text-gray-400 leading-relaxed mt-4">
              The seat of arbitration shall be in India.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">13. Changes to Terms</h2>
            <p className="text-gray-400 leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify you of any material changes by
              posting the new Terms on this page and updating the "Last updated" date. Your continued use of the Service
              after such changes constitutes your acceptance of the new Terms.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-medium text-warm-white mb-4">14. Contact Us</h2>
            <p className="text-gray-400 leading-relaxed">
              If you have any questions about these Terms, please contact us:
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
