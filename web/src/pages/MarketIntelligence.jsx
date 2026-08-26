import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { TrendingUp, TrendingDown, RefreshCw, Upload } from 'lucide-react';
import api from '../services/api';

export default function MarketIntelligence() {
  const [snapshotData, setSnapshotData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fileInputRef = React.useRef(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchSnapshot();
  }, []);

  const fetchSnapshot = async () => {
    setLoading(true);
    try {
      const response = await api.get('/market/snapshot/');
      if (response && response.data) {
          setSnapshotData(response.data);
      } else {
          setSnapshotData([]);
      }
    } catch (error) {
      console.error("Failed to fetch market snapshot", error);
      setSnapshotData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      await api.importMarketData(file);
      alert('Market data imported successfully!');
      fetchSnapshot();
    } catch (error) {
      console.error(error);
      alert('Failed to import market data: ' + (error.message || 'Unknown error'));
    } finally {
      setUploading(false);
      e.target.value = null; // reset input
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold font-heading text-text">Market Intelligence Dashboard</h1>
          <p className="text-sm text-text-muted mt-1">Real-time commodity prices aligned with your managed acreage</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={fetchSnapshot}
                className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-sm font-medium text-text hover:bg-gray-50"
            >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
            <button 
                onClick={() => window.location.href = `${api.baseUrl}/market/template/`}
                className="flex items-center gap-2 px-4 py-2 bg-surface border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary/5"
            >
                Download Template
            </button>
            <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50"
            >
                <Upload size={16} /> {uploading ? 'Importing...' : 'Import Excel Data'}
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-text-muted">Loading market data...</div>
        ) : snapshotData.length === 0 ? (
          <div className="col-span-full py-12 text-center text-text-muted">No active crops with acreage to display.</div>
        ) : (
          snapshotData.map((item, idx) => (
            <Card key={idx}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold font-heading text-text flex justify-between items-start">
                  {item.commodity_name}
                  {item.change_7_day_percent !== undefined && item.change_7_day_percent !== null && (
                    <span className={`text-xs font-bold flex items-center px-2 py-1 rounded-full ${
                      item.change_7_day_percent >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                    }`}>
                      {item.change_7_day_percent >= 0 ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
                      {Math.abs(item.change_7_day_percent).toFixed(1)}% (7d)
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mt-2">
                  <div className="text-3xl font-bold font-heading text-text">₹{item.latest_price || 'N/A'}</div>
                  <div className="text-sm text-text-muted mt-1">Modal Price</div>
                </div>
                
                {item.total_managed_acreage && (
                  <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                    <span className="text-sm font-medium text-text-muted">Managed Acreage</span>
                    <span className="text-sm font-bold text-text">{Number(item.total_managed_acreage).toFixed(1)} Acres</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
