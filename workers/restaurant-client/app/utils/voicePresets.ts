/**
 * Voice Assistant Presets
 * User-friendly presets for voice configuration
 * See: stonepot-restaurant/VOICE_PRESETS.md
 */

export interface VoicePreset {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: 'female' | 'male';
  recommendedFor: string[];
  config: {
    voiceName: string;
    tone: {
      style: 'friendly' | 'professional' | 'casual';
      personality: 'helpful' | 'enthusiastic' | 'reserved';
      formality: 'formal' | 'balanced' | 'informal';
    };
    responseLength: 'brief' | 'moderate' | 'detailed';
    temperature: number;
  };
}

export const VOICE_PRESETS: VoicePreset[] = [
  // Female Voices
  {
    id: 'warm-welcoming',
    label: 'Warm & Welcoming',
    description: 'Friendly and approachable - perfect for most restaurants',
    icon: '🤗',
    category: 'female',
    recommendedFor: ['Family Restaurant', 'Casual Dining', 'Breakfast/Brunch'],
    config: {
      voiceName: 'Aoede',
      tone: {
        style: 'friendly',
        personality: 'helpful',
        formality: 'balanced',
      },
      responseLength: 'moderate',
      temperature: 0.7,
    },
  },
  {
    id: 'professional-efficient',
    label: 'Professional & Efficient',
    description: 'Polished and refined - ideal for upscale dining',
    icon: '👔',
    category: 'female',
    recommendedFor: ['Fine Dining', 'Upscale Restaurant', 'Business Lunch'],
    config: {
      voiceName: 'Kore',
      tone: {
        style: 'professional',
        personality: 'helpful',
        formality: 'formal',
      },
      responseLength: 'brief',
      temperature: 0.5,
    },
  },
  {
    id: 'enthusiastic-energetic',
    label: 'Enthusiastic & Energetic',
    description: 'Upbeat and lively - great for casual, fun dining',
    icon: '⚡',
    category: 'female',
    recommendedFor: ['Fast Casual', 'Trendy Cafe', 'Quick Service'],
    config: {
      voiceName: 'Zephyr',
      tone: {
        style: 'casual',
        personality: 'enthusiastic',
        formality: 'informal',
      },
      responseLength: 'brief',
      temperature: 0.8,
    },
  },
  {
    id: 'calm-relaxed',
    label: 'Calm & Relaxed',
    description: 'Gentle and soothing - perfect for peaceful dining',
    icon: '🌸',
    category: 'female',
    recommendedFor: ['Cafe', 'Wellness Restaurant', 'Late Night Dining'],
    config: {
      voiceName: 'Leda',
      tone: {
        style: 'friendly',
        personality: 'reserved',
        formality: 'balanced',
      },
      responseLength: 'moderate',
      temperature: 0.6,
    },
  },

  // Male Voices
  {
    id: 'friendly-casual-male',
    label: 'Friendly & Casual',
    description: 'Approachable male voice - great for casual settings',
    icon: '😎',
    category: 'male',
    recommendedFor: ['Sports Bar', 'Pub', 'Casual Dining'],
    config: {
      voiceName: 'Puck',
      tone: {
        style: 'casual',
        personality: 'helpful',
        formality: 'informal',
      },
      responseLength: 'moderate',
      temperature: 0.7,
    },
  },
  {
    id: 'professional-confident-male',
    label: 'Professional & Confident',
    description: 'Authoritative male voice - ideal for premium dining',
    icon: '🎩',
    category: 'male',
    recommendedFor: ['Steakhouse', 'Premium Dining', 'Executive Dining'],
    config: {
      voiceName: 'Charon',
      tone: {
        style: 'professional',
        personality: 'helpful',
        formality: 'formal',
      },
      responseLength: 'moderate',
      temperature: 0.5,
    },
  },
  {
    id: 'smooth-elegant-male',
    label: 'Smooth & Elegant',
    description: 'Refined male voice - perfect for sophisticated venues',
    icon: '🍷',
    category: 'male',
    recommendedFor: ['Wine Bar', 'Lounge', 'Upscale Cafe'],
    config: {
      voiceName: 'Orus',
      tone: {
        style: 'professional',
        personality: 'helpful',
        formality: 'balanced',
      },
      responseLength: 'detailed',
      temperature: 0.6,
    },
  },
  {
    id: 'energetic-confident-male',
    label: 'Energetic & Confident',
    description: 'Strong male voice - great for active environments',
    icon: '💪',
    category: 'male',
    recommendedFor: ['Sports Venue', 'Fitness Cafe', 'Active Lifestyle'],
    config: {
      voiceName: 'Fenrir',
      tone: {
        style: 'casual',
        personality: 'enthusiastic',
        formality: 'informal',
      },
      responseLength: 'brief',
      temperature: 0.7,
    },
  },
];

export const DEFAULT_PRESET_ID = 'warm-welcoming';

/**
 * Get preset by ID
 */
export function getPresetById(id: string): VoicePreset | undefined {
  return VOICE_PRESETS.find((p) => p.id === id);
}

/**
 * Get presets by category
 */
export function getPresetsByCategory(category: 'female' | 'male'): VoicePreset[] {
  return VOICE_PRESETS.filter((p) => p.category === category);
}

/**
 * Get default preset
 */
export function getDefaultPreset(): VoicePreset {
  return getPresetById(DEFAULT_PRESET_ID) || VOICE_PRESETS[0];
}

/**
 * Available languages with native audio support
 */
export const AVAILABLE_LANGUAGES = [
  // Indian Languages
  { code: 'en', label: 'English', category: 'indian' },
  { code: 'hi', label: 'Hindi (हिन्दी)', category: 'indian' },
  { code: 'bn', label: 'Bengali (বাংলা)', category: 'indian' },
  { code: 'ta', label: 'Tamil (தமிழ்)', category: 'indian' },
  { code: 'te', label: 'Telugu (తెలుగు)', category: 'indian' },
  { code: 'kn', label: 'Kannada (ಕನ್ನಡ)', category: 'indian' },
  { code: 'ml', label: 'Malayalam (മലയാളം)', category: 'indian' },
  { code: 'gu', label: 'Gujarati (ગુજરાતી)', category: 'indian' },
  { code: 'mr', label: 'Marathi (मराठी)', category: 'indian' },

  // Popular International
  { code: 'es', label: 'Spanish (Español)', category: 'international' },
  { code: 'fr', label: 'French (Français)', category: 'international' },
  { code: 'zh', label: 'Chinese (中文)', category: 'international' },
  { code: 'ja', label: 'Japanese (日本語)', category: 'international' },
  { code: 'ko', label: 'Korean (한국어)', category: 'international' },
  { code: 'ar', label: 'Arabic (العربية)', category: 'international' },

  // Other International
  { code: 'de', label: 'German (Deutsch)', category: 'international' },
  { code: 'it', label: 'Italian (Italiano)', category: 'international' },
  { code: 'pt', label: 'Portuguese (Português)', category: 'international' },
  { code: 'th', label: 'Thai (ไทย)', category: 'international' },
  { code: 'vi', label: 'Vietnamese (Tiếng Việt)', category: 'international' },
  { code: 'ru', label: 'Russian (Русский)', category: 'international' },
  { code: 'tr', label: 'Turkish (Türkçe)', category: 'international' },
  { code: 'pl', label: 'Polish (Polski)', category: 'international' },
  { code: 'nl', label: 'Dutch (Nederlands)', category: 'international' },
];

/**
 * Get popular languages (Indian + top international)
 */
export function getPopularLanguages() {
  return AVAILABLE_LANGUAGES.filter(
    (lang) =>
      lang.category === 'indian' ||
      ['es', 'fr', 'zh', 'ja', 'ko', 'ar'].includes(lang.code)
  );
}

/**
 * Get all international languages
 */
export function getInternationalLanguages() {
  return AVAILABLE_LANGUAGES.filter((lang) => lang.category === 'international');
}
