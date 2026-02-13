import { ShoppingBag, Users, TrendingUp, Clock } from 'lucide-react'
import './ManagerMode.css'

export default function ManagerMode() {
  const stats = [
    { icon: <ShoppingBag size={20} />, label: 'Active Orders', value: '18', color: '#6366f1' },
    { icon: <Users size={20} />, label: 'Staff Online', value: '12', color: '#10b981' },
    { icon: <TrendingUp size={20} />, label: 'Today\'s Sales', value: '₹45.8K', color: '#f59e0b' },
    { icon: <Clock size={20} />, label: 'Avg Prep Time', value: '14m', color: '#3b82f6' }
  ]

  const kdsOrders = [
    {
      id: '4523',
      table: 'Table 8',
      items: ['2× Butter Chicken', '1× Paneer Tikka', '3× Naan'],
      time: '18m',
      urgent: true
    },
    {
      id: '4524',
      table: 'Table 12',
      items: ['1× Dal Makhani', '2× Roti', '1× Rice'],
      time: '12m',
      urgent: false
    },
    {
      id: '4525',
      table: 'Table 5',
      items: ['1× Biryani', '2× Raita', '1× Gulab Jamun'],
      time: '8m',
      urgent: false
    },
    {
      id: '4526',
      table: 'Table 15',
      items: ['3× Masala Dosa', '2× Filter Coffee'],
      time: '5m',
      urgent: false
    }
  ]

  const teamMembers = [
    { name: 'Rajesh Kumar', role: 'Waiter', status: 'Active', tables: 4 },
    { name: 'Priya Singh', role: 'Waiter', status: 'Active', tables: 5 },
    { name: 'Amit Patel', role: 'Chef', status: 'Active', tables: 0 },
    { name: 'Sanjay Reddy', role: 'Waiter', status: 'Break', tables: 0 }
  ]

  return (
    <div className="manager-mode">
      <div className="page-section">
        <h2 className="section-title">Operations Overview</h2>
        <div className="overview-stats">
          {stats.map((stat, index) => (
            <div key={index} className="overview-card glass">
              <div className="overview-icon" style={{ color: stat.color }}>
                {stat.icon}
              </div>
              <div className="overview-content">
                <div className="overview-value">{stat.value}</div>
                <div className="overview-label">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="page-section">
        <h2 className="section-title">Kitchen Display</h2>
        <div className="kds-grid">
          {kdsOrders.map((order) => (
            <div key={order.id} className={`kds-order glass ${order.urgent ? 'urgent' : ''}`}>
              <div className="kds-header">
                <div className="kds-order-info">
                  <div className="kds-order-number">#{order.id}</div>
                  <div className="kds-table">{order.table}</div>
                </div>
                <div className={`kds-timer ${order.urgent ? 'urgent' : ''}`}>
                  {order.time}
                </div>
              </div>
              <div className="kds-items">
                {order.items.map((item, idx) => (
                  <div key={idx} className="kds-item">{item}</div>
                ))}
              </div>
              <div className="kds-actions">
                <button className="kds-btn kds-btn-primary tap-feedback">
                  ✓ Ready
                </button>
                <button className="kds-btn kds-btn-secondary tap-feedback">
                  ⚠️ Delay
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="page-section">
        <h2 className="section-title">Team Status</h2>
        <div className="team-list">
          {teamMembers.map((member, index) => (
            <div key={index} className="team-member glass">
              <div className="member-avatar">
                {member.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="member-info">
                <div className="member-name">{member.name}</div>
                <div className="member-role">{member.role}</div>
              </div>
              <div className="member-status">
                <span className={`status-badge ${member.status.toLowerCase()}`}>
                  {member.status}
                </span>
                {member.tables > 0 && (
                  <span className="tables-count">{member.tables} tables</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
