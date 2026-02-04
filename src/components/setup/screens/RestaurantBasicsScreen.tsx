/**
 * RestaurantBasicsScreen Component
 * Collect essential restaurant information (REQUIRED)
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Store, MapPin, Phone, Mail, Globe, Sparkles } from 'lucide-react';
import { useSetupWizardStore } from '../../../stores/setupWizardStore';
import { getDemoTemplate, RestaurantType, DEMO_TEMPLATES } from '../../../lib/demoData';
import { lookupCityInfo } from '../../../lib/cityStateMapping';

export function RestaurantBasicsScreen() {
  const { wizardData, updateWizardData } = useSetupWizardStore();

  const [formData, setFormData] = useState({
    name: wizardData.restaurantInfo?.name || '',
    tagline: wizardData.restaurantInfo?.tagline || '',
    addressLine1: wizardData.restaurantInfo?.address?.line1 || '',
    addressLine2: wizardData.restaurantInfo?.address?.line2 || '',
    city: wizardData.restaurantInfo?.address?.city || '',
    state: wizardData.restaurantInfo?.address?.state || '',
    pincode: wizardData.restaurantInfo?.address?.pincode || '',
    phone: wizardData.restaurantInfo?.phone || '',
    email: wizardData.restaurantInfo?.email || '',
    website: wizardData.restaurantInfo?.website || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [useDemoData, setUseDemoData] = useState(false);
  const [selectedDemoType, setSelectedDemoType] = useState<RestaurantType>('indian');

  // Validate and update store on change
  useEffect(() => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Restaurant name is required';
    if (!formData.addressLine1.trim()) newErrors.addressLine1 = 'Address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) newErrors.state = 'State is required';
    if (!formData.pincode.trim()) {
      newErrors.pincode = 'Pincode is required';
    } else if (!/^\d{6}$/.test(formData.pincode)) {
      newErrors.pincode = 'Pincode must be 6 digits';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(formData.phone.replace(/[^\d]/g, ''))) {
      newErrors.phone = 'Phone must be 10 digits';
    }

    setErrors(newErrors);

    // Update wizard store if valid
    if (Object.keys(newErrors).length === 0) {
      updateWizardData({
        restaurantInfo: {
          name: formData.name,
          tagline: formData.tagline || undefined,
          address: {
            line1: formData.addressLine1,
            line2: formData.addressLine2 || undefined,
            city: formData.city,
            state: formData.state,
            pincode: formData.pincode,
          },
          phone: formData.phone,
          email: formData.email || undefined,
          website: formData.website || undefined,
        },
      });
    }
  }, [formData, updateWizardData]);

  const handleChange = (field: string, value: string) => {
    // Auto-fill state and country when city changes
    if (field === 'city') {
      const cityInfo = lookupCityInfo(value);
      if (cityInfo) {
        setFormData(prev => ({ ...prev, city: value, state: cityInfo.state }));
      } else {
        setFormData(prev => ({ ...prev, [field]: value }));
      }
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  // Handle demo data toggle
  const handleDemoDataToggle = (checked: boolean) => {
    setUseDemoData(checked);
    if (checked) {
      loadDemoData(selectedDemoType);
    }
  };

  // Handle demo type change
  const handleDemoTypeChange = (type: RestaurantType) => {
    setSelectedDemoType(type);
    if (useDemoData) {
      loadDemoData(type);
    }
  };

  // Load demo data into form
  const loadDemoData = (type: RestaurantType) => {
    const template = getDemoTemplate(type);
    setFormData({
      name: template.restaurantInfo.name,
      tagline: template.restaurantInfo.tagline,
      addressLine1: '123 Main Street',
      addressLine2: 'Downtown',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      phone: '9876543210',
      email: 'contact@restaurant.com',
      website: 'https://restaurant.com',
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <motion.div
        className="text-center mb-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-paprika/20 to-saffron/10 flex items-center justify-center">
          <Store className="w-8 h-8 text-saffron" />
        </div>
        <h2 className="text-3xl font-black uppercase tracking-wider mb-3">Restaurant Details</h2>
        <p className="text-muted-foreground">Tell us about your restaurant</p>
      </motion.div>

      {/* Demo Data Section */}
      <motion.div
        className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-saffron/10 to-paprika/5 border-2 border-saffron/20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-start gap-4">
          <input
            type="checkbox"
            id="useDemoData"
            checked={useDemoData}
            onChange={(e) => handleDemoDataToggle(e.target.checked)}
            className="mt-1 w-5 h-5 rounded border-2 border-saffron text-saffron focus:ring-2 focus:ring-saffron/20"
          />
          <div className="flex-1">
            <label htmlFor="useDemoData" className="flex items-center gap-2 font-bold text-foreground cursor-pointer">
              <Sparkles className="w-5 h-5 text-saffron" />
              Use Demo Data
            </label>
            <p className="text-sm text-muted-foreground mt-1">
              Automatically fill this form with sample data. You can edit it later.
            </p>

            {useDemoData && (
              <motion.div
                className="mt-4"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="block text-sm font-bold mb-2 text-foreground">
                  Restaurant Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(DEMO_TEMPLATES).map(([key, template]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleDemoTypeChange(key as RestaurantType)}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        selectedDemoType === key
                          ? 'border-saffron bg-saffron/10 text-foreground'
                          : 'border-border bg-card text-muted-foreground hover:border-saffron/50'
                      }`}
                    >
                      <div className="text-2xl mb-1">{template.icon}</div>
                      <div className="text-xs font-bold">{template.label}</div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Form */}
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {/* Restaurant Name */}
        <div>
          <label className="block text-sm font-bold mb-2 text-foreground">
            Restaurant Name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g., The Golden Spoon"
            className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none"
          />
          {errors.name && <p className="text-destructive text-sm mt-1">{errors.name}</p>}
        </div>

        {/* Tagline */}
        <div>
          <label className="block text-sm font-bold mb-2 text-foreground">
            Tagline <span className="text-muted-foreground text-xs">(Optional)</span>
          </label>
          <input
            type="text"
            value={formData.tagline}
            onChange={(e) => handleChange('tagline', e.target.value)}
            placeholder="e.g., Authentic Indian Cuisine"
            className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none"
          />
        </div>

        {/* Address Section */}
        <div className="pt-4">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-saffron" />
            <h3 className="font-bold text-foreground">Address</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2 text-foreground">
                Address Line 1 <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.addressLine1}
                onChange={(e) => handleChange('addressLine1', e.target.value)}
                placeholder="Street address, building name"
                className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none"
              />
              {errors.addressLine1 && <p className="text-destructive text-sm mt-1">{errors.addressLine1}</p>}
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-foreground">
                Address Line 2 <span className="text-muted-foreground text-xs">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.addressLine2}
                onChange={(e) => handleChange('addressLine2', e.target.value)}
                placeholder="Landmark, area"
                className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2 text-foreground">
                  City <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="City"
                  className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none"
                />
                {errors.city && <p className="text-destructive text-sm mt-1">{errors.city}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-foreground">
                  State <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  placeholder="State"
                  className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none"
                />
                {errors.state && <p className="text-destructive text-sm mt-1">{errors.state}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-foreground">
                Pincode <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.pincode}
                onChange={(e) => handleChange('pincode', e.target.value)}
                placeholder="6-digit pincode"
                maxLength={6}
                className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none"
              />
              {errors.pincode && <p className="text-destructive text-sm mt-1">{errors.pincode}</p>}
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div className="pt-4">
          <div className="flex items-center gap-2 mb-4">
            <Phone className="w-5 h-5 text-saffron" />
            <h3 className="font-bold text-foreground">Contact Information</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2 text-foreground">
                Phone Number <span className="text-destructive">*</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="10-digit mobile number"
                maxLength={10}
                className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none"
              />
              {errors.phone && <p className="text-destructive text-sm mt-1">{errors.phone}</p>}
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-foreground">
                Email <span className="text-muted-foreground text-xs">(Optional)</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="contact@restaurant.com"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-foreground">
                Website <span className="text-muted-foreground text-xs">(Optional)</span>
              </label>
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleChange('website', e.target.value)}
                  placeholder="https://restaurant.com"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
