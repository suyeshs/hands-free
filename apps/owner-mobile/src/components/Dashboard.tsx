import Header from './Header'
import MetricsGrid from './MetricsGrid'
import SalesChart from './SalesChart'
import QuickActions from './QuickActions'
import ActivityFeed from './ActivityFeed'
import AIInsights from './AIInsights'
import './Dashboard.css'

interface DashboardProps {
  onLocationClick: () => void
}

export default function Dashboard({ onLocationClick }: DashboardProps) {
  return (
    <div className="dashboard">
      <div className="gradient-overlay">
        <Header onLocationClick={onLocationClick} />
        <MetricsGrid />
        <SalesChart />

        {/* AI-Powered Business Insights */}
        <AIInsights />

        <QuickActions />
        <ActivityFeed />
      </div>
    </div>
  )
}
