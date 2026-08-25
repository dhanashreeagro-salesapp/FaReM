import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Settings as SettingsIcon, Save, Check } from 'lucide-react';

export default function SettingsPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await api.getConfig();
        setConfig(data);
      } catch { /* not admin */ }
      setLoading(false);
    };
    fetchConfig();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const updated = await api.updateConfig(config);
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* handled */ }
    setSaving(false);
  };

  if (loading) return <div className="card p-8 text-center text-text-muted">Loading settings...</div>;
  if (!config) return <div className="card p-8 text-center text-text-muted">Settings not available.</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon size={20} className="text-primary" />
        <h2 className="text-xl font-heading font-bold text-text">System Settings</h2>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
        {/* Visit Norms */}
        <div className="card p-6 animate-stagger-in">
          <h3 className="font-heading font-semibold text-text mb-4">Visit Frequency Settings</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Visit Frequency Norm (days)</label>
              <input type="number" min="1" max="90" value={config.visit_frequency_norm_days}
                onChange={e => setConfig({...config, visit_frequency_norm_days: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
              <p className="text-xs text-text-muted mt-1">A farmer is marked "overdue" after this many days without a visit.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Smart Planner Refresh Hour (0-23)</label>
              <input type="number" min="0" max="23" value={config.planner_refresh_hour}
                onChange={e => setConfig({...config, planner_refresh_hour: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
              <p className="text-xs text-text-muted mt-1">Hour of day (IST) when the daily visit planner refreshes for all staff.</p>
            </div>
          </div>
        </div>

        {/* Content & Promotion Governance */}
        <div className="card p-6 animate-stagger-in" style={{ animationDelay: '15ms' }}>
          <h3 className="font-heading font-semibold text-text mb-4">Content & Promotion Governance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Weekly Content Admin Promotion Limit</label>
              <input type="number" min="1" max="50" value={config.content_admin_weekly_promotion_limit || 2}
                onChange={e => setConfig({...config, content_admin_weekly_promotion_limit: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
              <p className="text-xs text-text-muted mt-1">Maximum number of centralized promotions a farmer can receive per week.</p>
            </div>
          </div>
        </div>

        {/* GPS & Location Validation Settings */}
        <div className="card p-6 animate-stagger-in" style={{ animationDelay: '30ms' }}>
          <h3 className="font-heading font-semibold text-text mb-4">GPS Proximity & Visit Validation Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Visit Validation Radius (meters)</label>
              <select
                value={config.visit_radius_meters || 150}
                onChange={e => setConfig({...config, visit_radius_meters: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value={50}>50 metres</option>
                <option value={100}>100 metres</option>
                <option value={150}>150 metres (Default)</option>
                <option value={250}>250 metres</option>
                <option value={500}>500 metres</option>
                <option value={1000}>1000 metres (1 km)</option>
              </select>
              <p className="text-xs text-text-muted mt-1">Maximum allowed distance between staff GPS location and plot location during field visits.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">GPS Validation Mode</label>
              <select
                value={config.gps_validation_mode || 'Warning'}
                onChange={e => setConfig({...config, gps_validation_mode: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none font-semibold"
              >
                <option value="Strict">Strict (Block save if outside radius)</option>
                <option value="Warning">Warning (Flag outside radius but permit save)</option>
                <option value="Disabled">Disabled (No distance check for testing)</option>
              </select>
              <p className="text-xs text-text-muted mt-1">Control whether distance validation strictly blocks field visit saves or only logs warning flags.</p>
            </div>
          </div>
        </div>

        {/* Gateway Config */}
        <div className="card p-6 animate-stagger-in" style={{ animationDelay: '60ms' }}>
          <h3 className="font-heading font-semibold text-text mb-4">Gateway Credentials</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Active SMS Provider</label>
              <select
                value={config.active_sms_provider || 'STPL'}
                onChange={e => setConfig({...config, active_sms_provider: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface font-semibold focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="STPL">STPL (Recommended)</option>
                <option value="MSG91">MSG91</option>
              </select>
            </div>
            {config.active_sms_provider === 'STPL' ? (
              <div className="space-y-4 p-4 border border-border rounded-lg bg-bg/50">
                <h4 className="font-semibold text-sm">STPL Configuration</h4>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">STPL API URL</label>
                  <input type="text" value={config.stpl_api_url || ''} placeholder="https://www.smsgatewayhub.com/api/mt/SendSMS"
                    onChange={e => setConfig({...config, stpl_api_url: e.target.value})}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">STPL API Key</label>
                  <input type="password" value={config.stpl_api_key || ''} placeholder="Enter STPL API key"
                    onChange={e => setConfig({...config, stpl_api_key: e.target.value})}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface font-mono focus:ring-2 focus:ring-primary focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Sender ID (DLT Approved)</label>
                  <input type="text" value={config.stpl_sender_id || ''} placeholder="e.g. FRMNUI" maxLength="6"
                    onChange={e => setConfig({...config, stpl_sender_id: e.target.value})}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none uppercase" />
                </div>
              </div>
            ) : (
              <div className="space-y-4 p-4 border border-border rounded-lg bg-bg/50">
                <h4 className="font-semibold text-sm">MSG91 Configuration</h4>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">MSG91 Auth Key</label>
                  <input type="password" value={config.msg91_auth_key || ''} placeholder="Enter MSG91 auth key"
                    onChange={e => setConfig({...config, msg91_auth_key: e.target.value})}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface font-mono focus:ring-2 focus:ring-primary focus:outline-none" />
                </div>
              </div>
            )}
            <div className="pt-2 border-t border-border">
              <label className="block text-sm font-medium text-text-muted mb-1">Interakt API Key (WhatsApp)</label>
              <input type="password" value={config.interakt_api_key || ''} placeholder="Enter Interakt API key"
                onChange={e => setConfig({...config, interakt_api_key: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface font-mono focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Interakt Generic Template Name</label>
              <input type="text" value={config.interakt_template_name || ''} placeholder="farmer_alert_01"
                onChange={e => setConfig({...config, interakt_template_name: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
              <p className="text-xs text-text-muted mt-1">Default Template Name approved on DLT/Interakt for broadcast messages.</p>
            </div>
            <div className="pt-2 border-t border-border">
              <label className="block text-sm font-medium text-text-muted mb-1">Cloudinary URL</label>
              <input type="text" value={config.cloudinary_url || ''} placeholder="cloudinary://API_KEY:API_SECRET@CLOUD_NAME"
                onChange={e => setConfig({...config, cloudinary_url: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface font-mono focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all btn-press ${
            saved ? 'bg-success text-white' : 'bg-primary hover:bg-primary-dark text-white'
          } disabled:opacity-50`}>
          {saved ? <><Check size={16} /> Saved!</> : saving ? 'Saving...' : <><Save size={16} /> Save Settings</>}
        </button>

        {config.updated_at && (
          <p className="text-xs text-text-muted">Last updated: {new Date(config.updated_at).toLocaleString('en-IN')}</p>
        )}
      </form>
    </div>
  );
}
