import { Mic, Eye, Car, CreditCard, Package, BarChart3, Globe, Wallet, LucideIcon } from 'lucide-react';

export interface Feature {
  id: string;
  icon: LucideIcon;
  label: string;
  shortLabel: string;
  color: string;
  bgGradient: string;
  borderColor: string;
  textColor: string;
  // Positions are percentages from center (0,0)
  initialPosition: { x: number; y: number };
  finalPosition: { x: number; y: number };
}

// Feature positions arranged in an octagon pattern around center
// Initial positions are scattered, final positions form the ecosystem
export const ecosystemFeatures: Feature[] = [
  {
    id: 'voice',
    icon: Mic,
    label: 'Voice Ordering',
    shortLabel: 'Voice',
    color: 'saffron',
    bgGradient: 'from-saffron/20 to-orange-600/20',
    borderColor: 'border-saffron/40',
    textColor: 'text-saffron',
    initialPosition: { x: -200, y: -150 },
    finalPosition: { x: -120, y: -100 },
  },
  {
    id: 'visual',
    icon: Eye,
    label: 'Visual Menu',
    shortLabel: 'Visual',
    color: 'paprika',
    bgGradient: 'from-paprika/20 to-red-600/20',
    borderColor: 'border-paprika/40',
    textColor: 'text-paprika',
    initialPosition: { x: 180, y: -180 },
    finalPosition: { x: 0, y: -130 },
  },
  {
    id: 'drive-thru',
    icon: Car,
    label: 'Drive-thru Ready',
    shortLabel: 'Drive-thru',
    color: 'emerald',
    bgGradient: 'from-emerald-500/20 to-green-600/20',
    borderColor: 'border-emerald-500/40',
    textColor: 'text-emerald-400',
    initialPosition: { x: 220, y: -50 },
    finalPosition: { x: 120, y: -100 },
  },
  {
    id: 'pos',
    icon: CreditCard,
    label: 'Full POS System',
    shortLabel: 'POS',
    color: 'blue',
    bgGradient: 'from-blue-500/20 to-indigo-600/20',
    borderColor: 'border-blue-500/40',
    textColor: 'text-blue-400',
    initialPosition: { x: -250, y: 80 },
    finalPosition: { x: -140, y: 30 },
  },
  {
    id: 'inventory',
    icon: Package,
    label: 'Inventory Management',
    shortLabel: 'Inventory',
    color: 'purple',
    bgGradient: 'from-purple-500/20 to-violet-600/20',
    borderColor: 'border-purple-500/40',
    textColor: 'text-purple-400',
    initialPosition: { x: 200, y: 120 },
    finalPosition: { x: 140, y: 30 },
  },
  {
    id: 'analytics',
    icon: BarChart3,
    label: 'Real-time Analytics',
    shortLabel: 'Analytics',
    color: 'cyan',
    bgGradient: 'from-cyan-500/20 to-teal-600/20',
    borderColor: 'border-cyan-500/40',
    textColor: 'text-cyan-400',
    initialPosition: { x: 150, y: 200 },
    finalPosition: { x: 120, y: 100 },
  },
  {
    id: 'website',
    icon: Globe,
    label: 'Multilingual Website',
    shortLabel: 'Website',
    color: 'pink',
    bgGradient: 'from-pink-500/20 to-rose-600/20',
    borderColor: 'border-pink-500/40',
    textColor: 'text-pink-400',
    initialPosition: { x: -180, y: 200 },
    finalPosition: { x: -120, y: 100 },
  },
  {
    id: 'revenue',
    icon: Wallet,
    label: '100% Your Revenue',
    shortLabel: '100% Yours',
    color: 'green',
    bgGradient: 'from-green-500/20 to-emerald-600/20',
    borderColor: 'border-green-500/40',
    textColor: 'text-green-400',
    initialPosition: { x: -50, y: 220 },
    finalPosition: { x: 0, y: 130 },
  },
];

// Define connections between features for the ecosystem lines
export const ecosystemConnections = [
  // Voice connects to center hub and adjacent features
  { from: 'voice', to: 'center' },
  { from: 'visual', to: 'center' },
  { from: 'drive-thru', to: 'center' },
  { from: 'pos', to: 'center' },
  { from: 'inventory', to: 'center' },
  { from: 'analytics', to: 'center' },
  { from: 'website', to: 'center' },
  { from: 'revenue', to: 'center' },
  // Ring connections
  { from: 'voice', to: 'visual' },
  { from: 'visual', to: 'drive-thru' },
  { from: 'drive-thru', to: 'inventory' },
  { from: 'inventory', to: 'analytics' },
  { from: 'analytics', to: 'revenue' },
  { from: 'revenue', to: 'website' },
  { from: 'website', to: 'pos' },
  { from: 'pos', to: 'voice' },
];
