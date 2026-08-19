import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, ChevronRight, Trash2, X, Edit2, Map as MapIcon, List } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';

// Fix leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

import { useAuth } from '../components/AuthProvider';

function TerritoryNode({ territory, depth = 0, onDelete, onEdit, isAdmin }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasSubs = territory.sub_territories && territory.sub_territories.length > 0;

  return (
    <div style={{ marginLeft: depth * 20 }}>
      <div className={`flex items-center justify-between px-4 py-3 rounded-lg mb-1 transition-colors ${depth === 0 ? 'bg-surface border border-border' : 'hover:bg-bg'}`}>
        <div className="flex items-center gap-2">
          {hasSubs && (
            <button onClick={() => setExpanded(!expanded)} className="text-text-muted hover:text-text">
              <ChevronRight size={14} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
          )}
          {!hasSubs && <span className="w-3.5" />}
          <span className={`text-sm ${depth === 0 ? 'font-heading font-semibold' : 'font-medium'}`}>{territory.name}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span>{territory.farmer_count} farmers</span>
          <span className={`badge ${territory.status === 'Active' ? 'badge-active' : 'badge-inactive'}`}>{territory.status}</span>
          {isAdmin && (
            <>
              <button 
                onClick={() => onEdit(territory)}
                className="p-1 hover:text-primary transition-colors cursor-pointer"
                title="Edit Territory"
              >
                <Edit2 size={14} />
              </button>
              <button 
                onClick={() => onDelete(territory)}
                className="p-1 hover:text-danger transition-colors cursor-pointer"
                title="Delete Territory"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>
      {expanded && hasSubs && territory.sub_territories.map(sub => (
        <TerritoryNode key={sub.id} territory={sub} depth={depth + 1} onDelete={onDelete} onEdit={onEdit} isAdmin={isAdmin} />
      ))}
    </div>
  );
}

export default function TerritoryManagement() {
  const { isAdmin } = useAuth();
  const [territories, setTerritories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', parent_territory: '' });
  const [allTerritories, setAllTerritories] = useState([]);
  const [viewMode, setViewMode] = useState('list');


  const fetchTerritories = async (forceFresh = true) => {
    try {
      const data = await api.getTerritories(forceFresh);
      const list = Array.isArray(data) ? data : data.results || [];
      setAllTerritories(list);
      setTerritories(list.filter(t => !t.parent_territory));
    } catch { setTerritories([]); }
    setLoading(false);
  };


  useEffect(() => { fetchTerritories(); }, []);

  const handleDelete = async (t) => {
    const message = t.farmer_count > 0 
      ? `This territory has ${t.farmer_count} farmers and sub-territories. Deleting it will reassign or remove access. Are you sure you want to permanently delete "${t.name}"?`
      : `Are you sure you want to permanently delete "${t.name}"?`;
      
    if (window.confirm(message)) {
      try {
        await api.deleteTerritory(t.id);
        fetchTerritories();
      } catch (err) {
        alert(err.error || 'Failed to delete territory. It might have active dependencies.');
      }
    }
  };

  const handleEdit = (t) => {
    setForm({ name: t.name, parent_territory: t.parent_territory || '' });
    setEditingId(t.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name ? form.name.trim() : '',
        parent_territory: form.parent_territory && form.parent_territory !== 'null' ? form.parent_territory : null
      };
      
      if (editingId) {
        await api.updateTerritory(editingId, payload);
      } else {
        await api.createTerritory(payload);
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ name: '', parent_territory: '' });
      fetchTerritories();
    } catch (err) {
      let errMsg = 'Failed to save territory';
      if (typeof err === 'string') {
        errMsg = err;
      } else if (err?.detail) {
        errMsg = err.detail;
      } else if (err?.error) {
        errMsg = err.error;
      } else if (err && typeof err === 'object') {
        const details = [];
        Object.keys(err).forEach(k => {
          if (k !== 'status') {
            const val = Array.isArray(err[k]) ? err[k].join(', ') : err[k];
            details.push(`${k}: ${val}`);
          }
        });
        if (details.length > 0) errMsg = details.join(' | ');
      }
      alert(errMsg);
    }
  };



  // Generate mock coordinates for the map display if real coordinates don't exist
  // We place points randomly around a central location (e.g. India)
  const mapCenter = [20.5937, 78.9629];
  const getMockPosition = (id, index) => {
    // Deterministic jitter based on index
    const jitterLat = (Math.sin(index * 10) * 5);
    const jitterLng = (Math.cos(index * 10) * 5);
    return [mapCenter[0] + jitterLat, mapCenter[1] + jitterLng];
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-heading font-bold text-text">Territory Management</h2>
        <div className="flex items-center gap-3">
          <div className="flex bg-surface border border-border rounded-lg p-1">
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded flex items-center gap-1 ${viewMode === 'list' ? 'bg-bg text-primary shadow-sm' : 'text-text-muted hover:text-text'}`}
              title="List View"
            >
              <List size={16} />
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`p-1.5 rounded flex items-center gap-1 ${viewMode === 'map' ? 'bg-bg text-primary shadow-sm' : 'text-text-muted hover:text-text'}`}
              title="Map View"
            >
              <MapIcon size={16} />
            </button>
          </div>
          {isAdmin && (
            <button onClick={() => {
              setEditingId(null);
              setForm({ name: '', parent_territory: '' });
              setShowForm(!showForm);
            }}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-medium text-sm btn-press transition-colors">
              <Plus size={16} /> Add Territory
            </button>
          )}
        </div>
      </div>

      {isAdmin && showForm && (
        <div className="card p-6 mb-6 animate-stagger-in shadow-lg border-2 border-primary/20">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-heading font-semibold text-text">{editingId ? 'Edit Territory' : 'Create New Territory'}</h3>
            <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-text">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Territory Name</label>
              <input placeholder="Enter name..." value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Parent Territory (Required unless Root/Zonal Manager)</label>
              <select value={form.parent_territory} onChange={e => setForm({...form, parent_territory: e.target.value})} required
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none">
                <option value="">-- Select Parent Territory --</option>
                <option value="null">-- Root (Zonal Manager) --</option>
                {[...allTerritories]
                  .filter(t => !editingId || t.id !== editingId)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>

            </div>
            <button type="submit" className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg font-medium text-sm btn-press">
              {editingId ? 'Update Territory' : 'Create Territory'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="card p-12 text-center text-text-muted">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
          <p>Loading territories...</p>
        </div>
      ) : allTerritories.length === 0 ? (
        <div className="card p-12 text-center text-text-muted bg-bg/50 border-dashed">
          No territories configured. {isAdmin ? 'Create your first region above to start building the hierarchy.' : 'Contact an Admin user to set up territories.'}
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-2">
          {territories.map(t => (
            <TerritoryNode key={t.id} territory={t} onDelete={handleDelete} onEdit={handleEdit} isAdmin={isAdmin} />
          ))}
        </div>

      ) : (
        <div className="card overflow-hidden h-[600px] border border-border relative z-0">
          <MapContainer center={mapCenter} zoom={5} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {allTerritories.map((t, index) => {
              // Usually we'd use t.location coordinates here if they exist
              const pos = getMockPosition(t.id, index);
              return (
                <Marker key={t.id} position={pos}>
                  <Tooltip permanent direction="top" offset={[0, -20]} className="font-semibold text-sm drop-shadow-md">
                    {t.name}
                  </Tooltip>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
