import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { Plus, Upload, Search, Download, Edit2, Trash2, X, Map, ChevronLeft, ChevronRight } from 'lucide-react';
import ImportWizard from '../components/ImportWizard';
import PlotManagementModal from '../components/PlotManagementModal';

export default function FarmerManagement() {
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const PAGE_SIZE = 50;

  const [showWizard, setShowWizard] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedFarmerForPlots, setSelectedFarmerForPlots] = useState(null);
  const [form, setForm] = useState({
    full_name: '', primary_mobile: '', pin_code: '', email: '', village: '', district: '', taluka: '', state: ''
  });
  const [villages, setVillages] = useState([]);

  const handlePinCodeChange = async (e) => {
    const pin = e.target.value;
    setForm({ ...form, pin_code: pin });
    if (pin.length === 6) {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
        const data = await res.json();
        if (data && data[0] && data[0].Status === 'Success') {
          const postOffices = data[0].PostOffice;
          const district = postOffices[0].District;
          const state = postOffices[0].State;
          const taluka = postOffices[0].Block || postOffices[0].Taluk || district;
          setVillages(postOffices.map(po => po.Name));
          setForm(prev => ({
            ...prev,
            pin_code: pin,
            district,
            state,
            taluka,
            village: postOffices[0].Name
          }));
        } else {
          setVillages([]);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const searchTimer = useRef(null);

  const fetchFarmers = useCallback(async (pageNum = 1, searchTerm = '') => {
    setLoading(true);
    try {
      const params = { page: pageNum, page_size: PAGE_SIZE };
      if (searchTerm) params.search = searchTerm;

      // Pass crop/stage from URL if present
      const crop = searchParams.get('crop');
      const stage = searchParams.get('stage');
      const enrolled = searchParams.get('enrolled');
      const hasActiveCrops = searchParams.get('has_active_crops');
      const hasPlots = searchParams.get('has_plots');
      if (crop) params.crop = crop;
      if (stage) params.stage = stage;
      if (enrolled) params.enrolled = enrolled;
      if (hasActiveCrops) params.has_active_crops = hasActiveCrops;
      if (hasPlots) params.has_plots = hasPlots;

      const data = await api.getFarmers(params);
      if (data && data.results) {
        setFarmers(data.results);
        setTotalCount(data.count || 0);
        setHasNext(!!data.next);
        setHasPrev(!!data.previous);
      } else {
        setFarmers(Array.isArray(data) ? data : []);
        setTotalCount(Array.isArray(data) ? data.length : 0);
        setHasNext(false);
        setHasPrev(false);
      }
    } catch { setFarmers([]); }
    setLoading(false);
  }, [searchParams]);

  useEffect(() => {
    fetchFarmers(1, search);
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    setPage(1);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchFarmers(1, val), 400);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchFarmers(newPage, search);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExport = () => api.exportFarmers();

  const handleDisable = async (id) => {
    if (!confirm('Are you sure you want to disable this farmer?')) return;
    try {
      await api.disableFarmer(id);
      fetchFarmers(page, search);
    } catch (e) {
      alert(e.error || 'Failed to disable farmer');
    }
  };

  const handleEdit = (farmer) => {
    setForm({
      full_name: farmer.full_name || '',
      primary_mobile: farmer.primary_mobile || '',
      pin_code: farmer.pin_code || '',
      email: farmer.email || '',
      village: farmer.village || '',
      district: farmer.district || '',
      taluka: farmer.taluka || '',
      state: farmer.state || ''
    });
    setVillages([]);
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
      fetchFarmers(page, search);
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

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const startItem = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-heading font-bold text-text">Farmer Management</h2>
          {!loading && <p className="text-xs text-text-muted mt-0.5">{totalCount} farmers total</p>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} className="flex items-center gap-2 bg-surface hover:bg-bg text-text-muted hover:text-text px-4 py-2 border border-border rounded-lg font-medium text-sm cursor-pointer btn-press transition-colors">
            <Download size={16} /> Export
          </button>
          <button onClick={() => setShowWizard(true)} className="flex items-center gap-2 bg-accent hover:bg-accent-light text-white px-4 py-2 rounded-lg font-medium text-sm cursor-pointer btn-press transition-colors">
            <Upload size={16} /> Bulk Import Excel
          </button>
          <button
            onClick={() => {
              setEditingId(null);
              setForm({ full_name: '', primary_mobile: '', pin_code: '', email: '', village: '', district: '', taluka: '', state: '' });
              setVillages([]);
              setShowForm(true);
            }}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-medium text-sm cursor-pointer btn-press transition-colors"
          >
            <Plus size={16} /> Add Farmer
          </button>
        </div>
      </div>

      {showWizard && (
        <ImportWizard onClose={() => setShowWizard(false)} onComplete={() => fetchFarmers(1, search)} />
      )}

      {showForm && (
        <div className="card p-6 mb-6 animate-stagger-in shadow-lg border-2 border-primary/20">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-heading font-semibold text-text">{editingId ? 'Edit Farmer' : 'Add New Farmer'}</h3>
            <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-text"><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Full Name *</label>
              <input required placeholder="Enter name..." value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Primary Mobile *</label>
              <input required placeholder="10-digit mobile number" value={form.primary_mobile} onChange={e => setForm({...form, primary_mobile: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">PIN Code *</label>
              <input required placeholder="PIN Code..." value={form.pin_code} onChange={handlePinCodeChange} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Email (Optional)</label>
              <input type="email" placeholder="Email address" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Village *</label>
              {villages.length > 1 ? (
                <select required value={form.village} onChange={e => setForm({...form, village: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none">
                  {villages.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              ) : (
                <input required placeholder="Village..." value={form.village} onChange={e => setForm({...form, village: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Taluka *</label>
              <input required placeholder="Taluka..." value={form.taluka} onChange={e => setForm({...form, taluka: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">District *</label>
              <input required placeholder="District..." value={form.district} onChange={e => setForm({...form, district: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">State *</label>
              <input required placeholder="State..." value={form.state} onChange={e => setForm({...form, state: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div className="md:col-span-3 flex justify-end mt-2">
              <button type="submit" className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg font-medium text-sm btn-press">
                {editingId ? 'Update Farmer' : 'Save Farmer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Server-side Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Search by name, village, or mobile..."
          value={search}
          onChange={handleSearchChange}
          className="w-full pl-9 pr-10 py-2.5 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}
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
              <tr>
                <td colSpan="7" className="text-center py-10 text-text-muted">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Loading farmers...
                  </div>
                </td>
              </tr>
            ) : farmers.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-10 text-text-muted">No farmers found.</td></tr>
            ) : farmers.map((farmer, i) => (
              <tr key={farmer.id} className="animate-stagger-in" style={{ animationDelay: `${i * 15}ms` }}>
                <td className="font-medium">{farmer.full_name}</td>
                <td className="font-mono text-xs">{farmer.primary_mobile}</td>
                <td>{farmer.village}</td>
                <td>{farmer.district || '—'}</td>
                <td>
                  <span className={`badge ${farmer.source === 'BulkImport' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                    {farmer.source}
                  </span>
                </td>
                <td>
                  <span className={`badge ${farmer.status === 'Active' ? 'badge-active' : 'badge-inactive'}`}>
                    {farmer.status}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => handleEdit(farmer)} className="p-1 hover:text-primary transition-colors cursor-pointer" title="Edit Farmer">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => setSelectedFarmerForPlots(farmer)} className="p-1 hover:text-success transition-colors cursor-pointer" title="Manage Plots">
                      <Map size={14} />
                    </button>
                    {farmer.status === 'Active' && (
                      <button onClick={() => handleDisable(farmer.id)} className="p-1 hover:text-danger transition-colors cursor-pointer" title="Disable Farmer">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination Controls */}
        {totalCount > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-bg/50">
            <p className="text-xs text-text-muted">
              Showing <span className="font-semibold text-text">{startItem}–{endItem}</span> of{' '}
              <span className="font-semibold text-text">{totalCount}</span> farmers
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={!hasPrev}
                className="p-1.5 rounded-lg border border-border hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p;
                if (totalPages <= 5) p = i + 1;
                else if (page <= 3) p = i + 1;
                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                else p = page - 2 + i;
                return (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium border transition-colors ${p === page ? 'bg-primary text-white border-primary' : 'border-border hover:bg-surface'}`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={!hasNext}
                className="p-1.5 rounded-lg border border-border hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
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
