import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Sprout, MapPin, Layers, TrendingUp, Users, BarChart2,
  Filter, RefreshCw, AlertTriangle, ChevronDown, ChevronUp,
  ExternalLink, Leaf, Grid, Star, X
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../components/AuthProvider';

// ─── Colour palette ────────────────────────────────────────────────────────
const CHART_COLORS = [
  '#059669', '#0ea5e9', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1',
  '#84cc16', '#e11d48', '#06b6d4', '#a78bfa',
];

const STAGE_COLORS = {
  'Germination':    '#86efac',
  'Seedling':       '#4ade80',
  'Vegetative':     '#22c55e',
  'Flowering':      '#f59e0b',
  'Fruiting':       '#f97316',
  'Maturity':       '#ef4444',
  'Harvest':        '#7c3aed',
  'Unassigned':     '#94a3b8',
};

const stageColor = (name) =>
  STAGE_COLORS[name] || CHART_COLORS[Math.abs(name?.length || 0) % CHART_COLORS.length];

// ─── Tab definitions ───────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',      label: 'Executive Overview',       icon: BarChart2 },
  { id: 'acreage',       label: 'Crop Acreage',             icon: Sprout },
  { id: 'stages',        label: 'Growth Stages',            icon: Leaf },
  { id: 'geo',           label: 'Geographic Intelligence',  icon: MapPin },
  { id: 'matrix',        label: 'Geo × Crop Matrix',        icon: Grid },
  { id: 'opportunities', label: 'Fieldwork Opportunities',  icon: Star },
];

// ─── Shared helpers ────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm flex flex-col gap-2 ${color}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-75">{label}</p>
        <div className="p-1.5 rounded-lg bg-white/50"><Icon size={15} /></div>
      </div>
      <p className="text-2xl font-heading font-bold tracking-tight">{value ?? '—'}</p>
      {sub && <p className="text-[11px] opacity-70">{sub}</p>}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="p-2 bg-primary/10 rounded-xl"><Icon size={18} className="text-primary" /></div>
      <div>
        <h2 className="text-sm font-heading font-bold text-text">{title}</h2>
        {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function EmptyState({ message = 'No data available for the current filters.' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-text-muted">
      <Leaf size={32} className="mb-3 opacity-30" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

// Custom tooltip for bar charts
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-xl shadow-lg p-3 text-xs">
      <p className="font-bold text-text mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.fill || p.stroke }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ─── Filter Bar ────────────────────────────────────────────────────────────
function FilterBar({ options, filters, onChange, onApply, loading }) {
  const [open, setOpen] = useState(false);
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="bg-surface border border-border rounded-2xl p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-xs font-semibold text-text-muted hover:text-text transition-colors"
        >
          <Filter size={14} />
          {hasFilters ? (
            <span className="text-primary">Filters active</span>
          ) : (
            <span>Filter by District / Village / Crop / Staff</span>
          )}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {hasFilters && (
          <button
            onClick={() => { onChange({}); setTimeout(onApply, 0); }}
            className="flex items-center gap-1 text-[11px] text-danger font-semibold hover:underline"
          >
            <X size={12} /> Clear all
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {/* District */}
          <div>
            <label className="block text-[10px] font-semibold text-text-muted uppercase mb-1">District</label>
            <select
              className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-bg text-text focus:outline-none focus:border-primary"
              value={filters.district || ''}
              onChange={e => onChange({ ...filters, district: e.target.value, taluka: '', village: '' })}
            >
              <option value="">All Districts</option>
              {options.districts?.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Taluka */}
          <div>
            <label className="block text-[10px] font-semibold text-text-muted uppercase mb-1">Taluka</label>
            <select
              className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-bg text-text focus:outline-none focus:border-primary"
              value={filters.taluka || ''}
              onChange={e => onChange({ ...filters, taluka: e.target.value, village: '' })}
            >
              <option value="">All Talukas</option>
              {options.talukas?.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Village */}
          <div>
            <label className="block text-[10px] font-semibold text-text-muted uppercase mb-1">Village</label>
            <select
              className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-bg text-text focus:outline-none focus:border-primary"
              value={filters.village || ''}
              onChange={e => onChange({ ...filters, village: e.target.value })}
            >
              <option value="">All Villages</option>
              {options.villages?.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* Crop */}
          <div>
            <label className="block text-[10px] font-semibold text-text-muted uppercase mb-1">Crop</label>
            <select
              className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-bg text-text focus:outline-none focus:border-primary"
              value={filters.crop_id || ''}
              onChange={e => onChange({ ...filters, crop_id: e.target.value })}
            >
              <option value="">All Crops</option>
              {options.crops?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Staff (only for managers+) */}
          {options.staff?.length > 0 && (
            <div>
              <label className="block text-[10px] font-semibold text-text-muted uppercase mb-1">Staff</label>
              <select
                className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-bg text-text focus:outline-none focus:border-primary"
                value={filters.staff_id || ''}
                onChange={e => onChange({ ...filters, staff_id: e.target.value })}
              >
                <option value="">All Staff</option>
                {options.staff?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex items-end col-span-full lg:col-span-1">
            <button
              onClick={onApply}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all w-full justify-center"
            >
              <Filter size={12} /> Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Executive Overview ───────────────────────────────────────────────
function TabOverview({ data }) {
  const kpis = data?.kpis || {};
  return (
    <div className="space-y-6">
      <SectionHeader icon={BarChart2} title="Executive Overview" subtitle="Key metrics for the current filter scope" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard icon={Users}    label="Farmers" value={kpis.total_farmers?.toLocaleString()}
          color="bg-emerald-50 border-emerald-200 text-emerald-800" />
        <KpiCard icon={MapPin}   label="Active Plots" value={kpis.total_active_plots?.toLocaleString()}
          color="bg-blue-50 border-blue-200 text-blue-800" />
        <KpiCard icon={Sprout}   label="Cultivated Acres" value={kpis.total_cultivated_acres?.toLocaleString()}
          color="bg-amber-50 border-amber-200 text-amber-800" />
        <KpiCard icon={Leaf}     label="Distinct Crops" value={kpis.total_distinct_crops?.toLocaleString()}
          color="bg-teal-50 border-teal-200 text-teal-800" />
        <KpiCard icon={Layers}   label="Active Crop Seasons" value={kpis.total_active_seasons?.toLocaleString()}
          color="bg-purple-50 border-purple-200 text-purple-800" />
      </div>

      {/* Quick charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 8 crops by acreage */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-text uppercase mb-4 tracking-wide">Top Crops by Acreage</h3>
          {data?.crop_acreage?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.crop_acreage.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v} ac`} />
                <YAxis type="category" dataKey="crop_name" tick={{ fontSize: 10 }} width={90} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total_acres" name="Acres" radius={[0, 4, 4, 0]}>
                  {data.crop_acreage.slice(0, 8).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </div>

        {/* Top 8 villages by acreage */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-text uppercase mb-4 tracking-wide">Top Villages by Acreage</h3>
          {data?.geo_summary?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.geo_summary.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v} ac`} />
                <YAxis type="category" dataKey="village" tick={{ fontSize: 10 }} width={90} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="acres" name="Acres" radius={[0, 4, 4, 0]}>
                  {data.geo_summary.slice(0, 8).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[(i + 4) % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Crop Acreage ─────────────────────────────────────────────────────
function TabAcreage({ data }) {
  const crops = data?.crop_acreage || [];
  const total = crops.reduce((s, c) => s + c.total_acres, 0);

  return (
    <div className="space-y-6">
      <SectionHeader icon={Sprout} title="Crop Acreage Analysis"
        subtitle="Total cultivated acreage per crop, ranked by area" />

      {crops.length === 0 ? <EmptyState /> : (
        <>
          {/* Full ranked bar chart */}
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-text uppercase mb-4 tracking-wide">Acreage Ranking — All Crops</h3>
            <ResponsiveContainer width="100%" height={Math.max(250, crops.length * 32)}>
              <BarChart data={crops} layout="vertical" margin={{ left: 14, right: 50 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v} ac`} />
                <YAxis type="category" dataKey="crop_name" tick={{ fontSize: 10 }} width={100} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total_acres" name="Total Acres" radius={[0, 4, 4, 0]}>
                  {crops.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary table */}
          <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="text-xs font-bold text-text uppercase tracking-wide">Crop Acreage Summary Table</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-bg">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold text-text-muted uppercase tracking-wide">#</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-text-muted uppercase tracking-wide">Crop</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-text-muted uppercase tracking-wide">Acres</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-text-muted uppercase tracking-wide">Seasons</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-text-muted uppercase tracking-wide">% of Total</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {crops.map((c, i) => (
                    <tr key={i} className="border-t border-border/60 hover:bg-bg/50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-text-muted">{i + 1}</td>
                      <td className="px-4 py-2.5 font-semibold text-text flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        {c.crop_name}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold">{c.total_acres.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right">{c.season_count}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="px-2 py-0.5 bg-primary/10 text-primary font-bold rounded-full">{c.pct_of_total}%</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {/* Mini bar */}
                        <div className="w-24 h-2 bg-border rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${c.pct_of_total}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-bg border-t-2 border-border">
                  <tr>
                    <td colSpan={2} className="px-4 py-2.5 font-bold text-text">Total</td>
                    <td className="px-4 py-2.5 text-right font-bold text-text">{total.toFixed(2)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab: Growth Stages ────────────────────────────────────────────────────
function TabStages({ data }) {
  const rawDist = data?.crop_stage_distribution || [];
  const [selectedCrop, setSelectedCrop] = useState('');

  // Build unique crops
  const crops = useMemo(() => [...new Set(rawDist.map(r => r.crop_name))].sort(), [rawDist]);

  // For grouped bar chart: pivot by crop → stage
  const groupedData = useMemo(() => {
    const byCrop = {};
    rawDist.forEach(r => {
      if (!byCrop[r.crop_name]) byCrop[r.crop_name] = { crop_name: r.crop_name };
      byCrop[r.crop_name][r.stage_name] = r.count;
    });
    return Object.values(byCrop);
  }, [rawDist]);

  const allStages = useMemo(() => [...new Set(rawDist.map(r => r.stage_name))], [rawDist]);

  // Pie chart for selected crop
  const pieData = useMemo(() => {
    if (!selectedCrop) return [];
    return rawDist
      .filter(r => r.crop_name === selectedCrop)
      .map(r => ({ name: r.stage_name, value: r.count, acres: r.acres }));
  }, [rawDist, selectedCrop]);

  return (
    <div className="space-y-6">
      <SectionHeader icon={Leaf} title="Growth Stage Analysis"
        subtitle="Distribution of crop seasons across growth stages" />

      {rawDist.length === 0 ? <EmptyState /> : (
        <>
          {/* Grouped bar: all crops × stages */}
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-text uppercase mb-4 tracking-wide">All Crops — Stage Distribution</h3>
            <ResponsiveContainer width="100%" height={Math.max(280, groupedData.length * 38)}>
              <BarChart data={groupedData} layout="vertical" margin={{ left: 14, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="crop_name" tick={{ fontSize: 10 }} width={100} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {allStages.map((stage, i) => (
                  <Bar key={stage} dataKey={stage} stackId="a" fill={stageColor(stage)} name={stage} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Drill into one crop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-text uppercase tracking-wide">Drill-down: Stage Distribution by Crop</h3>
              <select
                className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-bg text-text focus:outline-none focus:border-primary"
                value={selectedCrop}
                onChange={e => setSelectedCrop(e.target.value)}
              >
                <option value="">Select a crop…</option>
                {crops.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              {selectedCrop && pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={stageColor(entry.name)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val, name, props) => [`${val} seasons (${props.payload.acres} ac)`, name]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-text-muted py-6 text-center">Select a crop above to view the stage breakdown.</p>
              )}
            </div>

            {/* Detail table */}
            <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h3 className="text-xs font-bold text-text uppercase tracking-wide">Stage Detail Table</h3>
              </div>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-bg sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold text-text-muted uppercase">Crop</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-text-muted uppercase">Stage</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-text-muted uppercase">Seasons</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-text-muted uppercase">Acres</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedCrop
                      ? rawDist.filter(r => r.crop_name === selectedCrop)
                      : rawDist
                    ).map((r, i) => (
                      <tr key={i} className="border-t border-border/60 hover:bg-bg/50">
                        <td className="px-4 py-2 font-semibold text-text">{r.crop_name}</td>
                        <td className="px-4 py-2">
                          <span className="px-2 py-0.5 rounded-full text-white text-[10px] font-semibold"
                            style={{ background: stageColor(r.stage_name) }}>
                            {r.stage_name}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-bold">{r.count}</td>
                        <td className="px-4 py-2 text-right">{r.acres}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab: Geographic Intelligence ─────────────────────────────────────────
function TabGeo({ data, onDrillVillage }) {
  const geoRows = data?.geo_summary || [];

  return (
    <div className="space-y-6">
      <SectionHeader icon={MapPin} title="Geographic Intelligence"
        subtitle="Village-level breakdown of farmers, plots, acreage, and crop mix" />

      {geoRows.length === 0 ? <EmptyState /> : (
        <>
          {/* Top 10 villages bar */}
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-text uppercase mb-4 tracking-wide">Top 10 Villages by Cultivated Acreage</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={geoRows.slice(0, 10)} margin={{ left: 14, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="village" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v} ac`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="acres" name="Acres" radius={[4, 4, 0, 0]}>
                  {geoRows.slice(0, 10).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Full table */}
          <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="text-xs font-bold text-text uppercase tracking-wide">Village Ranking Table — Click to Drill Down</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-bg">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold text-text-muted uppercase">#</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-text-muted uppercase">Village</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-text-muted uppercase">Taluka</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-text-muted uppercase">District</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-text-muted uppercase">Farmers</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-text-muted uppercase">Plots</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-text-muted uppercase">Acres</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-text-muted uppercase">Top Crops</th>
                  </tr>
                </thead>
                <tbody>
                  {geoRows.map((row, i) => (
                    <tr
                      key={i}
                      onClick={() => onDrillVillage(row.village)}
                      className="border-t border-border/60 hover:bg-emerald-50/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-2.5 font-mono text-text-muted">{i + 1}</td>
                      <td className="px-4 py-2.5 font-bold text-primary flex items-center gap-1">
                        <MapPin size={11} /> {row.village}
                      </td>
                      <td className="px-4 py-2.5 text-text-muted">{row.taluka || '—'}</td>
                      <td className="px-4 py-2.5 text-text-muted">{row.district || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{row.farmer_count}</td>
                      <td className="px-4 py-2.5 text-right">{row.plot_count}</td>
                      <td className="px-4 py-2.5 text-right font-bold">{row.acres}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {row.top_crops?.map(([crop, cnt], ci) => (
                            <span key={ci} className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-semibold rounded-md">
                              {crop} ({cnt})
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab: Geo × Crop Matrix ────────────────────────────────────────────────
function TabMatrix({ data }) {
  const matrix = data?.geo_crop_matrix;
  if (!matrix || matrix.villages.length === 0) return (
    <div className="space-y-4">
      <SectionHeader icon={Grid} title="Geographic × Crop Matrix" subtitle="Heatmap of crop distribution across villages" />
      <EmptyState />
    </div>
  );

  const { villages, crops, cells } = matrix;
  const maxVal = Math.max(...villages.flatMap(v => crops.map(c => cells[v]?.[c] || 0)), 1);

  const cellBg = (val) => {
    if (!val) return 'bg-transparent text-text-muted/40';
    const intensity = val / maxVal;
    if (intensity > 0.75) return 'bg-emerald-600 text-white';
    if (intensity > 0.5) return 'bg-emerald-400 text-white';
    if (intensity > 0.25) return 'bg-emerald-200 text-emerald-900';
    return 'bg-emerald-50 text-emerald-700';
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon={Grid} title="Geographic × Crop Matrix"
        subtitle="Cell value = number of active crop seasons. Darker = higher concentration." />

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-auto max-h-[70vh]">
        <table className="text-[11px] border-collapse min-w-max">
          <thead className="sticky top-0 bg-bg z-10">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-text-muted border-b border-r border-border min-w-[120px]">Village</th>
              {crops.map(c => (
                <th key={c} className="px-3 py-2 font-semibold text-text-muted border-b border-border whitespace-nowrap max-w-[80px] truncate" title={c}>
                  {c.length > 10 ? c.slice(0, 9) + '…' : c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {villages.map((village, vi) => (
              <tr key={vi} className="hover:bg-bg/40 transition-colors">
                <td className="px-3 py-2 font-semibold border-r border-border text-text whitespace-nowrap">{village}</td>
                {crops.map(crop => {
                  const val = cells[village]?.[crop] || 0;
                  return (
                    <td key={crop} className={`px-3 py-2 text-center font-bold border-b border-border/30 transition-colors ${cellBg(val)}`}>
                      {val > 0 ? val : '·'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 text-[10px] text-text-muted">
        <span>Intensity scale:</span>
        {['Low', 'Medium', 'High', 'Very High'].map((l, i) => (
          <span key={l} className={`px-2 py-0.5 rounded font-semibold ${['bg-emerald-50 text-emerald-700','bg-emerald-200 text-emerald-900','bg-emerald-400 text-white','bg-emerald-600 text-white'][i]}`}>{l}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Fieldwork Opportunities ─────────────────────────────────────────
function TabOpportunities({ data, navigate }) {
  const opps = data?.fieldwork_opportunities || [];

  return (
    <div className="space-y-6">
      <SectionHeader icon={Star} title="Fieldwork Opportunities"
        subtitle="Top 50 farmer-crop combinations scored by rising market price × cultivated acreage × early growth stage" />

      {opps.length === 0 ? <EmptyState message="No priority opportunities found for the current filters." /> : (
        <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-bold text-text uppercase tracking-wide">Priority Farmer-Crop Shortlist</h3>
            <p className="text-[10px] text-text-muted">Score = Price trend% + (Acres × 5) + Early stage bonus</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-bg">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-text-muted uppercase">#</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-text-muted uppercase">Farmer</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-text-muted uppercase">Village</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-text-muted uppercase">Crop</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-text-muted uppercase">Stage</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-text-muted uppercase">Acres</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-text-muted uppercase">Price Trend</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-text-muted uppercase">Score</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {opps.map((opp, i) => (
                  <tr key={i} className="border-t border-border/60 hover:bg-bg/50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-text-muted">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-text">{opp.farmer_name}</p>
                      <p className="text-[10px] text-text-muted">{opp.mobile}</p>
                    </td>
                    <td className="px-4 py-2.5 text-text-muted">{opp.village}</td>
                    <td className="px-4 py-2.5 font-semibold text-text">{opp.crop_name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-white text-[10px] font-semibold ${opp.stage_seq <= 2 ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                        {opp.stage_name}
                        {opp.stage_seq <= 2 && ' ⭐'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold">{opp.acres}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-bold ${opp.price_trend_pct > 0 ? 'text-success' : opp.price_trend_pct < 0 ? 'text-danger' : 'text-text-muted'}`}>
                        {opp.price_trend_pct > 0 ? '+' : ''}{opp.price_trend_pct}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="px-2.5 py-1 bg-primary text-white font-bold rounded-lg text-[11px]">
                        {opp.score}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => navigate(`/farmers?search=${encodeURIComponent(opp.farmer_name)}`)}
                        className="flex items-center gap-1 text-[10px] text-primary font-semibold hover:underline"
                      >
                        View <ExternalLink size={10} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Village Drill-Down Panel (slide-in) ───────────────────────────────────
function VillageDrillPanel({ village, data, onClose, navigate }) {
  if (!village) return null;
  const geoRows = data?.geo_summary || [];
  const row = geoRows.find(r => r.village === village);
  const seasons = (data?.crop_stage_distribution || []).filter(r =>
    (data?.geo_summary || []).some(g => g.village === village && g.top_crops.some(([c]) => c === r.crop_name))
  );

  return (
    <div className="fixed inset-0 z-40 flex justify-end pointer-events-none">
      <div className="w-full max-w-md h-full bg-surface border-l border-border shadow-2xl flex flex-col pointer-events-auto animate-slide-in-right">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-primary" />
            <h3 className="font-bold text-sm text-text">{village}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-bg rounded-lg text-text-muted"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {row ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-bg rounded-xl p-3 text-center">
                  <p className="text-[10px] text-text-muted uppercase font-semibold">Farmers</p>
                  <p className="text-xl font-bold text-text mt-1">{row.farmer_count}</p>
                </div>
                <div className="bg-bg rounded-xl p-3 text-center">
                  <p className="text-[10px] text-text-muted uppercase font-semibold">Plots</p>
                  <p className="text-xl font-bold text-text mt-1">{row.plot_count}</p>
                </div>
                <div className="bg-bg rounded-xl p-3 text-center">
                  <p className="text-[10px] text-text-muted uppercase font-semibold">Acres</p>
                  <p className="text-xl font-bold text-primary mt-1">{row.acres}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase font-semibold text-text-muted mb-2">Top Crops in {village}</p>
                <div className="space-y-1.5">
                  {row.top_crops?.map(([crop, cnt], i) => (
                    <div key={i} className="flex justify-between items-center px-3 py-2 bg-bg rounded-lg text-xs">
                      <span className="font-semibold text-text">{crop}</span>
                      <span className="px-2 py-0.5 bg-primary/10 text-primary font-bold rounded-full">{cnt} seasons</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => navigate(`/farmers?village=${encodeURIComponent(village)}`)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 transition-all"
              >
                <Users size={14} /> View Farmers in {village}
              </button>
            </>
          ) : (
            <p className="text-xs text-text-muted">No details available.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function CropIntelligence() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const [filters, setFilters] = useState({});
  const [drillVillage, setDrillVillage] = useState(null);

  const fetchData = useCallback(async (appliedFilters = filters) => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (appliedFilters.village)   params.village   = appliedFilters.village;
      if (appliedFilters.taluka)    params.taluka    = appliedFilters.taluka;
      if (appliedFilters.district)  params.district  = appliedFilters.district;
      if (appliedFilters.crop_id)   params.crop_id   = appliedFilters.crop_id;
      if (appliedFilters.stage_name)params.stage_name = appliedFilters.stage_name;
      if (appliedFilters.staff_id)  params.staff_id  = appliedFilters.staff_id;
      const result = await api.getCropIntelligence(params);
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load Crop Intelligence data.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData({});
  }, []);

  const handleApplyFilters = () => fetchData(filters);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text flex items-center gap-2">
            <Sprout className="text-primary" size={22} /> Crop & Geography Intelligence
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Interactive reports on crop patterns, acreage, growth stages, and geographic distribution
          </p>
        </div>
        <button
          onClick={() => fetchData(filters)}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 bg-surface border border-border hover:bg-bg rounded-xl text-xs font-semibold text-text shadow-sm transition-all"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-primary' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <FilterBar
        options={data?.filter_options || {}}
        filters={filters}
        onChange={setFilters}
        onApply={handleApplyFilters}
        loading={loading}
      />

      {/* Tab Bar */}
      <div className="flex bg-surface border border-border rounded-2xl p-1 gap-1 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                active ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text hover:bg-bg'
              }`}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-surface border border-border rounded-2xl" />
            ))}
          </div>
          <div className="h-64 bg-surface border border-border rounded-2xl" />
        </div>
      )}

      {!loading && error && (
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
          <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-danger">Failed to load data</p>
            <p className="text-xs text-text-muted mt-1">{error}</p>
            <button
              onClick={() => fetchData(filters)}
              className="mt-3 px-4 py-1.5 bg-danger text-white text-xs font-semibold rounded-lg"
            >Retry</button>
          </div>
        </div>
      )}

      {!loading && !error && data && (
        <div className="pb-8">
          {activeTab === 'overview'      && <TabOverview data={data} />}
          {activeTab === 'acreage'       && <TabAcreage data={data} />}
          {activeTab === 'stages'        && <TabStages data={data} />}
          {activeTab === 'geo'           && <TabGeo data={data} onDrillVillage={setDrillVillage} />}
          {activeTab === 'matrix'        && <TabMatrix data={data} />}
          {activeTab === 'opportunities' && <TabOpportunities data={data} navigate={navigate} />}
        </div>
      )}

      {/* Village Drill Panel */}
      {drillVillage && (
        <VillageDrillPanel
          village={drillVillage}
          data={data}
          onClose={() => setDrillVillage(null)}
          navigate={navigate}
        />
      )}
    </div>
  );
}
