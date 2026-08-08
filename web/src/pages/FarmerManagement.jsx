import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { getCurrentGpsPosition, sortFarmersByDistance } from '../utils/gps';
import { Plus, Upload, Search, Download, Edit2, Trash2, X, Map, ChevronLeft, ChevronRight, MessageSquare, UserCheck, Filter, RotateCcw, MapPin, PhoneCall, Award, History, BarChart2, Layers, Navigation, ArrowUpDown, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react';
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
  
  // User Role
  const currentUser = api.getStoredUser ? api.getStoredUser() : null;
  const isAdmin = currentUser?.role === 'Admin';
  const isFieldStaff = currentUser?.role === 'FieldStaff';

  // View Mode & Sorting State
  const [viewMode, setViewMode] = useState('flat'); // 'flat' | 'hierarchical' | 'nearby'
  const [sortField, setSortField] = useState('full_name');
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'
  const [expandedNodes, setExpandedNodes] = useState({});

  // GPS Proximity State
  const [gpsLocation, setGpsLocation] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('');

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

    if (sortField) {
      params.ordering = sortDirection === 'desc' ? `-${sortField}` : sortField;
    }

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
  }, [search, filterPinCode, filterVillage, filterTaluka, filterDistrict, filterTerritory, filterStaff, sortField, sortDirection, searchParams]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setPage(1);
  };

  const toggleNode = (key) => {
    setExpandedNodes(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleActivateNearbyView = async () => {
    setViewMode('nearby');
    setGpsStatus('Getting your location...');
    setLoading(true);
    try {
      const pos = await getCurrentGpsPosition({ timeout: 12000 });
      setGpsLocation(pos);
      setGpsStatus(pos.isFallback ? 'Location fallback active' : 'GPS position locked ✓');
      const params = buildQueryParams(1);
      delete params.page;
      delete params.page_size;
      const resp = await api.getFarmers(params);
      const list = resp.results || resp || [];
      const sorted = sortFarmersByDistance(list, pos.latitude, pos.longitude);
      setFarmers(sorted);
    } catch (err) {
      console.error("Nearby farmers error:", err);
      setGpsStatus('Unable to obtain location');
    } finally {
      setLoading(false);
    }
  };

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
    setEditingId(farmer.id);
    setForm({
      full_name: farmer.full_name || '',
      primary_mobile: farmer.primary_mobile || '',
      pin_code: farmer.pin_code || '',
      email: farmer.email || '',
      village: farmer.village || '',
      district: farmer.district || '',
      taluka: farmer.taluka || '',
      state: farmer.state || '',
      assigned_staff: farmer.assigned_staff || '',
      acquisition_date: farmer.acquisition_date || (farmer.date_added ? farmer.date_added.split('T')[0] : new Date().toISOString().split('T')[0])
    });
    setVillages(farmer.village ? [farmer.village] : []);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.acquisition_date) {
      const selectedDate = new Date(form.acquisition_date);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (selectedDate > today) {
        alert("Created On date cannot be in the future");
        return;
      }
    }

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
      setForm({ full_name: '', primary_mobile: '', village: '', district: '', taluka: '', state: '', pin_code: '', assigned_staff: '', acquisition_date: new Date().toISOString().split('T')[0] });
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

  const buildHierarchicalTree = (farmersList) => {
    const tree = {};
    farmersList.forEach(f => {
      const staffName = f.assigned_staff_name || 'My Farmers';
      const taluka = f.taluka || 'Other Taluka';
      const village = f.village || 'Other Village';

      if (!tree[staffName]) tree[staffName] = {};
      if (!tree[staffName][taluka]) tree[staffName][taluka] = {};
      if (!tree[staffName][taluka][village]) tree[staffName][taluka][village] = [];

      tree[staffName][taluka][village].push(f);
    });
    return tree;
  };

  const hierarchicalTree = buildHierarchicalTree(farmers);

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-heading font-bold text-text">Farmer Management</h2>
          {!loading && <p className="text-xs text-text-muted mt-0.5">{totalCount} farmers total</p>}
        </div>

        {/* View Mode Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-bg border border-border rounded-xl p-1 text-xs font-semibold">
            <button
              onClick={() => { setViewMode('flat'); fetchFarmers(1); }}
              className={`px-3 py-1.5 rounded-lg transition-all ${viewMode === 'flat' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text'}`}
            >
              Flat List
            </button>
            <button
              onClick={() => setViewMode('hierarchical')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all ${viewMode === 'hierarchical' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text'}`}
            >
              <Layers size={13} /> Hierarchical
            </button>
            <button
              onClick={handleActivateNearbyView}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all ${viewMode === 'nearby' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text'}`}
            >
              <Navigation size={13} /> Nearby Farmers
            </button>
          </div>

          {isAdmin && (
            <>
              <button onClick={handleExport} className="flex items-center gap-1.5 bg-surface hover:bg-bg text-text-muted hover:text-text px-3 py-2 border border-border rounded-xl font-medium text-xs cursor-pointer btn-press transition-colors">
                <Download size={14} /> Export
              </button>
              <button onClick={() => setShowWizard(true)} className="flex items-center gap-1.5 bg-accent hover:bg-accent-light text-white px-3 py-2 rounded-xl font-medium text-xs cursor-pointer btn-press transition-colors">
                <Upload size={14} /> Bulk Import Excel
              </button>
            </>
          )}

          <button
            onClick={() => {
              setEditingId(null);
              setForm({ full_name: '', primary_mobile: '', pin_code: '', email: '', village: '', district: '', taluka: '', state: '', assigned_staff: '', acquisition_date: new Date().toISOString().split('T')[0] });
              setVillages([]);
              setShowForm(true);
            }}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-xl font-medium text-xs cursor-pointer btn-press transition-colors shadow-md"
          >
            <Plus size={14} /> Add Farmer
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
              <label className="block text-xs font-semibold text-text-muted mb-1">Created On / Acquisition Date *</label>
              <input 
                type="date" 
                required
                max={new Date().toISOString().split('T')[0]}
                value={form.acquisition_date || ''} 
                onChange={e => setForm({...form, acquisition_date: e.target.value})} 
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Assigned Field Staff</label>
              <select value={form.assigned_staff || ''} onChange={e => setForm({...form, assigned_staff: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none">
                <option value="">Auto-assign to Me</option>
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

      {/* VIEW MODE 2: Hierarchical Tree View */}
      {viewMode === 'hierarchical' && (
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-heading font-bold text-text border-b border-border pb-2">
            Reporting Hierarchy View (User → Taluka → Village → Farmer)
          </h3>
          <div className="space-y-3">
            {Object.keys(hierarchicalTree).map(staffName => {
              const staffKey = `staff_${staffName}`;
              const isStaffExpanded = expandedNodes[staffKey] !== false; // expanded by default
              const talukas = hierarchicalTree[staffName];

              return (
                <div key={staffName} className="border border-border rounded-xl overflow-hidden bg-bg/40">
                  <div
                    onClick={() => toggleNode(staffKey)}
                    className="p-3 bg-primary/10 font-bold text-xs text-primary flex items-center justify-between cursor-pointer hover:bg-primary/20 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      {isStaffExpanded ? <ChevronDown size={16} /> : <ChevronRightIcon size={16} />}
                      👤 Staff: {staffName} ({Object.values(talukas).reduce((acc, t) => acc + Object.values(t).reduce((a, v) => a + v.length, 0), 0)} farmers)
                    </span>
                  </div>

                  {isStaffExpanded && (
                    <div className="p-3 space-y-3">
                      {Object.keys(talukas).map(taluka => {
                        const talukaKey = `taluka_${staffName}_${taluka}`;
                        const isTalukaExpanded = expandedNodes[talukaKey] !== false;
                        const villagesList = talukas[taluka];

                        return (
                          <div key={taluka} className="ml-3 border border-border rounded-lg overflow-hidden bg-surface">
                            <div
                              onClick={() => toggleNode(talukaKey)}
                              className="p-2.5 bg-bg font-semibold text-xs text-text flex items-center justify-between cursor-pointer hover:bg-bg/80"
                            >
                              <span className="flex items-center gap-2">
                                {isTalukaExpanded ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
                                📍 Taluka: {taluka}
                              </span>
                            </div>

                            {isTalukaExpanded && (
                              <div className="p-2 space-y-2">
                                {Object.keys(villagesList).map(village => {
                                  const villageKey = `village_${staffName}_${taluka}_${village}`;
                                  const isVillageExpanded = expandedNodes[villageKey] !== false;
                                  const farmerItems = villagesList[village];

                                  return (
                                    <div key={village} className="ml-3 border border-emerald-500/20 rounded-md overflow-hidden bg-emerald-50/20">
                                      <div
                                        onClick={() => toggleNode(villageKey)}
                                        className="p-2 font-medium text-xs text-emerald-900 flex items-center justify-between cursor-pointer hover:bg-emerald-50/50"
                                      >
                                        <span className="flex items-center gap-1.5">
                                          {isVillageExpanded ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
                                          🌾 Village: {village} ({farmerItems.length})
                                        </span>
                                      </div>

                                      {isVillageExpanded && (
                                        <div className="p-2 space-y-2 grid grid-cols-1 md:grid-cols-2 gap-2 bg-surface">
                                          {farmerItems.map(f => (
                                            <div key={f.id} className="p-3 border border-border rounded-xl bg-bg/50 space-y-2 flex flex-col justify-between">
                                              <div className="flex justify-between items-start">
                                                <div>
                                                  <div className="font-bold text-xs text-text">{f.full_name}</div>
                                                  <div className="text-[11px] font-mono text-text-muted">📱 {f.primary_mobile}</div>
                                                </div>
                                                <span className={`badge ${f.status === 'Active' ? 'badge-active' : 'badge-inactive'}`}>
                                                  {f.status}
                                                </span>
                                              </div>
                                              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
                                                <a href={`tel:${f.primary_mobile}`} className="p-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 flex items-center gap-1">
                                                  <PhoneCall size={13} /> Call
                                                </a>
                                                <button onClick={() => setSelectedFarmerForVisit(f)} className="p-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-100 flex items-center gap-1">
                                                  <MapPin size={13} /> Visit
                                                </button>
                                                <button onClick={() => setSelectedFarmerForRecommend(f)} className="p-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 flex items-center gap-1">
                                                  <Award size={13} /> Advisor
                                                </button>
                                                <button onClick={() => handleEdit(f)} className="p-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200">
                                                  Edit
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 3: Nearby GPS Proximity View */}
      {viewMode === 'nearby' && (
        <div className="card p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <h3 className="text-sm font-heading font-bold text-text flex items-center gap-2">
              <Navigation size={16} className="text-primary" /> Nearby Farmers (Sorted by Distance)
            </h3>
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              {gpsStatus}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {farmers.map(f => (
              <div key={f.id} className="p-4 border border-border rounded-2xl bg-surface space-y-3 shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-text">{f.full_name}</h4>
                    <p className="text-xs font-mono text-text-muted mt-0.5">📱 {f.primary_mobile}</p>
                    <p className="text-xs text-text-muted mt-0.5">📍 {f.village}, {f.taluka}</p>
                  </div>
                  {f.calculated_distance !== undefined && f.calculated_distance !== null ? (
                    <span className="px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-mono font-bold">
                      {f.calculated_distance > 1000 ? `${(f.calculated_distance / 1000).toFixed(1)} km` : `${f.calculated_distance} m`}
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-[11px]">No GPS</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  <a href={`tel:${f.primary_mobile}`} className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-semibold hover:bg-blue-100">
                    <PhoneCall size={14} /> Call
                  </a>
                  <button onClick={() => setSelectedFarmerForVisit(f)} className="flex items-center gap-1 px-3 py-2 bg-purple-50 text-purple-700 rounded-xl text-xs font-semibold hover:bg-purple-100">
                    <MapPin size={14} /> Visit
                  </button>
                  <button onClick={() => setSelectedFarmerForRecommend(f)} className="flex items-center gap-1 px-3 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-semibold hover:bg-amber-100">
                    <Award size={14} /> Advisor
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW MODE 1: Main Flat Data Table & Mobile Responsive Cards */}
      {viewMode === 'flat' && (
        <div className="card overflow-hidden">
          {/* Desktop Data Table */}
          <div className="hidden md:block">
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
                  <th onClick={() => handleSort('full_name')} className="cursor-pointer hover:bg-bg/80 select-none">
                    Name {sortField === 'full_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('primary_mobile')} className="cursor-pointer hover:bg-bg/80 select-none">
                    Mobile {sortField === 'primary_mobile' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('village')} className="cursor-pointer hover:bg-bg/80 select-none">
                    Village / Taluka {sortField === 'village' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('district')} className="cursor-pointer hover:bg-bg/80 select-none">
                    District / PIN {sortField === 'district' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  {!isFieldStaff && (
                    <th onClick={() => handleSort('assigned_staff__first_name')} className="cursor-pointer hover:bg-bg/80 select-none">
                      Assigned Staff {sortField === 'assigned_staff__first_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                  )}
                  <th onClick={() => handleSort('acquisition_date')} className="cursor-pointer hover:bg-bg/80 select-none">
                    Created On {sortField === 'acquisition_date' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  {isAdmin && <th>Source</th>}
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
                    {!isFieldStaff && (
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
                    )}
                    <td className="text-xs font-mono text-text-muted">
                      {farmer.acquisition_date ? farmer.acquisition_date : (farmer.date_added ? farmer.date_added.split('T')[0] : '—')}
                    </td>
                    {isAdmin && (
                      <td>
                        <span className={`badge ${farmer.source === 'BulkImport' ? 'bg-blue-50 text-blue-700' : farmer.source === 'InApp' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {farmer.source || '—'}
                        </span>
                      </td>
                    )}
                    <td>
                      <span className={`badge ${farmer.status === 'Active' ? 'badge-active' : 'badge-inactive'}`}>
                        {farmer.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setSelectedFarmerForVisit(farmer)} className="p-1.5 hover:text-emerald-600 transition-colors cursor-pointer rounded-lg hover:bg-emerald-50" title="Log Field Visit">
                          <MapPin size={15} />
                        </button>
                        <button onClick={() => setSelectedFarmerForCall(farmer)} className="p-1.5 hover:text-blue-600 transition-colors cursor-pointer rounded-lg hover:bg-blue-50" title="Call Farmer & Log Outcome">
                          <PhoneCall size={15} />
                        </button>
                        <button onClick={() => setSelectedFarmerForRecommend(farmer)} className="p-1.5 hover:text-amber-600 transition-colors cursor-pointer rounded-lg hover:bg-amber-50" title="AI Recommendation Advisory">
                          <Award size={15} />
                        </button>
                        <button onClick={() => setSelectedFarmerForTimeline(farmer)} className="p-1.5 hover:text-purple-600 transition-colors cursor-pointer rounded-lg hover:bg-purple-50" title="View Activity Timeline">
                          <History size={15} />
                        </button>
                        <button onClick={() => handleEdit(farmer)} className="p-1.5 hover:text-primary transition-colors cursor-pointer rounded-lg hover:bg-primary/10" title="Edit Farmer">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => setSelectedFarmerForPlots(farmer)} className="p-1.5 hover:text-success transition-colors cursor-pointer rounded-lg hover:bg-success/10" title="Manage Plots">
                          <Map size={15} />
                        </button>
                        {isAdmin && farmer.status === 'Active' && (
                          <button onClick={() => handleDisable(farmer.id)} className="p-1.5 hover:text-danger transition-colors cursor-pointer rounded-lg hover:bg-danger/10" title="Disable Farmer">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List (Mobile-First UX) */}
          <div className="block md:hidden divide-y divide-border">
            {farmers.map(farmer => (
              <div key={farmer.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-text text-base">{farmer.full_name}</div>
                    <div className="text-xs text-text-muted font-mono mt-0.5">📱 {farmer.primary_mobile}</div>
                    <div className="text-xs text-text-muted mt-0.5">📍 {farmer.village || 'No Village'}, {farmer.taluka || ''}</div>
                    {!isFieldStaff && farmer.assigned_staff_name && (
                      <div className="text-xs text-primary font-medium mt-1">👤 Staff: {farmer.assigned_staff_name}</div>
                    )}
                  </div>
                  <span className={`badge ${farmer.status === 'Active' ? 'badge-active' : 'badge-inactive'}`}>
                    {farmer.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  <a href={`tel:${farmer.primary_mobile}`} className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-semibold min-h-[44px]">
                    <PhoneCall size={14} /> Call
                  </a>
                  <a href={`https://wa.me/91${farmer.primary_mobile}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold min-h-[44px]">
                    <MessageSquare size={14} /> WhatsApp
                  </a>
                  <button onClick={() => setSelectedFarmerForVisit(farmer)} className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 rounded-xl text-xs font-semibold min-h-[44px]">
                    <MapPin size={14} /> Visit
                  </button>
                  <button onClick={() => setSelectedFarmerForRecommend(farmer)} className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-semibold min-h-[44px]">
                    <Award size={14} /> Advisor
                  </button>
                  <button onClick={() => handleEdit(farmer)} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold min-h-[44px]">
                    <Edit2 size={14} /> Edit
                  </button>
                </div>
              </div>
            ))}
          </div>

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
      )}

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

