import { NavLink, Outlet } from 'react-router'
import { Icon, type IconName } from '../components/Icon'
import { Logo } from '../components/Logo'
import { useOnlineStatus } from './useOnlineStatus'

const navItems: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'الرئيسية', icon: 'home' },
  { to: '/transactions', label: 'العمليات', icon: 'list' },
  { to: '/budgets', label: 'الميزانيات', icon: 'wallet' },
  { to: '/settings', label: 'الإعدادات', icon: 'settings' },
]

export function AppLayout() {
  const online = useOnlineStatus()

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__brand">
          <Logo size={32} title="" />
          <span className="app-header__name">قِرْش</span>
        </div>
        {!online && (
          <span className="offline-badge" role="status">
            <Icon name="offline" size={16} />
            دون اتصال — بياناتك محفوظة على جهازك
          </span>
        )}
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="التنقل الرئيسي">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => ['bottom-nav__item', isActive && 'is-active'].filter(Boolean).join(' ')}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
