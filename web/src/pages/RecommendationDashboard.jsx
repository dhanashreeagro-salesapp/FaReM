import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Award, CheckCircle2, XCircle, AlertCircle, MessageSquare, Send, BarChart2, Filter, Loader2, ThumbsUp, ThumbsDown, MessageCircle } from 'lucide-react';

export default function RecommendationDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  
  const [selectedRec, setSelectedRec] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewStatus, setReviewStatus] = useState('Approved');
  const [managerComment, setManagerComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [analyticsData, recsData] = await Promise.all([
        api.getRecommendationAnalytics(),
        api.getRecommendations(filterStatus !== 'all' ? { review_status: filterStatus } : {})
      ]);
      setAnalytics(analyticsData);
      setRecommendations(recsData.results || recsData || []);
    } catch (err) {
      console.error("Dashboard error:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, [filterStatus]);

  const handleReviewSubmit = async () => {
    if (!selectedRec) return;
    setActionLoading(true);
    try {
      await api.reviewRecommendation(selectedRec.id, {
        review_status: reviewStatus,
        manager_comment: managerComment
      });
      setReviewModalOpen(false);
      fetchDashboardData();
    } catch (err) {
      alert(err.error || "Review submission failed");
    }
    setActionLoading(false);
  };

  if (loading && !analytics) {
    return (
      <div className="flex items-center justify-center py-20 text-text-muted">
        <Loader2 size={24} className="animate-spin text-primary mr-2" />
        <span className="text-sm font-medium">Loading Recommendation Management Dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-heading font-bold text-text">Recommendation Engine & Quality Review</h1>
          <p className="text-xs text-text-muted">Territory Manager analytics, approval workflows, and channel distribution</p>
        </div>
      </div>

      {/* Metrics Grid */}
      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-surface border border-border rounded-2xl shadow-sm">
            <div className="flex justify-between items-center text-xs text-text-muted mb-1">
              <span>Total Recommendations</span>
              <Award size={16} className="text-amber-500" />
            </div>
            <p className="text-2xl font-heading font-bold text-text">{analytics.total_recommendations}</p>
            <p className="text-[11px] text-text-muted mt-1">{analytics.avg_per_farmer} avg per farmer</p>
          </div>

          <div className="p-4 bg-surface border border-border rounded-2xl shadow-sm">
            <div className="flex justify-between items-center text-xs text-text-muted mb-1">
              <span>WhatsApp Delivery</span>
              <MessageSquare size={16} className="text-emerald-500" />
            </div>
            <p className="text-2xl font-heading font-bold text-emerald-600">{analytics.channel_percentages?.whatsapp_pct}%</p>
            <p className="text-[11px] text-text-muted mt-1">Direct farmer messaging</p>
          </div>

          <div className="p-4 bg-surface border border-border rounded-2xl shadow-sm">
            <div className="flex justify-between items-center text-xs text-text-muted mb-1">
              <span>SMS Delivery</span>
              <Send size={16} className="text-blue-500" />
            </div>
            <p className="text-2xl font-heading font-bold text-blue-600">{analytics.channel_percentages?.sms_pct}%</p>
            <p className="text-[11px] text-text-muted mt-1">Text notifications</p>
          </div>

          <div className="p-4 bg-surface border border-border rounded-2xl shadow-sm">
            <div className="flex justify-between items-center text-xs text-text-muted mb-1">
              <span>Quality Approved</span>
              <CheckCircle2 size={16} className="text-emerald-600" />
            </div>
            <p className="text-2xl font-heading font-bold text-text">{analytics.status_breakdown?.approved}</p>
            <p className="text-[11px] text-amber-600 mt-1">{analytics.status_breakdown?.pending} pending review</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        {['all', 'Pending', 'Approved', 'Needs Review', 'Rejected'].map(statusKey => (
          <button
            key={statusKey}
            onClick={() => setFilterStatus(statusKey)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterStatus === statusKey
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface border border-border text-text-muted hover:text-text'
            }`}
          >
            {statusKey === 'all' ? 'All Recommendations' : statusKey}
          </button>
        ))}
      </div>

      {/* Recommendations Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-text">
            <thead className="bg-bg border-b border-border font-heading font-bold text-text-muted">
              <tr>
                <th className="p-3.5">Farmer</th>
                <th className="p-3.5">Product & Dose</th>
                <th className="p-3.5">Crop / Stage</th>
                <th className="p-3.5">Staff</th>
                <th className="p-3.5">Channel</th>
                <th className="p-3.5">Review Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recommendations.map(r => (
                <tr key={r.id} className="hover:bg-bg/50">
                  <td className="p-3.5 font-semibold">
                    {r.farmer_name}
                    <div className="text-[11px] text-text-muted font-normal">{r.farmer_mobile}</div>
                  </td>
                  <td className="p-3.5 font-medium">
                    {r.product_name}
                    <div className="text-[11px] text-text-muted">{r.dose} {r.dose_unit}</div>
                  </td>
                  <td className="p-3.5">
                    {r.crop_name || 'N/A'}
                    <div className="text-[11px] text-text-muted">{r.stage_name || 'N/A'}</div>
                  </td>
                  <td className="p-3.5">{r.created_by_name || 'Staff'}</td>
                  <td className="p-3.5 font-medium">{r.channel}</td>
                  <td className="p-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      r.review_status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                      r.review_status === 'Rejected' ? 'bg-red-100 text-red-800' :
                      r.review_status === 'Needs Review' ? 'bg-amber-100 text-amber-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {r.review_status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => {
                        setSelectedRec(r);
                        setReviewStatus(r.review_status);
                        setManagerComment(r.manager_comment || '');
                        setReviewModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-semibold"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {reviewModalOpen && selectedRec && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-heading font-bold text-text">Manager Quality Review</h3>
            <p className="text-xs text-text-muted">Review recommendation for {selectedRec.farmer_name}</p>

            <div>
              <label className="block text-xs font-semibold mb-1">Set Decision</label>
              <select
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value)}
                className="w-full p-2.5 bg-bg border border-border rounded-xl text-xs font-medium text-text outline-none"
              >
                <option value="Approved">Approved</option>
                <option value="Needs Review">Needs Review</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Manager Comments & Feedback</label>
              <textarea
                rows={3}
                value={managerComment}
                onChange={(e) => setManagerComment(e.target.value)}
                placeholder="Add notes for the field staff..."
                className="w-full p-3 bg-bg border border-border rounded-xl text-xs text-text outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setReviewModalOpen(false)}
                className="px-4 py-2 border border-border text-text-muted hover:bg-bg rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewSubmit}
                disabled={actionLoading}
                className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90"
              >
                {actionLoading ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
