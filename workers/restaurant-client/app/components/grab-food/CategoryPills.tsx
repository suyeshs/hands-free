'use client';

interface CategoryPillsProps {
  categories: string[];
  selected: string;
  onSelectCategory: (category: string) => void;
  vegFilter: 'all' | 'veg';
  onVegFilterChange: (filter: 'all' | 'veg') => void;
}

export default function CategoryPills({ categories, selected, onSelectCategory, vegFilter, onVegFilterChange }: CategoryPillsProps) {
  return (
    <div className="category-pills">
      <div className="category-pills-header">
        <div className="menu-title">Menu</div>
        <div className="veg-toggle">
          <div
            className={`veg-toggle-option ${vegFilter === 'all' ? 'active' : ''}`}
            onClick={() => onVegFilterChange('all')}
          >
            All
          </div>
          <div
            className={`veg-toggle-option ${vegFilter === 'veg' ? 'active' : ''}`}
            onClick={() => onVegFilterChange('veg')}
          >
            🟢 Veg
          </div>
        </div>
      </div>
      <div className="pills-container">
        <div className="pills">
          {categories.map(category => (
            <div
              key={category}
              className={`pill ${selected === category ? 'active' : ''}`}
              onClick={() => onSelectCategory(category)}
            >
              {category}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
