/**
 * Sales Chart Component
 * Simple line chart for daily sales visualization
 */

import { DailySales } from '../../stores/analyticsStore';

interface SalesChartProps {
  data: DailySales[];
  height?: number;
}

export default function SalesChart({ data, height = 200 }: SalesChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        No data available
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue));
  const minRevenue = Math.min(...data.map((d) => d.revenue));
  const range = maxRevenue - minRevenue;

  // Calculate points for the line
  const points = data.map((item, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((item.revenue - minRevenue) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  // Format currency
  const formatCurrency = (value: number) => {
    return `₹${(value / 1000).toFixed(1)}k`;
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full">
      {/* Chart */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ height: `${height}px`, width: '100%' }}
        className="bg-gradient-to-b from-blue-50 to-white rounded-lg"
      >
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="100"
            y2={y}
            stroke="#e5e7eb"
            strokeWidth="0.2"
          />
        ))}

        {/* Area under the line */}
        <polygon
          points={`0,100 ${points} 100,100`}
          fill="url(#gradient)"
          opacity="0.5"
        />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.map((item, index) => {
          const x = (index / (data.length - 1)) * 100;
          const y = 100 - ((item.revenue - minRevenue) / range) * 100;
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="1.5"
              fill="#3b82f6"
              className="hover:r-2 cursor-pointer"
            />
          );
        })}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* Y-axis labels */}
      <div className="flex justify-between text-xs text-gray-500 mt-2 px-2">
        <span>{formatCurrency(minRevenue)}</span>
        <span>{formatCurrency(maxRevenue)}</span>
      </div>

      {/* X-axis labels - show first, middle, and last date */}
      <div className="flex justify-between text-xs text-gray-500 mt-1 px-2">
        <span>{formatDate(data[0].date)}</span>
        {data.length > 2 && (
          <span>{formatDate(data[Math.floor(data.length / 2)].date)}</span>
        )}
        <span>{formatDate(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}
