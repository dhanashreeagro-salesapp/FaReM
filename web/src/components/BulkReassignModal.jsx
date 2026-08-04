import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { UserCheck, X, Search, Shield, MapPin } from 'lucide-react';

export default function BulkReassignModal({ farmerIds, onClose, onSuccess }) {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [searchStaff, setSearchStaff] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchUsers() {
      try {
        const data = await api.getUsers();
        const userList = Array.isArray(data) ? data : (data.results || []);
        setUsers(userList);
      } catch (err) {
        console.error("Failed to load staff users:", err);
        setError("Failed to load staff list");
      } finally {
        setLoadingUsers(false);
      }
    }
    fetchUsers();
  }, []);

  const handleAssign = async () => {
    setError('');
    setSubmitting(true);
    try {
      const res = await api.bulkAssignFarmers(farmerIds, selectedStaffId || null);
      alert(res.message || `Successfully reassigned ${farmerIds.length} farmers.`);
      onSuccess();
    } catch (err) {
      console.error("Reassignment error:", err);
      setError(err.error || err.message || 'Failed to reassign farmers');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const query = searchStaff.toLowerCase();
    const name = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
    const email = (u.email || '').toLowerCase();
    const mobile = (u.mobile_number || '').toLowerCase();
    const terr = (u.territory_name || '').toLowerCase();
    return name.includes(query) || email.includes(query) || mobile.includes(query) || terr.includes(query);
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="card p-6 w-full max-w-lg shadow-2xl border-2 border-primary/20 bg-surface">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <UserCheck size={20} />
            </div>
            <div>
              <h3 className="font-heading font-bold text-text text-lg">Reassign Farmers</h3>
              <p className="text-xs text-text-muted">{farmerIds.length} farmer{farmerIds.length > 1 ? 's' : ''} selected</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text p-1"><X size={18} /></button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-danger rounded-lg p-3 text-xs mb-4">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs font-semibold text-text-muted mb-1.5">Search Staff Member</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search by name, email, mobile, territory..."
              value={searchStaff}
              onChange={e => setSearchStaff(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-border rounded-lg text-xs bg-bg focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-2 mb-6 pr-1">
          <label
            onClick={() => setSelectedStaffId('')}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
              selectedStaffId === '' ? 'border-primary bg-primary/5 shadow-xs' : 'border-border hover:bg-bg'
            }`}
          >
            <input
              type="radio"
              name="staff_select"
              checked={selectedStaffId === ''}
              onChange={() => setSelectedStaffId('')}
              className="text-primary focus:ring-primary"
            />
            <div className="flex-1">
              <p className="text-xs font-semibold text-text">Unassign / Clear Staff</p>
              <p className="text-[11px] text-text-muted">Remove currently assigned field staff</p>
            </div>
          </label>

          {loadingUsers ? (
            <div className="py-6 text-center text-xs text-text-muted">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading staff list...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-4 text-center text-xs text-text-muted">No staff members found matching query.</div>
          ) : (
            filteredUsers.map(u => {
              const fullName = `${u.first_name || ''} ${u.last_name || ''}`.strip() || u.email;
              const isSelected = selectedStaffId === u.id;
              return (
                <label
                  key={u.id}
                  onClick={() => setSelectedStaffId(u.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected ? 'border-primary bg-primary/5 shadow-xs' : 'border-border hover:bg-bg'
                  }`}
                >
                  <input
                    type="radio"
                    name="staff_select"
                    checked={isSelected}
                    onChange={() => setSelectedStaffId(u.id)}
                    className="text-primary focus:ring-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-text truncate">{fullName}</p>
                      <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {u.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-text-muted mt-0.5">
                      <span>{u.email}</span>
                      {u.mobile_number && <span>• {u.mobile_number}</span>}
                    </div>
                    {u.territory_name && (
                      <div className="flex items-center gap-1 text-[10px] text-text-muted mt-1">
                        <MapPin size={10} className="text-primary" /> {u.territory_name}
                      </div>
                    )}
                  </div>
                </label>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-border">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-medium text-text-muted hover:text-text rounded-lg border border-border hover:bg-bg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={submitting}
            className="px-5 py-2 text-xs font-medium text-white bg-primary hover:bg-primary-dark rounded-lg btn-press transition-colors flex items-center gap-2"
          >
            {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Confirm Reassignment ({farmerIds.length})
          </button>
        </div>
      </div>
    </div>
  );
}
