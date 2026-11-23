import React, { useState, useEffect, Suspense, lazy } from 'react';
import { isTestEnvironment } from './utils/envHelper';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';

const UserMaster = lazy(() => import('./pages/UserMaster'));
const CropMaster = lazy(() => import('./pages/CropMaster'));
const TerritoryManagement = lazy(() => import('./pages/TerritoryManagement'));
const FarmerManagement = lazy(() => import('./pages/FarmerManagement'));
const PromotionLibrary = lazy(() => import('./pages/PromotionLibrary'));
const PromotionsManagement = lazy(() => import('./pages/PromotionsManagement'));
const DashboardV2 = lazy(() => import('./pages/DashboardV2'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const VisitPlanner = lazy(() => import('./pages/VisitPlanner'));
const RecommendationDashboard = lazy(() => import('./pages/RecommendationDashboard'));
const MarketIntelligence = lazy(() => import('./pages/MarketIntelligence'));
const CommodityMapping = lazy(() => import('./pages/CommodityMapping'));
const DataDebug = lazy(() => import('./pages/DataDebug'));
const FrontendDataDiagnostic = lazy(() => import('./pages/FrontendDataDiagnostic'));
const CropIntelligence = lazy(() => import('./pages/CropIntelligence'));


import { MapPin, Menu, HelpCircle } from 'lucide-react';

function ProtectedLayout() {
  const { isAuthenticated, loading, user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
    <div className="flex h-screen bg-bg overflow-hidden relative">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {isTestEnvironment() && (
          <div className="bg-gradient-to-r from-violet-900 via-indigo-900 to-violet-900 text-white text-xs font-semibold px-4 py-2 flex items-center justify-between shadow-md z-30 border-b border-violet-700/60 shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="bg-amber-400 text-slate-950 font-black text-[10px] tracking-wider uppercase px-2 py-0.5 rounded shadow-sm">
                TEST ENVIRONMENT
              </span>
              <span className="text-violet-100 hidden sm:inline">
                Connected to Test Database (Main Branch) — Safe for Testing
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-violet-200">
              <span className="bg-violet-950/70 px-2 py-0.5 rounded border border-violet-600/50">
                Branch: <strong className="text-white">main</strong>
              </span>
            </div>
          </div>
        )}
        <header className="bg-surface border-b border-border z-10 py-3 px-4 md:px-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-1.5 -ml-1.5 text-text-muted hover:bg-bg rounded-lg"
              >
                <Menu size={20} />
              </button>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-heading font-bold text-text truncate max-w-[120px] md:max-w-xs">{user?.full_name || 'FaReM App'}</h2>
              {user?.territory_name && (
                <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <MapPin size={11} /> {user.territory_name}
                </span>
              )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  const path = window.location.pathname;
                  let section = '';
                  if (path.includes('/dashboard')) section = '#sec5';
                  else if (path.includes('/farmers')) section = '#sec6';
                  else if (path.includes('/planner')) section = '#sec7';
                  else if (path.includes('/recommendations')) section = '#sec8';
                  else if (path.includes('/promotions')) section = '#sec9';
                  else if (path.includes('/market-intelligence')) section = '#sec10';
                  window.open('/user-manual.html' + section, '_blank');
                }}
                className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-1.5"
                title="Help / User Manual"
              >
                <HelpCircle size={20} />
                <span className="hidden sm:inline text-xs font-semibold">Help</span>
              </button>
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-white text-xs font-heading font-bold">
                {user?.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          }>
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
              <Route path="/market-intelligence" element={<MarketIntelligence />} />
              <Route path="/market-mapping" element={<CommodityMapping />} />
              <Route path="/dashboard" element={<DashboardV2 />} />

              <Route path="/audit-logs" element={<AuditLogs />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/data-debug" element={<DataDebug />} />
              <Route path="/frontend-diagnostic" element={<FrontendDataDiagnostic />} />
              <Route path="/crop-intelligence" element={<CropIntelligence />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const isTestEnv = isTestEnvironment();

  useEffect(() => {
    if (isTestEnv) {
      document.documentElement.dataset.env = 'test';
      document.title = '[TEST] Agri Amigo';
    } else {
      delete document.documentElement.dataset.env;
      document.title = 'Agri Amigo';
    }
  }, [isTestEnv]);

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
