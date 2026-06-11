import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { Users, Map, Wheat, UserCheck, Megaphone, Send, BarChart3, Shield, Settings, LogOut } from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard & Reports', icon: BarChart3, roles: ['Admin', 'ZonalManager', 'TerritoryManager', 'FieldStaff'] },
  { path: '/users', label: 'User Management', icon: Users, roles: ['Admin', 'ContentTeam'] },
  { path: '/territories', label: 'Territory Hierarchy', icon: Map, roles: ['Admin', 'ContentTeam'] },
  { path: '/crops', label: 'Crop Master', icon: Wheat, roles: ['Admin', 'ContentTeam'] },
  { path: '/farmers', label: 'Farmer Management', icon: UserCheck, roles: ['Admin', 'ZonalManager', 'TerritoryManager', 'FieldStaff'] },
  { path: '/planner', label: 'Smart Planner', icon: Map, roles: ['Admin', 'FieldStaff'] },
  { path: '/promotions', label: 'Promotion Library', icon: Megaphone, roles: ['Admin', 'ContentTeam'] },
  { path: '/bulk-sends', label: 'Bulk Messages', icon: Send, roles: ['Admin', 'ZonalManager', 'TerritoryManager'] },
  { path: '/audit-logs', label: 'Audit Logs', icon: Shield, roles: ['Admin'] },
  { path: '/settings', label: 'Settings', icon: Settings, roles: ['Admin'] },
];

export default function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const visibleItems = navItems.filter(item =>
    item.roles.includes(user?.role)
  );

  return (
    <div className="w-64 bg-surface border-r border-border flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center h-16 px-5 border-b border-border">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mr-3">
          <span className="text-white text-sm font-heading font-bold">D</span>
        </div>
        <div>
          <h1 className="text-sm font-heading font-bold text-text leading-tight">FFMA Admin</h1>
          <p className="text-xs text-text-muted leading-tight">Dhanashree Crops</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        <ul className="space-y-0.5">
          {visibleItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <li key={path}>
                <Link
                  to={path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-text-muted hover:bg-bg hover:text-text'
                  }`}
                >
                  <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <button
          id="logout-btn"
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-text-muted hover:bg-red-50 hover:text-danger transition-all"
        >
          <LogOut size={18} strokeWidth={1.8} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
