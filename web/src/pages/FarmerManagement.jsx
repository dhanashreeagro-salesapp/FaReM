import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { Plus, Upload, Search, Download, Edit2, Trash2, X, Map, ChevronLeft, ChevronRight, MessageSquare, UserCheck, Filter, RotateCcw, MapPin, PhoneCall, Award, History, BarChart2 } from 'lucide-react';
import ImportWizard from '../components/ImportWizard';
import PlotManagementModal from '../components/PlotManagementModal';
import SendMessageModal from '../components/SendMessageModal';
import BulkReassignModal from '../components/BulkReassignModal';
import LogVisitModal from '../components/LogVisitModal';
import CallLogModal from '../components/CallLogModal';
import RecommendationModal from '../components/RecommendationModal';
import FarmerTimeline from '../components/FarmerTimeline';
import WeeklyVisitSummary from '../components/WeeklyVisitSummary';


export default function FarmerManagement() {
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  
  // Search & Filter State
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [filterPinCode, setFilterPinCode] = useState('');
  const [filterVillage, setFilterVillage] = useState('');
  const [filterTaluka, setFilterTaluka] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterTerritory, setFilterTerritory] = useState('');
  const [filterStaff, setFilterStaff] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const PAGE_SIZE = 50;

  // Modals & Selection State
  const [showWizard, setShowWizard] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showSendMessage, setShowSendMessage] = useState(false);
  const [showBulkReassign, setShowBulkReassign] = useState(false);
  const [selectedFarmerForVisit, setSelectedFarmerForVisit] = useState(null);
  const [selectedFarmerForCall, setSelectedFarmerForCall] = useState(null);
  const [selectedFarmerForRecommend, setSelectedFarmerForRecommend] = useState(null);
  const [selectedFarmerForTimeline, setSelectedFarmerForTimeline] = useState(null);
  const [showWeeklySummary, setShowWeeklySummary] = useState(false);
  const [selectedFarmers, setSelectedFarmers] = useState([]);
  const [isSelectingAll, setIsSelectingAll] = useState(false);

  
  const [editingId, setEditingId] = useState(null);
  const [selectedFarmerForPlots, setSelectedFarmerForPlots] = useState(null);
  const [form, setForm] = useState({
    full_name: '', primary_mobile: '', pin_code: '', email: '', village: '', district: '', taluka: '', state: '', assigned_staff: ''
  });
  const [villages, setVillages] = useState([]);
  
  // Options lists for dropdowns
  const [staffUsers, setStaffUsers] = useState([]);
  const [territories, setTerritories] = useState([]);

  useEffect(() => {
    async function loadOptions() {
      try {
        const usersData = await api.getUsers();
        setStaffUsers(Array.isArray(usersData) ? usersData : (usersData.results || []));
        const terrData = await api.getTerritories();
        setTerritories(Array.isArray(terrData) ? terrData : (terrData.results || []));
      } catch (err) {
        console.error("Failed to load options:", err);
      }
    }
    loadOptions();
  }, []);

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

  const buildQueryParams = useCallback((pageNum = 1) => {
    const params = { page: pageNum, page_size: PAGE_SIZE };
    if (search) params.search = search;
    if (filterPinCode) params.pin_code = filterPinCode;
    if (filterVillage) params.village = filterVillage;
    if (filterTaluka) params.taluka = filterTaluka;
    if (filterDistrict) params.district = filterDistrict;
    if (filterTerritory) params.territory = filterTerritory;
    if (filterStaff) params.assigned_staff = filterStaff;

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

    return params;
  }, [search, filterPinCode, filterVillage, filterTaluka, filterDistrict, filterTerritory, filterStaff, searchParams]);

  const fetchFarmers = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      const params = buildQueryParams(pageNum);
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
    } catch (err) { 
      console.error(err);
      setFarmers([]); 
    }
    setLoading(false);
  }, [buildQueryParams]);

  useEffect(() => {
    fetchFarmers(1);
  }, [fetchFarmers]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    setPage(1);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchFarmers(1), 400);
  };

  const handleClearFilters = () => {
    setSearch('');
    setFilterPinCode('');
    setFilterVillage('');
    setFilterTaluka('');
    setFilterDistrict('');
    setFilterTerritory('');
    setFilterStaff('');
    setPage(1);
    api.getFarmers({ page: 1, page_size: PAGE_SIZE }).then(data => {
      if (data && data.results) {
        setFarmers(data.results);
        setTotalCount(data.count || 0);
        setHasNext(!!data.next);
        setHasPrev(!!data.previous);
      }
    }).catch(err => console.error("Clear filters error:", err));
  };


  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchFarmers(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectAll = async (e) => {
    const checked = e.target.checked;
    setIsSelectingAll(checked);
    if (checked) {
      setLoading(true);
      try {
        const params = buildQueryParams(1);
        delete params.page;
        delete params.page_size;
        const data = await api.getFarmerIds(params);
        setSelectedFarmers(data);
      } catch (err) {
        alert('Failed to select all farmers');
      } finally {
        setLoading(false);
      }
    } else {
      setSelectedFarmers([]);
    }
  };

  const handleSelectFarmer = (id, checked) => {
    if (checked) {
      setSelectedFarmers(prev => [...prev, id]);
    } else {
      setSelectedFarmers(prev => prev.filter(fid => fid !== id));
      setIsSelectingAll(false);
    }
  };

  const handleExport = () => api.exportFarmers();

  const handleDisable = async (id) => {
    if (!confirm('Are you sure you want to disable this farmer?')) return;
    try {
      await api.disableFarmer(id);
      fetchFarmers(page);
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
      state: farmer.state || '',
      assigned_staff: farmer.assigned_staff || ''
    });
    setVillages([]);
    setEditingId(farmer.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      if (!payload.assigned_staff) delete payload.assigned_staff;

      if (editingId) {
        await api.updateFarmer(editingId, payload);
      } else {
        await api.createFarmer(payload);
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ full_name: '', primary_mobile: '', village: '', district: '', taluka: '', state: '', pin_code: '', assigned_staff: '' });
      fetchFarmers(page);
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

  const hasActiveFilters = search || filterPinCode || filterVillage || filterTaluka || filterDistrict || filterTerritory || filterStaff;

  return (
    <div>
      {/* Page Header */}
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
              setForm({ full_name: '', primary_mobile: '', pin_code: '', email: '', village: '', district: '', taluka: '', state: '', assigned_staff: '' });
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
        <ImportWizard onClose={() => setShowWizard(false)} onComplete={() => fetchFarmers(1)} />
      )}

      {/* Add / Edit Farmer Modal */}
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
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Assigned Field Staff</label>
              <select value={form.assigned_staff || ''} onChange={e => setForm({...form, assigned_staff: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none">
                <option value="">Unassigned</option>
                {staffUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}` : u.email} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3 flex justify-end mt-2">
              <button type="submit" className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg font-medium text-sm btn-press">
                {editingId ? 'Update Farmer' : 'Save Farmer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="card p-4 mb-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search by name, village, taluka, district, or mobile..."
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-10 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg font-medium text-sm transition-colors cursor-pointer ${
              showFilters || hasActiveFilters ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-surface text-text-muted hover:text-text'
            }`}
          >
            <Filter size={16} /> Filters {hasActiveFilters && '•'}
          </button>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-text-muted hover:text-danger rounded-lg border border-border hover:bg-bg transition-colors"
              title="Clear all filters"
            >
              <RotateCcw size={14} /> Clear
            </button>
          )}
        </div>

        {/* Extended Filter Panel */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-border animate-fade-in">
            <div>
              <label className="block text-[11px] font-semibold text-text-muted mb-1">PIN Code</label>
              <input
                type="text"
                placeholder="e.g. 413001"
                value={filterPinCode}
                onChange={e => setFilterPinCode(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-border rounded-md text-xs bg-bg focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-text-muted mb-1">Village</label>
              <input
                type="text"
                placeholder="Village name..."
                value={filterVillage}
                onChange={e => setFilterVillage(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-border rounded-md text-xs bg-bg focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-text-muted mb-1">Taluka</label>
              <input
                type="text"
                placeholder="Taluka name..."
                value={filterTaluka}
                onChange={e => setFilterTaluka(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-border rounded-md text-xs bg-bg focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-text-muted mb-1">District</label>
              <input
                type="text"
                placeholder="District name..."
                value={filterDistrict}
                onChange={e => setFilterDistrict(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-border rounded-md text-xs bg-bg focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-text-muted mb-1">Territory</label>
              <select
                value={filterTerritory}
                onChange={e => setFilterTerritory(e.target.value)}
                className="w-full px-2 py-1.5 border border-border rounded-md text-xs bg-bg focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="">All Territories</option>
                {territories.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-text-muted mb-1">Assigned Staff</label>
              <select
                value={filterStaff}
                onChange={e => setFilterStaff(e.target.value)}
                className="w-full px-2 py-1.5 border border-border rounded-md text-xs bg-bg focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="">All Staff</option>
                <option value="unassigned">Unassigned</option>
                {staffUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}` : u.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Action Controls */}
      {selectedFarmers.length > 0 && (
        <div className="flex items-center gap-4 bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4 animate-stagger-in">
          <p className="text-sm font-semibold text-primary flex-1">
            {selectedFarmers.length} farmer{selectedFarmers.length > 1 ? 's' : ''} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBulkReassign(true)}
              className="flex items-center gap-2 bg-accent hover:bg-accent-light text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors btn-press"
            >
              <UserCheck size={16} /> Reassign Staff ({selectedFarmers.length})
            </button>
            <button
              onClick={() => setShowSendMessage(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors btn-press"
            >
              <MessageSquare size={16} /> Send Message
            </button>
          </div>
        </div>
      )}

      {/* Farmers Data Table */}
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-12">
                <input
                  type="checkbox"
                  className="rounded text-primary focus:ring-primary"
                  checked={isSelectingAll}
                  onChange={handleSelectAll}
                />
              </th>
              <th>Name</th>
              <th>Mobile</th>
              <th>Village / Taluka</th>
              <th>District / PIN</th>
              <th>Assigned Staff</th>
              <th>Created On</th>
              <th>Source</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="10" className="text-center py-10 text-text-muted">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Loading farmers...
                  </div>
                </td>
              </tr>
            ) : farmers.length === 0 ? (
              <tr><td colSpan="10" className="text-center py-10 text-text-muted">No farmers found matching filters.</td></tr>
            ) : farmers.map((farmer, i) => (
              <tr key={farmer.id} className="animate-stagger-in" style={{ animationDelay: `${i * 15}ms` }}>
                <td>
                  <input
                    type="checkbox"
                    className="rounded text-primary focus:ring-primary"
                    checked={selectedFarmers.includes(farmer.id)}
                    onChange={e => handleSelectFarmer(farmer.id, e.target.checked)}
                  />
                </td>
                <td className="font-medium">{farmer.full_name}</td>
                <td className="font-mono text-xs">{farmer.primary_mobile}</td>
                <td>
                  <div className="text-xs font-medium text-text">{farmer.village}</div>
                  <div className="text-[11px] text-text-muted">{farmer.taluka || '—'}</div>
                </td>
                <td>
                  <div className="text-xs font-medium text-text">{farmer.district || '—'}</div>
                  <div className="text-[11px] font-mono text-text-muted">{farmer.pin_code || '—'}</div>
                </td>
                <td>
                  {farmer.assigned_staff_name ? (
                    <div>
                      <div className="text-xs font-medium text-text">{farmer.assigned_staff_name}</div>
                      <div className="text-[11px] text-text-muted">{farmer.assigned_staff_mobile || farmer.assigned_staff_email}</div>
                    </div>
                  ) : (
                    <span className="text-xs text-text-muted italic">Unassigned</span>
                  )}
                </td>
                <td className="text-xs font-mono text-text-muted">
                  {farmer.date_added ? new Date(farmer.date_added).toLocaleDateString('en-IN') : '—'}
                </td>
                <td>
                  <span className={`badge ${farmer.source === 'BulkImport' ? 'bg-blue-50 text-blue-700' : farmer.source === 'InApp' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {farmer.source || '—'}
                  </span>
                </td>

                <td>
                  <span className={`badge ${farmer.status === 'Active' ? 'badge-active' : 'badge-inactive'}`}>
                    {farmer.status}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => setSelectedFarmerForVisit(farmer)} className="p-1 hover:text-emerald-600 transition-colors cursor-pointer" title="Log Field Visit">
                      <MapPin size={14} />
                    </button>
                    <button onClick={() => setSelectedFarmerForCall(farmer)} className="p-1 hover:text-blue-600 transition-colors cursor-pointer" title="Call Farmer & Log Outcome">
                      <PhoneCall size={14} />
                    </button>
                    <button onClick={() => setSelectedFarmerForRecommend(farmer)} className="p-1 hover:text-amber-600 transition-colors cursor-pointer" title="AI Recommendation Advisory">
                      <Award size={14} />
                    </button>
                    <button onClick={() => setSelectedFarmerForTimeline(farmer)} className="p-1 hover:text-purple-600 transition-colors cursor-pointer" title="View Activity Timeline">
                      <History size={14} />
                    </button>
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

      {showSendMessage && (
        <SendMessageModal
          farmerIds={selectedFarmers}
          onClose={() => setShowSendMessage(false)}
          onSuccess={() => {
            setShowSendMessage(false);
            setSelectedFarmers([]);
            setIsSelectingAll(false);
            alert('Messages scheduled successfully!');
          }}
        />
      )}

      {showBulkReassign && (
        <BulkReassignModal
          farmerIds={selectedFarmers}
          onClose={() => setShowBulkReassign(false)}
          onSuccess={() => {
            setShowBulkReassign(false);
            setSelectedFarmers([]);
            setIsSelectingAll(false);
            fetchFarmers(page);
          }}
        />
      )}

      {selectedFarmerForVisit && (
        <LogVisitModal
          farmer={selectedFarmerForVisit}
          onClose={() => setSelectedFarmerForVisit(null)}
          onSuccess={() => {
            setSelectedFarmerForVisit(null);
            fetchFarmers(page);
          }}
        />
      )}

      {selectedFarmerForCall && (
        <CallLogModal
          farmer={selectedFarmerForCall}
          onClose={() => setSelectedFarmerForCall(null)}
          onSuccess={() => setSelectedFarmerForCall(null)}
        />
      )}

      {selectedFarmerForRecommend && (
        <RecommendationModal
          farmer={selectedFarmerForRecommend}
          onClose={() => setSelectedFarmerForRecommend(null)}
          onSuccess={() => setSelectedFarmerForRecommend(null)}
        />
      )}

      {selectedFarmerForTimeline && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="bg-surface border-l border-border w-full max-w-xl h-full p-6 overflow-y-auto shadow-2xl space-y-4 animate-slide-in-right">
            <div className="flex justify-between items-center border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <History size={20} className="text-primary" />
                <div>
                  <h3 className="text-base font-heading font-bold text-text">Activity Timeline</h3>
                  <p className="text-xs text-text-muted">{selectedFarmerForTimeline.full_name} ({selectedFarmerForTimeline.primary_mobile})</p>
                </div>
              </div>
              <button onClick={() => setSelectedFarmerForTimeline(null)} className="p-2 text-text-muted hover:text-text rounded-lg hover:bg-bg">
                <X size={20} />
              </button>
            </div>
            <FarmerTimeline farmerId={selectedFarmerForTimeline.id} />
          </div>
        </div>
      )}
    </div>
  );
}

