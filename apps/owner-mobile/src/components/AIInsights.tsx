import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import {
  createBusinessIntelligenceAPI,
  MenuInsight
} from '../services/businessIntelligenceApi'
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Star,
  DollarSign,
  BarChart3,
  Package
} from 'lucide-react'
import './AIInsights.css'

export default function AIInsights() {
  const { tenant } = useAuthStore()
  const [insights, setInsights] = useState<MenuInsight[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week')
  const [summary, setSummary] = useState({
    total_items_analyzed: 0,
    high_priority_issues: 0,
    potential_monthly_impact: 0,
    avg_food_cost_percentage: 0
  })

  const fetchInsights = async () => {
    if (!tenant?.tenantId) {
      setError('No tenant information available')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const biApi = createBusinessIntelligenceAPI(tenant.tenantId)
      const result = await biApi.getMenuOptimization({
        time_range: timeRange,
        min_confidence: 0.6,
        options: {
          target_food_cost_percentage: 30
        }
      })

      if (result.success) {
        setInsights(result.insights)
        setSummary(result.summary)
      } else {
        setError(result.error || 'Failed to fetch insights')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchInsights()
  }, [tenant?.tenantId, timeRange])

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'high':
        return <AlertCircle className="w-5 h-5 text-orange-500" />
      case 'medium':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
      case 'positive':
        return <Star className="w-5 h-5 text-green-500" />
      default:
        return <CheckCircle2 className="w-5 h-5 text-blue-500" />
    }
  }

  const getIssueIcon = (issueType: string) => {
    switch (issueType) {
      case 'high_food_cost':
        return <TrendingUp className="w-4 h-4" />
      case 'low_sales':
        return <TrendingDown className="w-4 h-4" />
      case 'pricing_opportunity':
        return <DollarSign className="w-4 h-4" />
      case 'high_performer':
        return <BarChart3 className="w-4 h-4" />
      case 'waste_risk':
        return <Package className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  const formatIssueType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  }

  return (
    <div className="ai-insights">
      <div className="insights-header">
        <div className="insights-title">
          <Sparkles className="w-6 h-6 text-orange-500" />
          <h2>AI Business Insights</h2>
        </div>

        <div className="insights-controls">
          <div className="time-range-toggle">
            <button
              className={timeRange === 'week' ? 'active' : ''}
              onClick={() => setTimeRange('week')}
            >
              Week
            </button>
            <button
              className={timeRange === 'month' ? 'active' : ''}
              onClick={() => setTimeRange('month')}
            >
              Month
            </button>
          </div>

          <button
            className="refresh-button"
            onClick={fetchInsights}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {!isLoading && !error && insights.length > 0 && (
        <div className="insights-summary">
          <div className="summary-card">
            <div className="summary-label">Items Analyzed</div>
            <div className="summary-value">{summary.total_items_analyzed}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">High Priority</div>
            <div className="summary-value critical">{summary.high_priority_issues}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Potential Impact</div>
            <div className="summary-value positive">
              {formatCurrency(summary.potential_monthly_impact)}/mo
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Avg Food Cost</div>
            <div className="summary-value">
              {summary.avg_food_cost_percentage.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="insights-loading">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <p>Analyzing your menu with AI...</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="insights-error">
          <AlertCircle className="w-6 h-6 text-red-500" />
          <p>{error}</p>
          <button onClick={fetchInsights} className="retry-button">
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && insights.length === 0 && (
        <div className="insights-empty">
          <Sparkles className="w-12 h-12 text-gray-400" />
          <h3>No insights available</h3>
          <p>We couldn't find any recommendations for the selected period.</p>
        </div>
      )}

      {/* Insights List */}
      {!isLoading && !error && insights.length > 0 && (
        <div className="insights-list">
          {insights.map((insight, index) => (
            <div key={index} className={`insight-card severity-${insight.severity}`}>
              <div className="insight-header">
                <div className="insight-title-row">
                  {getSeverityIcon(insight.severity)}
                  <h3>{insight.item_name}</h3>
                </div>
                <div className="insight-badge">
                  {getIssueIcon(insight.issue_type)}
                  <span>{formatIssueType(insight.issue_type)}</span>
                </div>
              </div>

              {/* Metrics */}
              <div className="insight-metrics">
                {insight.current_metrics.food_cost_percentage !== undefined && (
                  <div className="metric">
                    <span className="metric-label">Food Cost:</span>
                    <span className="metric-value">
                      {insight.current_metrics.food_cost_percentage.toFixed(1)}%
                    </span>
                  </div>
                )}
                {insight.current_metrics.sales_count !== undefined && (
                  <div className="metric">
                    <span className="metric-label">Sales:</span>
                    <span className="metric-value">
                      {insight.current_metrics.sales_count} orders
                    </span>
                  </div>
                )}
                {insight.current_metrics.revenue !== undefined && (
                  <div className="metric">
                    <span className="metric-label">Revenue:</span>
                    <span className="metric-value">
                      {formatCurrency(insight.current_metrics.revenue)}
                    </span>
                  </div>
                )}
              </div>

              {/* Recommendation */}
              <div className="insight-recommendation">
                <p>{insight.recommendation}</p>
              </div>

              {/* Actions */}
              <div className="insight-actions">
                <div className="actions-header">💡 Suggested Actions:</div>
                {insight.suggested_actions.map((action, actionIndex) => (
                  <div key={actionIndex} className="action-item">
                    <div className="action-text">{action.action}</div>
                    <div className="action-impact">{action.impact_estimate}</div>
                  </div>
                ))}
              </div>

              {/* Confidence */}
              <div className="insight-footer">
                <div className="confidence-badge">
                  {Math.round(insight.confidence * 100)}% confidence
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Attribution */}
      {!isLoading && !error && insights.length > 0 && (
        <div className="ai-attribution">
          <Sparkles className="w-4 h-4" />
          <span>Powered by Gemini 1.5 Flash AI</span>
        </div>
      )}
    </div>
  )
}
