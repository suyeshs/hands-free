import { useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import { useDashboardStore, type ChartPeriod } from '../stores/dashboardStore'
import { useLocationStore } from '../stores/locationStore'
import './SalesChart.css'

Chart.register(...registerables)

export default function SalesChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const { currentPeriod, overlays, setPeriod, toggleOverlay } = useDashboardStore()
  const { currentLocation } = useLocationStore()

  const periods: { id: ChartPeriod; label: string }[] = [
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'year', label: 'Year' }
  ]

  const overlayOptions = [
    { id: 'yesterday' as const, label: 'Yesterday', color: 'rgba(244, 63, 94, 0.8)' },
    { id: 'lastWeek' as const, label: 'Last Week', color: 'rgba(251, 146, 60, 0.8)' },
    { id: 'lastMonth' as const, label: 'Last Month', color: 'rgba(34, 197, 94, 0.8)' },
    { id: 'lastYear' as const, label: 'Last Year', color: 'rgba(59, 130, 246, 0.8)' }
  ]

  useEffect(() => {
    if (!canvasRef.current) return

    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy()
    }

    // Generate data based on location and period
    const generateData = (period: ChartPeriod, offset: number = 0) => {
      let base = 1200
      if (currentLocation === 'mg-road') base = 1800
      else if (currentLocation === 'indiranagar') base = 1200
      else if (currentLocation === 'koramangala') base = 600
      else if (currentLocation === 'all') base = 3600

      const points = period === 'day' ? 24 : period === 'week' ? 7 : period === 'month' ? 30 : 12
      return Array.from({ length: points }, (_, i) => {
        const variance = Math.random() * 400 - 200
        const timeVariance = period === 'day'
          ? (i >= 11 && i <= 14 || i >= 18 && i <= 21 ? 400 : -200)
          : 0
        return Math.max(0, base + variance + timeVariance - (offset * 100))
      })
    }

    const getLabels = (period: ChartPeriod) => {
      if (period === 'day') {
        return Array.from({ length: 24 }, (_, i) => `${i}:00`)
      } else if (period === 'week') {
        return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      } else if (period === 'month') {
        return Array.from({ length: 30 }, (_, i) => `${i + 1}`)
      } else {
        return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      }
    }

    const datasets = [
      {
        label: 'Today',
        data: generateData(currentPeriod),
        borderColor: '#6366f1',
        backgroundColor: (() => {
          const gradient = ctx.createLinearGradient(0, 0, 0, 250)
          gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)')
          gradient.addColorStop(1, 'rgba(99, 102, 241, 0)')
          return gradient
        })(),
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 3
      }
    ]

    // Add overlay datasets
    if (overlays.yesterday) {
      datasets.push({
        label: 'Yesterday',
        data: generateData(currentPeriod, 1),
        borderColor: overlayOptions[0].color,
        tension: 0.4,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 2
      } as any)
    }
    if (overlays.lastWeek) {
      datasets.push({
        label: 'Last Week',
        data: generateData(currentPeriod, 2),
        borderColor: overlayOptions[1].color,
        tension: 0.4,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 2
      } as any)
    }
    if (overlays.lastMonth) {
      datasets.push({
        label: 'Last Month',
        data: generateData(currentPeriod, 3),
        borderColor: overlayOptions[2].color,
        tension: 0.4,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 2
      } as any)
    }
    if (overlays.lastYear) {
      datasets.push({
        label: 'Last Year',
        data: generateData(currentPeriod, 4),
        borderColor: overlayOptions[3].color,
        tension: 0.4,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 2
      } as any)
    }

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: getLabels(currentPeriod),
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'start',
            labels: {
              color: '#a0a0a0',
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 15,
              font: {
                size: 12,
                weight: 500
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(20, 20, 20, 0.95)',
            titleColor: '#ffffff',
            bodyColor: '#a0a0a0',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ₹${context.parsed.y?.toLocaleString() ?? '0'}`
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#666',
              font: {
                size: 11
              },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8
            },
            border: {
              display: false
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
              drawTicks: false
            },
            ticks: {
              color: '#666',
              font: {
                size: 11
              },
              padding: 10,
              callback: function(value) {
                return '₹' + (value as number).toLocaleString()
              }
            },
            border: {
              display: false,
              dash: [5, 5]
            }
          }
        }
      }
    })

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
      }
    }
  }, [currentPeriod, overlays, currentLocation])

  return (
    <div className="page-section">
      <div className="chart-container glass">
        <div className="chart-header">
          <h2 className="chart-title">Sales Overview</h2>
          <div className="period-selector">
            {periods.map(period => (
              <button
                key={period.id}
                className={`period-btn tap-feedback ${currentPeriod === period.id ? 'active' : ''}`}
                onClick={() => setPeriod(period.id)}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
        <div className="chart-canvas-wrapper">
          <canvas ref={canvasRef}></canvas>
        </div>
        <div className="chart-overlays">
          {overlayOptions.map(overlay => (
            <label key={overlay.id} className="overlay-checkbox">
              <input
                type="checkbox"
                checked={overlays[overlay.id]}
                onChange={() => toggleOverlay(overlay.id)}
              />
              <span className="checkbox-custom"></span>
              <span className="overlay-label">{overlay.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
