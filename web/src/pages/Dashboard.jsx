import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Users, Phone, MapPin, TrendingUp, Download, AlertTriangle } from 'lucide-react';

function StatCard({ icon: Icon, label, value, color, delay }) {
  return (
    <div className="card p-5 animate-stagger-in" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wide font-heading">{label}</p>
          <p className="text-2xl font-heading font-bold text-text mt-1">{value ?? '—'}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const d = await api.getDashboard();
        setData(d);
      } catch { /* role doesn't have access */ }
      setLoading(false);
    };
    fetchDashboard();
  }, []);

  const handleExport = async (type) => {
    try {
      const response = await api.exportReport(type);
      if (response instanceof Response) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report.${type === 'excel' ? 'xlsx' : 'pdf'}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* handled */ }
  };

  if (loading) return <div className="card p-8 text-center text-text-muted">Loading dashboard...</div>;
  if (!data) return <div className="card p-8 text-center text-text-muted">Dashboard not available for your role.</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-heading font-bold text-text">Management Dashboard</h2>
        <div className="flex gap-2">
          <button onClick={() => handleExport('excel')}
            className="flex items-center gap-2 bg-surface border border-border hover:bg-bg text-text px-4 py-2 rounded-lg text-sm font-medium transition-colors btn-press">
            <Download size={14} /> Export Excel
          </button>
          <button onClick={() => handleExport('pdf')}
            className="flex items-center gap-2 bg-surface border border-border hover:bg-bg text-text px-4 py-2 rounded-lg text-sm font-medium transition-colors btn-press">
            <Download size={14} /> Export PDF
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <StatCard icon={Users} label="Total Active Farmers" value={data.total_farmers?.toLocaleString()} color="bg-primary/10 text-primary" delay={0} />
        <StatCard icon={MapPin} label="Total Visits Logged" value={data.total_visits?.toLocaleString()} color="bg-accent/10 text-accent" delay={60} />
        <StatCard icon={Phone} label="Total Calls Logged" value={data.total_calls?.toLocaleString()} color="bg-warning/10 text-warning" delay={120} />
        <StatCard icon={AlertTriangle} label="Overdue Visits" value={data.overdue_visits?.toLocaleString()} color="bg-danger/10 text-danger" delay={180} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard icon={Users} label="Enrolled This Month" value={data.this_month_farmers?.toLocaleString()} color="bg-success/10 text-success" delay={240} />
        <StatCard icon={Users} label="Enrolled Last Month" value={data.last_month_farmers?.toLocaleString()} color="bg-success/10 text-success" delay={300} />
        <StatCard icon={Users} label="Enrolled YTD (from Apr 1)" value={data.ytd_farmers?.toLocaleString()} color="bg-success/10 text-success" delay={360} />
      </div>

      {/* Top Villages */}
      <div className="card p-5 animate-stagger-in" style={{ animationDelay: '180ms' }}>
        <h3 className="font-heading font-semibold text-text mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-primary" /> Top Villages by Farmer Count
        </h3>
        {data.top_villages?.length > 0 ? (
          <div className="space-y-3">
            {data.top_villages.map((v, i) => {
              const maxCount = data.top_villages[0].count;
              const pct = maxCount > 0 ? (v.count / maxCount * 100) : 0;
              return (
                <div key={i} className="flex items-center gap-4">
                  <span className="text-sm font-medium text-text w-32 truncate">{v.village}</span>
                  <div className="flex-1 bg-bg rounded-full h-6 overflow-hidden">
                    <div className="bg-primary/20 h-full rounded-full flex items-center px-3 transition-all duration-500"
                         style={{ width: `${Math.max(pct, 10)}%` }}>
                      <span className="text-xs font-mono font-semibold text-primary">{v.count}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-text-muted">No village data available.</p>
        )}
      </div>
    </div>
  );
}
