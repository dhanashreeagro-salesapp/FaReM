import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { CheckCircle, XCircle, Clock, Edit2, Copy, Trash2, StopCircle, Plus } from 'lucide-react';
import SendMessageModal from '../components/SendMessageModal';
import AudienceTargetingModal from '../components/AudienceTargetingModal';

export default function PromotionsManagement() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  
  const [modalConfig, setModalConfig] = useState(null);

  const fetchBatches = async () => {
    try {
      const data = await api.getBulkSends();
      setBatches(Array.isArray(data) ? data : data.results || []);
    } catch { setBatches([]); }
    setLoading(false);
  };

  useEffect(() => { fetchBatches(); }, []);

  const handleCancel = async (id) => {
    if (!confirm('Are you sure you want to cancel this scheduled promotion?')) return;
    try {
      await api.cancelBulkSend(id);
      fetchBatches();
    } catch { alert('Failed to cancel'); }
  };

  const handleEdit = (batch) => {
    let mode = 'Immediate';
    if (batch.frequency && batch.frequency !== 'Once') mode = 'Recurring';
    else if (batch.scheduled_start_date) mode = 'Scheduled';

    setModalConfig({
      mode: 'edit',
      initialData: {
        id: batch.id,
        content: batch.content,
        channel: batch.channel,
        farmer_ids: batch.farmer_ids,
        scheduleMode: mode,
        startDate: batch.scheduled_start_date || '',
        endDate: batch.scheduled_end_date || '',
        frequency: batch.frequency || 'Once'
      }
    });
  };

  const handleDuplicate = (batch) => {
    setModalConfig({
      mode: 'duplicate',
      initialData: {
        content: batch.content,
        channel: batch.channel,
        farmer_ids: batch.farmer_ids,
        scheduleMode: 'Immediate',
        startDate: '',
        endDate: '',
        frequency: 'Once'
      }
    });
  };

  const upcomingBatches = batches.filter(b => ['Pending', 'InProgress'].includes(b.send_status));
  const pastBatches = batches.filter(b => !['Pending', 'InProgress'].includes(b.send_status));

  const displayBatches = activeTab === 'upcoming' ? upcomingBatches : pastBatches;

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-heading font-bold text-text">Promotions Management</h2>
          <p className="text-sm text-text-muted mt-1">Manage, edit, or duplicate your scheduled and past messaging campaigns.</p>
        </div>
        <button 
          onClick={() => setModalConfig({ mode: 'create_audience' })}
          className="flex items-center gap-2 bg-primary text-white hover:bg-primary-dark px-4 py-2 rounded-lg font-medium text-sm transition-colors btn-press"
        >
          <Plus size={16} /> New Campaign
        </button>
      </div>

      <div className="flex gap-4 mb-6 border-b border-border">
        <button 
          onClick={() => setActiveTab('upcoming')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'upcoming' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text'}`}
        >
          Upcoming & Active ({upcomingBatches.length})
        </button>
        <button 
          onClick={() => setActiveTab('past')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'past' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text'}`}
        >
          Past ({pastBatches.length})
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date / Schedule</th>
              <th>Channel</th>
              <th>Recipients</th>
              <th>Frequency</th>
              <th>Status</th>
              <th>Sent / Failed</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="text-center py-8 text-text-muted">Loading...</td></tr>
            ) : displayBatches.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-8 text-text-muted">No {activeTab} promotions found.</td></tr>
            ) : displayBatches.map((batch, i) => (
              <tr key={batch.id} className="animate-stagger-in" style={{ animationDelay: `${i * 30}ms` }}>
                <td className="text-xs font-mono">
                  {batch.scheduled_start_date ? new Date(batch.scheduled_start_date).toLocaleDateString('en-IN') : new Date(batch.created_at).toLocaleDateString('en-IN')}
                  {batch.scheduled_end_date && ` to ${new Date(batch.scheduled_end_date).toLocaleDateString('en-IN')}`}
                </td>
                <td><span className={`badge ${batch.channel === 'WhatsApp' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>{batch.channel}</span></td>
                <td className="font-mono">{batch.recipient_count}</td>
                <td className="text-xs">{batch.frequency || 'Once'}</td>
                <td>
                  <span className={`badge ${['Completed'].includes(batch.send_status) ? 'badge-active' : ['Cancelled', 'Rejected'].includes(batch.send_status) ? 'badge-inactive' : 'badge-pending'}`}>
                    {batch.send_status}
                  </span>
                </td>
                <td className="font-mono text-xs">
                  <span className="text-success">{batch.sent_count}</span> / <span className="text-danger">{batch.failed_count}</span>
                </td>
                <td className="text-right">
                  <div className="flex gap-2 justify-end">
                    {activeTab === 'upcoming' ? (
                      <>
                        <button onClick={() => handleEdit(batch)} title="Edit Schedule" className="p-1.5 bg-surface hover:bg-bg text-text-muted hover:text-primary rounded-md transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleCancel(batch.id)} title="Cancel Promotion" className="p-1.5 bg-surface hover:bg-bg text-text-muted hover:text-danger rounded-md transition-colors">
                          <StopCircle size={14} />
                        </button>
                      </>
                    ) : (
                      <button onClick={() => handleDuplicate(batch)} title="Duplicate Promotion" className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-md font-medium transition-colors">
                        <Copy size={14} /> Duplicate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalConfig && modalConfig.mode === 'create_audience' ? (
        <AudienceTargetingModal
          onClose={() => setModalConfig(null)}
          onAudienceSelected={(farmerIds) => {
            setModalConfig({
              mode: 'create',
              initialData: { farmer_ids: farmerIds, content: '', channel: 'WhatsApp', scheduleMode: 'Immediate', startDate: '', endDate: '', frequency: 'Once' }
            });
          }}
        />
      ) : modalConfig && (
        <SendMessageModal
          farmerIds={modalConfig.initialData.farmer_ids || []}
          initialData={modalConfig.initialData}
          mode={modalConfig.mode === 'create' ? 'create' : modalConfig.mode}
          onClose={() => setModalConfig(null)}
          onSuccess={() => {
            setModalConfig(null);
            fetchBatches();
          }}
        />
      )}
    </div>
  );
}
