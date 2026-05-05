'use client';

import GrabMenuItem from './GrabMenuItem';

interface MenuItem {
  itemId: string;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  isVegetarian?: boolean;
  isVegan?: boolean;
}

interface GrabMenuGridProps {
  items: MenuItem[];
  loading: boolean;
}

export default function GrabMenuGrid({ items, loading }: GrabMenuGridProps) {
  if (loading) {
    return <div className="loading">Loading menu...</div>;
  }

  return (
    <div className="menu-items">
      {items.map(item => (
        <GrabMenuItem key={item.itemId} item={item} />
      ))}
    </div>
  );
}
