import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Plus, X, Edit2, Search, Upload } from 'lucide-react';
import ImportWizard from '../components/ImportWizard';

import { useAuth } from '../components/AuthProvider';

export default function UserMaster() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [territories, setTerritories] = useState([]);
  const [form, setForm] = useState({ mobile_number: '', email: '', first_name: '', last_name: '', employee_id: '', role: 'FieldStaff', territory: '', reporting_manager: '', password: '' });
  const [error, setError] = useState('');


  const fetchUsers = async (forceFresh = true) => {
    try {
      const data = await api.getUsers(forceFresh);
      setUsers(Array.isArray(data) ? data : data.results || []);
    } catch { setUsers([]); }
    setLoading(false);
  };

  const fetchTerritories = async () => {
    try {
      const data = await api.getTerritories();
      const territoryList = Array.isArray(data) ? data : data.results || [];
      territoryList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setTerritories(territoryList);
    } catch { setTerritories([]); }
  };

  useEffect(() => { fetchUsers(); fetchTerritories(); }, []);

  const validateForm = () => {
    const mobileValue = form.mobile_number.trim();
    if (!/^\d{10}$/.test(mobileValue)) {
      setError('Mobile number must be exactly 10 digits and numeric');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) return;

    try {
      const payload = { ...form, username: form.mobile_number };
      if (!payload.territory) delete payload.territory;
      if (!payload.reporting_manager) delete payload.reporting_manager;
      
      if (editingUser) {
        await api.updateUser(editingUser.id, payload);
      } else {
        await api.createUser(payload);
      }
      
      setShowForm(false);
      setEditingUser(null);
      setForm({ mobile_number: '', email: '', first_name: '', last_name: '', employee_id: '', role: 'FieldStaff', territory: '', reporting_manager: '', password: '' });
      await fetchUsers(true);
    } catch (err) {
      setError(err.error || err.mobile_number?.[0] || err.detail || 'Failed to save user');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setForm({
      mobile_number: user.mobile_number,
      email: user.email || '',
      first_name: user.first_name,
      last_name: user.last_name || '',
      employee_id: user.employee_id || '',
      role: user.role,
      territory: user.territory || '',
      reporting_manager: user.reporting_manager || '',
      password: ''
    });
    setShowForm(true);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDisable = async (id) => {
    if (!confirm('Disable this user? They will not be able to log in.')) return;
    try {
      await api.deleteUser(id);
      await fetchUsers(true);
    } catch (err) {
      alert(err.error || err.detail || 'Failed to disable user');
    }
  };

  const handleEnable = async (id) => {
    if (!confirm('Enable this user? They will be able to log in again.')) return;
    try {
      await api.enableUser(id);
      await fetchUsers(true);
    } catch (err) {
      alert(err.error || err.detail || 'Failed to enable user');
    }
  };


  const filteredUsers = users.filter(user => {
    const searchLow = searchTerm.toLowerCase();
    return (
      user.first_name?.toLowerCase().includes(searchLow) ||
      user.last_name?.toLowerCase().includes(searchLow) ||
      user.mobile_number?.includes(searchTerm) ||
      user.email?.toLowerCase().includes(searchLow) ||
      user.employee_id?.toLowerCase().includes(searchLow) ||
      user.territory_name?.toLowerCase().includes(searchLow)
    );
  });

  const roleColors = {
    FieldStaff: 'bg-blue-100 text-blue-800',
    TerritoryManager: 'bg-purple-100 text-purple-800',
    ZonalManager: 'bg-indigo-100 text-indigo-800',
    Admin: 'bg-green-100 text-green-800',
    ContentTeam: 'bg-orange-100 text-orange-800',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-heading font-bold text-text">User Management</h2>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
            <input 
              type="text" 
              placeholder="Search by name, mobile, etc..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none w-64"
            />
          </div>
          {isAdmin && (
            <>
              <button 
                onClick={() => setShowWizard(true)}
                className="flex items-center gap-2 bg-accent hover:bg-accent-light text-white px-4 py-2 rounded-lg font-medium text-sm cursor-pointer btn-press transition-colors"
              >
                <Upload size={16} /> Bulk Import
              </button>
              <button id="add-user-btn" onClick={() => {
                setEditingUser(null);
                setForm({ mobile_number: '', email: '', first_name: '', last_name: '', employee_id: '', role: 'FieldStaff', territory: '', reporting_manager: '', password: '' });
                setShowForm(!showForm);
                setError('');
              }}
                className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors btn-press">
                <Plus size={16} /> Add User
              </button>
            </>
          )}
        </div>
      </div>

      {isAdmin && showWizard && (

        <ImportWizard 
          resource="users"
          onClose={() => setShowWizard(false)} 
          onComplete={fetchUsers} 
        />
      )}

      {isAdmin && showForm && (
        <div className="card p-6 mb-6 animate-stagger-in border-2 border-primary/20">

          <div className="flex justify-between items-center mb-4">
            <h3 className="font-heading font-semibold text-text">{editingUser ? 'Edit User' : 'New User'}</h3>
            <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-text"><X size={18} /></button>
          </div>
          {error && <div className="bg-red-50 text-danger text-sm px-3 py-2 rounded mb-3 border border-red-100 font-medium">{error}</div>}
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">First Name*</label>
              <input placeholder="First Name" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Last Name</label>
              <input placeholder="Last Name" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Mobile Number* (10 digits)</label>
              <input placeholder="10 Digit Mobile" value={form.mobile_number} onChange={e => setForm({...form, mobile_number: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface font-mono focus:ring-2 focus:ring-primary focus:outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Email Address</label>
              <input type="email" placeholder="email@example.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Password {editingUser ? '(leave blank to keep current)' : '*'}</label>
              <input type="text" placeholder={editingUser ? "Unchanged" : "Secure Password"} value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" required={!editingUser} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Employee ID</label>
              <input placeholder="Employee ID" value={form.employee_id} onChange={e => setForm({...form, employee_id: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Role</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none">
                <option value="FieldStaff">Field Staff</option>
                <option value="TerritoryManager">Territory Manager</option>
                <option value="ZonalManager">Zonal Manager</option>
                <option value="Admin">Admin</option>
                <option value="ContentTeam">Content Team</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Territory</label>
              <select value={form.territory} onChange={e => setForm({...form, territory: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none">
                <option value="">-- Select Territory --</option>
                {territories.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="col-span-2 flex justify-end gap-3 mt-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 rounded-lg font-medium text-sm text-text-muted hover:text-text transition-colors">
                Cancel
              </button>
              <button type="submit" className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg font-medium text-sm transition-colors btn-press">
                {editingUser ? 'Update User' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Global Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input 
          type="text" 
          placeholder="Search by name, mobile, email, employee ID or territory..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-border rounded-xl text-sm bg-white shadow-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all"
        />
      </div>

      <div className="card overflow-hidden shadow-sm">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Mobile</th>
              <th>Email</th>
              <th>Role</th>
              <th>Territory</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="text-center py-8 text-text-muted">Loading...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan="8" className="text-center py-8 text-text-muted">No users found. Try a different search or add a user.</td></tr>
            ) : filteredUsers.map((user, i) => (
              <tr key={user.id} className="animate-stagger-in hover:bg-surface/50" style={{ animationDelay: `${i * 40}ms` }}>
                <td className="font-mono text-xs text-text-muted">{user.employee_id || '—'}</td>
                <td className="font-semibold text-text">{user.first_name} {user.last_name}</td>
                <td>
                  <Link 
                    to={`/farmers?search=${user.mobile_number}`}
                    className="font-mono text-xs text-primary hover:underline hover:text-primary-dark decoration-primary/30 underline-offset-2"
                    title="View assigned farmers"
                  >
                    {user.mobile_number}
                  </Link>
                </td>
                <td className="text-xs text-text-muted">{user.email || '—'}</td>
                <td><span className={`badge ${roleColors[user.role] || ''}`}>{user.role}</span></td>
                <td className="text-sm">{user.territory_name || '—'}</td>
                <td><span className={`badge ${user.status === 'Active' ? 'badge-active' : 'badge-inactive'}`}>{user.status}</span></td>
                <td className="text-right">
                  {isAdmin ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleEdit(user)} className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/5 rounded-lg transition-colors" title="Edit">
                        <Edit2 size={16} />
                      </button>
                      {user.status === 'Active' && (
                        <button onClick={() => handleDisable(user.id)} className="text-xs text-danger hover:text-red-700 font-medium px-2 py-1 hover:bg-red-50 rounded-lg transition-colors">
                          Disable
                        </button>
                      )}
                      {user.status === 'Inactive' && (
                        <button onClick={() => handleEnable(user.id)} className="text-xs text-green-600 hover:text-green-700 font-medium px-2 py-1 hover:bg-green-50 rounded-lg transition-colors">
                          Enable
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-text-muted italic">View Only</span>
                  )}
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
