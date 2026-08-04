import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import UserMaster from './pages/UserMaster';
import CropMaster from './pages/CropMaster';
import TerritoryManagement from './pages/TerritoryManagement';
import FarmerManagement from './pages/FarmerManagement';
import PromotionLibrary from './pages/PromotionLibrary';
import PromotionsManagement from './pages/PromotionsManagement';
import Dashboard from './pages/Dashboard';
import AuditLogs from './pages/AuditLogs';
import SettingsPage from './pages/SettingsPage';
import VisitPlanner from './pages/VisitPlanner';
import RecommendationDashboard from './pages/RecommendationDashboard';


import { MapPin } from 'lucide-react';

function ProtectedLayout() {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-text-muted font-heading">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-surface border-b border-border z-10 py-3 px-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-heading font-bold text-text">{user?.full_name || 'FaReM App'}</h2>
              {user?.territory_name && (
                <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <MapPin size={11} /> {user.territory_name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-white text-xs font-heading font-bold">
                {user?.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/users" element={<UserMaster />} />
            <Route path="/crops" element={<CropMaster />} />
            <Route path="/territories" element={<TerritoryManagement />} />
            <Route path="/farmers" element={<FarmerManagement />} />
            <Route path="/planner" element={<VisitPlanner />} />
            <Route path="/promotions" element={<PromotionLibrary />} />
            <Route path="/promotions-management" element={<PromotionsManagement />} />
            <Route path="/recommendations-dashboard" element={<RecommendationDashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />

            <Route path="/audit-logs" element={<AuditLogs />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
