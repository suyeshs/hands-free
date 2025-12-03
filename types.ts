// Menu Item Types - aligned with Stonepot Restaurant Client
export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  type: 'veg' | 'non-veg';
  imageUrl?: string;
  rating?: number;
  spiceLevel?: number; // 1-5
  tag?: 'bestseller' | 'new' | 'spicy';
  dietary?: string[];
  // For combos
  choices?: string[]; // Curry options
  sideOptions?: string[]; // Side options (Puttu, Rice, etc.)
  available?: boolean;
}

// Cart Item - extends MenuItem with quantity and selections
export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  type: 'veg' | 'non-veg';
  imageUrl?: string;
  // For combos
  selectedCurry?: string;
  selectedSide?: string;
}

// Legacy Dish type - keeping for backward compatibility
export interface Dish extends MenuItem {}

// App Screen States
export type AppScreen = 'home' | 'details' | 'cart' | 'checkout' | 'success';

// App State
export interface AppState {
  currentScreen: AppScreen;
  selectedDish: MenuItem | null;
  cart: CartItem[];
  activeCategory: string;
  isListening: boolean;
  isSpeaking: boolean;
  transcripts: {
    user: string;
    model: string;
  };
}

// Audio Visualizer Data
export interface AudioVisualizerData {
  dataArray: Uint8Array;
}

// Menu Categories
export const CATEGORIES = ['All', 'Combos', 'Appetizers', 'Curries', 'Desserts', 'Coolers'] as const;
export type Category = typeof CATEGORIES[number];
