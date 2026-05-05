import { User, HelpCircle, LogOut, Menu as MenuIcon } from 'lucide-react'
import { useDeviceAuthStore } from '../stores/deviceAuthStore'
import './FABMenu.css'

interface FABMenuProps {
  isOpen: boolean
  onToggle: () => void
}

export default function FABMenu({ isOpen, onToggle }: FABMenuProps) {
  const { logout } = useDeviceAuthStore()

  const handleLogout = () => {
    logout()
  }

  const menuItems = [
    { icon: <User size={20} />, label: 'Profile', action: () => console.log('Profile') },
    { icon: <HelpCircle size={20} />, label: 'Help', action: () => console.log('Help') },
    { icon: <LogOut size={20} />, label: 'Logout', action: handleLogout }
  ]

  return (
    <>
      {isOpen && <div className="fab-overlay" onClick={onToggle}></div>}

      <div className={`fab-menu ${isOpen ? 'open' : ''}`}>
        {menuItems.map((item, index) => (
          <button
            key={index}
            className="fab-item glass tap-feedback"
            onClick={() => {
              item.action()
              onToggle()
            }}
            style={{
              transitionDelay: isOpen ? `${index * 50}ms` : `${(menuItems.length - index - 1) * 30}ms`
            }}
          >
            <span className="fab-item-icon">{item.icon}</span>
            <span className="fab-item-label">{item.label}</span>
          </button>
        ))}
      </div>

      <button className="fab-button tap-feedback" onClick={onToggle}>
        <MenuIcon size={24} className={`fab-icon ${isOpen ? 'rotate' : ''}`} />
      </button>
    </>
  )
}
