import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, MessageSquare, Clock, Globe, Shield, Send, CheckCircle } from 'lucide-react';
import { Footer } from '../components/Footer';

export function Contact() {
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
    type: 'general'
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, this would send to your backend
    console.log('Form submitted:', formState);
    setIsSubmitted(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormState(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-warm-charcoal text-warm-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-warm-charcoal/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-warm-white transition-colors mb-4">
            <ArrowLeft size={18} />
            <span>Back to Home</span>
          </Link>
          <h1 className="text-4xl font-display font-semibold">Contact Us</h1>
          <p className="text-gray-400 mt-2">We'd love to hear from you. Get in touch with our team.</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

          {/* Contact Information */}
          <div>
            <h2 className="text-2xl font-display font-medium text-warm-white mb-6">Get in Touch</h2>
            <p className="text-gray-400 leading-relaxed mb-8">
              Whether you have questions about our AI voice ordering system, need technical support, or want to
              schedule a demo, we're here to help.
            </p>

            {/* Contact Methods */}
            <div className="space-y-6 mb-12">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-saffron/20 flex items-center justify-center flex-shrink-0">
                  <Mail className="text-saffron" size={22} />
                </div>
                <div>
                  <h3 className="font-medium text-warm-white mb-1">Email Us</h3>
                  <a href="mailto:hello@handsfree.tech" className="text-saffron hover:underline">
                    hello@handsfree.tech
                  </a>
                  <p className="text-sm text-gray-500 mt-1">For general inquiries and support</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-honey/20 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="text-honey" size={22} />
                </div>
                <div>
                  <h3 className="font-medium text-warm-white mb-1">Schedule a Demo</h3>
                  <p className="text-gray-400">See HandsFree.tech in action with a personalized demo</p>
                  <p className="text-sm text-gray-500 mt-1">15-minute call • No commitment</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-paprika/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="text-paprika" size={22} />
                </div>
                <div>
                  <h3 className="font-medium text-warm-white mb-1">Response Time</h3>
                  <p className="text-gray-400">We typically respond within 24 hours</p>
                  <p className="text-sm text-gray-500 mt-1">Business days • All time zones</p>
                </div>
              </div>
            </div>

            {/* Features Highlight */}
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h3 className="font-display font-medium text-warm-white mb-4">Why Restaurant Owners Choose Us</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <Globe className="text-saffron" size={16} />
                  <span>40+ languages for diverse customer bases</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <Shield className="text-saffron" size={16} />
                  <span>Cloudflare-secured infrastructure</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <Clock className="text-saffron" size={16} />
                  <span>24/7 AI availability - never miss an order</span>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div>
            <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
              {isSubmitted ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="text-green-500" size={32} />
                  </div>
                  <h3 className="text-2xl font-display font-medium text-warm-white mb-3">Message Sent!</h3>
                  <p className="text-gray-400 mb-6">
                    Thank you for reaching out. We'll get back to you within 24 hours.
                  </p>
                  <button
                    onClick={() => {
                      setIsSubmitted(false);
                      setFormState({ name: '', email: '', company: '', message: '', type: 'general' });
                    }}
                    className="text-saffron hover:underline"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-display font-medium text-warm-white mb-6">Send us a Message</h2>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Inquiry Type */}
                    <div>
                      <label htmlFor="type" className="block text-sm font-medium text-gray-400 mb-2">
                        What can we help you with?
                      </label>
                      <select
                        id="type"
                        name="type"
                        value={formState.type}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-warm-white focus:outline-none focus:border-saffron/50 focus:ring-1 focus:ring-saffron/50 transition-colors"
                      >
                        <option value="general">General Inquiry</option>
                        <option value="demo">Schedule a Demo</option>
                        <option value="support">Technical Support</option>
                        <option value="sales">Sales & Pricing</option>
                        <option value="partnership">Partnership Opportunity</option>
                      </select>
                    </div>

                    {/* Name */}
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-2">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        value={formState.name}
                        onChange={handleChange}
                        placeholder="John Smith"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-warm-white placeholder-gray-600 focus:outline-none focus:border-saffron/50 focus:ring-1 focus:ring-saffron/50 transition-colors"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        value={formState.email}
                        onChange={handleChange}
                        placeholder="john@restaurant.com"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-warm-white placeholder-gray-600 focus:outline-none focus:border-saffron/50 focus:ring-1 focus:ring-saffron/50 transition-colors"
                      />
                    </div>

                    {/* Company */}
                    <div>
                      <label htmlFor="company" className="block text-sm font-medium text-gray-400 mb-2">
                        Restaurant/Company Name
                      </label>
                      <input
                        type="text"
                        id="company"
                        name="company"
                        value={formState.company}
                        onChange={handleChange}
                        placeholder="Your Restaurant Name"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-warm-white placeholder-gray-600 focus:outline-none focus:border-saffron/50 focus:ring-1 focus:ring-saffron/50 transition-colors"
                      />
                    </div>

                    {/* Message */}
                    <div>
                      <label htmlFor="message" className="block text-sm font-medium text-gray-400 mb-2">
                        Your Message *
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        required
                        rows={5}
                        value={formState.message}
                        onChange={handleChange}
                        placeholder="Tell us about your restaurant and how we can help..."
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-warm-white placeholder-gray-600 focus:outline-none focus:border-saffron/50 focus:ring-1 focus:ring-saffron/50 transition-colors resize-none"
                      />
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      className="w-full px-6 py-4 bg-gradient-warm text-white rounded-xl font-medium text-lg shadow-warm-glow hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                    >
                      <Send size={18} />
                      Send Message
                    </button>

                    <p className="text-xs text-gray-500 text-center">
                      By submitting this form, you agree to our{' '}
                      <Link to="/privacy" className="text-saffron hover:underline">Privacy Policy</Link>.
                    </p>
                  </form>
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
