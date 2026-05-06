import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { Plus, Upload, Search, Download, Edit2, Trash2, X, Map } from 'lucide-react';
import ImportWizard from '../components/ImportWizard';
import PlotManagementModal from '../components/PlotManagementModal';

export default function FarmerManagement() {
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [showWizard, setShowWizard] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedFarmerForPlots, setSelectedFarmerForPlots] = useState(null);
  const [form, setForm] = useState({
    full_name: '', primary_mobile: '', village: '', district: '', taluka: '', state: '', pin_code: ''
  });

  const fetchFarmers = async () => {
    try {
      const data = await api.getFarmers();
      setFarmers(Array.isArray(data) ? data : data.results || []);
    } catch { setFarmers([]); }
    setLoading(false);
  };

  useEffect(() => { fetchFarmers(); }, []);

  const handleExport = () => {
    api.exportFarmers();
  };

  const handleDisable = async (id) => {
    if (!confirm('Are you sure you want to disable this farmer?')) return;
    try {
      await api.disableFarmer(id);
      fetchFarmers();
    } catch (e) {
      alert(e.error || 'Failed to disable farmer');
    }
  };

  const handleEdit = (farmer) => {
    setForm({
      full_name: farmer.full_name || '',
      primary_mobile: farmer.primary_mobile || '',
      village: farmer.village || '',
      district: farmer.district || '',
      taluka: farmer.taluka || '',
      state: farmer.state || '',
      pin_code: farmer.pin_code || ''
    });
    setEditingId(farmer.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.updateFarmer(editingId, form);
      } else {
        await api.createFarmer(form);
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ full_name: '', primary_mobile: '', village: '', district: '', taluka: '', state: '', pin_code: '' });
      fetchFarmers();
    } catch (e) {
      console.error(e);
      let errorMsg = 'Failed to save farmer details';
      if (typeof e === 'object' && e !== null) {
        if (e.error) errorMsg = e.error;
        else {
           const errors = [];
           Object.keys(e).forEach(k => {
             if (k !== 'status' && Array.isArray(e[k])) errors.push(`${k}: ${e[k].join(', ')}`);
             else if (k !== 'status' && typeof e[k] === 'string') errors.push(`${k}: ${e[k]}`);
           });
           if (errors.length > 0) errorMsg = errors.join('\n');
        }
      }
      alert(errorMsg);
    }
  };

  const filtered = farmers.filter(f =>
    f.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    f.village?.toLowerCase().includes(search.toLowerCase()) ||
    f.primary_mobile?.includes(search) ||
    f.assigned_staff_mobile?.includes(search)
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-heading font-bold text-text">Farmer Management</h2>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-surface hover:bg-bg text-text-muted hover:text-text px-4 py-2 border border-border rounded-lg font-medium text-sm cursor-pointer btn-press transition-colors"
          >
            <Download size={16} />
            Export
          </button>
          <button 
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 bg-accent hover:bg-accent-light text-white px-4 py-2 rounded-lg font-medium text-sm cursor-pointer btn-press transition-colors"
          >
            <Upload size={16} />
            Bulk Import Excel
          </button>
          <button 
            onClick={() => {
              setEditingId(null);
              setForm({ full_name: '', primary_mobile: '', village: '', district: '', taluka: '', state: '' });
              setShowForm(true);
            }}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-medium text-sm cursor-pointer btn-press transition-colors"
          >
            <Plus size={16} />
            Add Farmer
          </button>
        </div>
      </div>

      {showWizard && (
        <ImportWizard 
          onClose={() => setShowWizard(false)} 
          onComplete={fetchFarmers} 
        />
      )}

      {showForm && (
        <div className="card p-6 mb-6 animate-stagger-in shadow-lg border-2 border-primary/20">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-heading font-semibold text-text">{editingId ? 'Edit Farmer' : 'Add New Farmer'}</h3>
            <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-text">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Full Name</label>
              <input placeholder="Enter name..." value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Primary Mobile</label>
              <input placeholder="10-digit mobile number" value={form.primary_mobile} onChange={e => setForm({...form, primary_mobile: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" required minLength={10} maxLength={10} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Village</label>
              <input placeholder="Village..." value={form.village} onChange={e => setForm({...form, village: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Taluka*</label>
              <input placeholder="Taluka..." value={form.taluka} onChange={e => setForm({...form, taluka: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">District*</label>
              <input placeholder="District..." value={form.district} onChange={e => setForm({...form, district: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">State*</label>
              <input placeholder="State..." value={form.state} onChange={e => setForm({...form, state: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">PIN Code*</label>
              <input placeholder="PIN Code..." value={form.pin_code} onChange={e => setForm({...form, pin_code: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" required />
            </div>
            <div className="md:col-span-3 flex justify-end mt-2">
              <button type="submit" className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg font-medium text-sm btn-press">
                {editingId ? 'Update Farmer' : 'Save Farmer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text" placeholder="Search by name, village, or mobile..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
        />
      </div>

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>Village</th>
              <th>District</th>
              <th>Source</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="text-center py-8 text-text-muted">Loading farmers...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-8 text-text-muted">No farmers found.</td></tr>
            ) : filtered.slice(0, 100).map((farmer, i) => (
              <tr key={farmer.id} className="animate-stagger-in" style={{ animationDelay: `${i * 30}ms` }}>
                <td className="font-medium">{farmer.full_name}</td>
                <td className="font-mono text-xs">{farmer.primary_mobile}</td>
                <td>{farmer.village}</td>
                <td>{farmer.district || '—'}</td>
                <td><span className={`badge ${farmer.source === 'BulkImport' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>{farmer.source}</span></td>
                <td><span className={`badge ${farmer.status === 'Active' ? 'badge-active' : 'badge-inactive'}`}>{farmer.status}</span></td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => handleEdit(farmer)}
                      className="p-1 hover:text-primary transition-colors cursor-pointer"
                      title="Edit Farmer"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => setSelectedFarmerForPlots(farmer)}
                      className="p-1 hover:text-success transition-colors cursor-pointer"
                      title="Manage Plots"
                    >
                      <Map size={14} />
                    </button>
                    {farmer.status === 'Active' && (
                      <button 
                        onClick={() => handleDisable(farmer.id)}
                        className="p-1 hover:text-danger transition-colors cursor-pointer"
                        title="Disable Farmer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 100 && <p className="text-center text-xs text-text-muted py-3">Showing first 100 of {filtered.length} results</p>}
      </div>

      {selectedFarmerForPlots && (
        <PlotManagementModal 
          farmer={selectedFarmerForPlots} 
          onClose={() => setSelectedFarmerForPlots(null)} 
        />
      )}
    </div>
  );
}
