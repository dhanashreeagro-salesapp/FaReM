import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { Users, Map, Wheat, UserCheck, Megaphone, Send, BarChart3, Shield, Settings, LogOut, MapPin, Award } from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard & Reports', icon: BarChart3, roles: ['Admin', 'ZonalManager', 'TerritoryManager', 'FieldStaff'] },
  { path: '/users', label: 'User Management', icon: Users, roles: ['Admin', 'ContentTeam'] },
  { path: '/territories', label: 'Territory Hierarchy', icon: Map, roles: ['Admin', 'ContentTeam'] },
  { path: '/crops', label: 'Crop Master', icon: Wheat, roles: ['Admin', 'ContentTeam'] },
  { path: '/farmers', label: 'Farmer Management', icon: UserCheck, roles: ['Admin', 'ZonalManager', 'TerritoryManager', 'FieldStaff'] },
  { path: '/planner', label: 'Smart Planner', icon: Map, roles: ['Admin', 'FieldStaff'] },
  { path: '/recommendations-dashboard', label: 'Recommendation Engine', icon: Award, roles: ['Admin', 'ZonalManager', 'TerritoryManager', 'FieldStaff'] },
  { path: '/promotions', label: 'Promotion Library', icon: Megaphone, roles: ['Admin', 'ContentTeam'] },
  { path: '/promotions-management', label: 'Promotions Management', icon: Send, roles: ['Admin', 'ZonalManager', 'TerritoryManager', 'FieldStaff'] },
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
      {/* Brand Header */}
      <div className="flex items-center gap-3 h-16 px-4 border-b border-border bg-emerald-50/50">
        <img src="/agriamigo-logo.png" alt="AgriAmigo Logo" className="w-10 h-10 object-contain shrink-0 rounded-lg shadow-sm" />
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-heading font-bold text-emerald-900 leading-tight tracking-tight">
            AgriAmigo
          </h1>
          <p className="text-[10px] uppercase font-semibold text-emerald-700 tracking-wider">FRM Platform</p>
        </div>
      </div>

      {/* User Info Card */}
      <div className="px-4 py-3 border-b border-border bg-surface">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center font-heading font-bold text-xs shrink-0 border border-primary/20">
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-heading font-bold text-text truncate leading-tight">
              {user?.full_name || user?.email || 'User'}
            </p>
            {user?.territory_name ? (
              <p className="text-[11px] text-primary font-medium truncate flex items-center gap-1 leading-tight mt-0.5">
                <MapPin size={10} className="inline shrink-0" /> {user.territory_name}
              </p>
            ) : (
              <p className="text-[11px] text-text-muted leading-tight mt-0.5">{user?.role || 'User'}</p>
            )}
          </div>
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
