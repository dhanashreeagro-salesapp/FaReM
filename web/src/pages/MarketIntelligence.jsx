import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { TrendingUp, TrendingDown, RefreshCw, Upload, Calendar, MapPin, AlertCircle, Info } from 'lucide-react';
import api from '../services/api';

const COLORS = ['#16a34a', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const MultiLineChart = ({ datasets, labels }) => {
  if (!datasets || datasets.length === 0) return <div className="p-4 text-center text-text-muted">No chart data available</div>;
  
  const extractValid = (arr) => (arr || []).filter(v => v !== null && v !== undefined && v !== 0);
  
  let allValues = [];
  datasets.forEach(ds => {
      allValues = [...allValues, ...extractValid(ds.data)];
  });
  
  if (allValues.length === 0) return <div className="p-4 text-center text-text-muted">No valid prices to chart</div>;
  
  const maxVal = Math.max(...allValues) * 1.05; 
  const minVal = Math.max(0, Math.min(...allValues) * 0.95);

  const width = 600;
  const height = 240;
  const paddingX = 45;
  const paddingY = 20;
  const chartWidth = width - 2 * paddingX;
  const chartHeight = height - 2 * paddingY;
  
  const getX = (index) => paddingX + (index * (chartWidth / Math.max(labels.length - 1, 1)));
  const getY = (value) => height - paddingY - ((value - minVal) / (maxVal - minVal) * chartHeight);

  const createPath = (series) => {
    if (!series || !series.length) return "";
    let d = "";
    let isFirst = true;
    series.forEach((val, i) => {
      if (val === null || val === undefined || val === 0) {
        isFirst = true;
      } else {
        d += `${isFirst ? "M" : "L"} ${getX(i)} ${getY(val)} `;
        isFirst = false;
      }
    });
    return d.trim();
  };

  return (
    <div className="w-full overflow-x-auto hide-scrollbar">
      <div className="min-w-[500px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto drop-shadow-sm bg-white rounded-lg">
          {[0, 0.5, 1].map((pct, i) => {
            const y = paddingY + (pct * chartHeight);
            const val = maxVal - (pct * (maxVal - minVal));
            return (
              <g key={`y-${i}`}>
                <line x1={paddingX} y1={y} x2={width - 5} y2={y} stroke="#e5e7eb" strokeDasharray="4,4" />
                <text x={paddingX - 5} y={y + 3} textAnchor="end" fill="#9ca3af" fontSize="10 font-medium">₹{Math.round(val)}</text>
              </g>
            );
          })}
          
          {labels.map((m, i) => (
            <text key={i} x={getX(i)} y={height - 2} textAnchor="middle" fill="#9ca3af" fontSize="10">{m}</text>
          ))}
          
          {datasets.map((ds, dsIdx) => {
             const pathD = createPath(ds.data);
             return (
               <g key={ds.name}>
                 {pathD && <path d={pathD} fill="none" stroke={ds.color} strokeWidth="2.5" className="drop-shadow-sm" />}
                 {ds.data.map((val, i) => val ? (
                   <g key={`pt-${dsIdx}-${i}`} className="group cursor-pointer">
                       <circle cx={getX(i)} cy={getY(val)} r="4" fill={ds.color} stroke="#fff" strokeWidth="1.5" />
                       <text x={getX(i)} y={getY(val)-10} textAnchor="middle" fontSize="9" fill="#4b5563" className="opacity-0 group-hover:opacity-100 font-bold bg-white drop-shadow-sm">₹{val}</text>
                   </g>
                 ) : null)}
               </g>
             );
          })}
        </svg>
      </div>
    </div>
  );
};

const TrendBadge = ({ label, trend }) => {
  if (!trend) return null;
  const isPositive = trend.change_pct >= 0;
  return (
    <div className="flex flex-col p-3 rounded-xl bg-surface border border-border">
      <span className="text-[11px] text-text-muted">{label}</span>
      <div className="flex items-center mt-1 gap-1.5">
        <span className={`text-sm font-bold flex items-center ${isPositive ? 'text-success' : 'text-danger'}`}>
          {isPositive ? <TrendingUp size={14} className="mr-0.5" /> : <TrendingDown size={14} className="mr-0.5" />}
          {Math.abs(trend.change_pct).toFixed(1)}%
        </span>
        <span className="text-sm font-bold text-text ml-auto">₹{trend.prior_price || 'N/A'}</span>
      </div>
    </div>
  );
};

export default function MarketIntelligence() {
  const [snapshotData, setSnapshotData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Loading...');
  const [selectedCropId, setSelectedCropId] = useState(null);
  const [selectedMarkets, setSelectedMarkets] = useState({});
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchSnapshot();
  }, []);

  const fetchSnapshot = async () => {
    setLoading(true);
    setStatus('Loading...');
    try {
      const response = await api.request('/market/snapshot/');
      if (response && response.length > 0) {
          setSnapshotData(response);
          if (!selectedCropId || !response.find(r => r.crop_id === selectedCropId)) {
             setSelectedCropId(response[0].crop_id);
          }
          setStatus('Data loaded');
      } else {
          setSnapshotData([]);
          setStatus('No data available');
      }
    } catch (error) {
      console.error("Failed to fetch market snapshot", error);
      setSnapshotData([]);
      setStatus('Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const response = await api.importMarketData(file);
      alert(response?.message || 'Market data imported successfully!');
      fetchSnapshot();
    } catch (error) {
      console.error(error);
      alert('Failed to import market data: ' + (error.error || error.message || 'Unknown error'));
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  const selectedData = snapshotData.find(c => c.crop_id === selectedCropId);
  const availableMarkets = selectedData ? Object.keys(selectedData.markets_data || {}) : [];
  
  useEffect(() => {
      if (selectedData && availableMarkets.length > 0) {
          if (!selectedMarkets[selectedCropId]) {
              setSelectedMarkets(prev => ({ ...prev, [selectedCropId]: [availableMarkets[0]] }));
          }
      }
  }, [selectedCropId, availableMarkets, selectedMarkets, selectedData]);

  const currentActiveMarkets = selectedMarkets[selectedCropId] || [];
  
  const toggleMarket = (market) => {
      setSelectedMarkets(prev => {
          const current = prev[selectedCropId] || [];
          let updated;
          if (current.includes(market)) {
              updated = current.filter(m => m !== market);
              if (updated.length === 0) updated = [market];
          } else {
              updated = [...current, market];
          }
          return { ...prev, [selectedCropId]: updated };
      });
  };

  let chartDatasets = [];
  let chartLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  if (selectedData) {
      currentActiveMarkets.forEach((m, idx) => {
          const mData = selectedData.markets_data[m];
          if (mData && mData.chart_data && mData.chart_data.current_year) {
              chartDatasets.push({
                  name: m,
                  data: mData.chart_data.current_year,
                  color: COLORS[idx % COLORS.length]
              });
          }
      });
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-text">Market Intelligence</h1>
          <div className="flex items-center gap-2 mt-1 text-sm">
            <span className="text-text-muted">Real-time commodity prices</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                status === 'Loading...' ? 'bg-primary/10 text-primary' :
                status === 'Data loaded' ? 'bg-success/10 text-success' :
                'bg-danger/10 text-danger'
              }`}>
              {status}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
            <button 
                onClick={fetchSnapshot}
                className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-sm font-medium text-text hover:bg-gray-50 active:scale-95 transition-transform"
            >
                <RefreshCw size={16} className={loading ? "animate-spin text-primary" : ""} />
                <span className="hidden sm:inline">Refresh</span>
            </button>
            <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            <button 
                onClick={() => window.location.href = `${api.baseUrl}/market/template/`}
                className="flex items-center gap-2 px-3 py-2 bg-surface border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary/5 active:scale-95 transition-transform"
            >
                <span className="hidden sm:inline">Template</span>
                <span className="sm:hidden">TMPL</span>
            </button>
            <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50 active:scale-95 transition-transform"
            >
                <Upload size={16} /> 
                <span className="hidden sm:inline">{uploading ? 'Importing...' : 'Import Data'}</span>
                <span className="sm:hidden">{uploading ? '...' : 'Import'}</span>
            </button>
        </div>
      </div>

      {snapshotData.length > 0 && (
        <div className="w-full overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 hide-scrollbar">
          <div className="flex gap-2">
            {snapshotData.map(crop => (
              <button
                key={crop.crop_id}
                onClick={() => setSelectedCropId(crop.crop_id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full border text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
                  selectedCropId === crop.crop_id 
                    ? 'bg-primary text-white border-primary shadow-md' 
                    : 'bg-surface text-text border-border hover:bg-gray-50'
                }`}
              >
                <span className="font-bold">{crop.crop_name}</span>
                {crop.total_acres > 0 ? (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedCropId === crop.crop_id ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
                    {crop.total_acres} ac
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedData ? (
        <div className="space-y-4">
          
          {availableMarkets.length > 0 && (
             <div className="flex flex-wrap gap-2 mb-2 items-center">
                <span className="text-sm font-medium text-text-muted mr-2 flex items-center gap-1"><MapPin size={14}/> Markets:</span>
                {availableMarkets.map((m, idx) => {
                    const isActive = currentActiveMarkets.includes(m);
                    const color = COLORS[idx % COLORS.length];
                    return (
                        <button 
                            key={m} 
                            onClick={() => toggleMarket(m)}
                            className={`px-3 py-1 rounded-full text-xs font-bold border transition-all flex items-center gap-2`}
                            style={{ 
                                backgroundColor: isActive ? `${color}15` : 'transparent', 
                                borderColor: isActive ? color : '#e5e7eb',
                                color: isActive ? color : '#6b7280'
                            }}
                        >
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isActive ? color : '#d1d5db' }}></div>
                            {m}
                        </button>
                    )
                })}
             </div>
          )}

          {currentActiveMarkets.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {currentActiveMarkets.map(m => {
                    const mData = selectedData.markets_data[m];
                    if (!mData || !mData.latest_price) return null;
                    return (
                        <Card key={`price-${m}`} className="col-span-1 shadow-sm border border-border">
                          <CardContent className="p-4 md:p-5">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h3 className="font-bold text-text flex items-center gap-1.5">
                                    <MapPin size={16} className="text-primary"/> {m}
                                </h3>
                                <p className="text-xs text-text-muted mt-0.5">As of {mData.latest_price.date}</p>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2 mb-4">
                              <div className="text-center p-2 rounded-lg bg-surface">
                                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">High</p>
                                <p className="font-bold text-text">₹{mData.latest_price.high || 'N/A'}</p>
                              </div>
                              <div className="text-center p-2 rounded-lg bg-primary/5 border border-primary/20">
                                <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Modal</p>
                                <p className="text-lg font-bold text-primary">₹{mData.latest_price.modal || 'N/A'}</p>
                              </div>
                              <div className="text-center p-2 rounded-lg bg-surface">
                                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Low</p>
                                <p className="font-bold text-text">₹{mData.latest_price.low || 'N/A'}</p>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                              <TrendBadge label="1 Week Trend" trend={mData.trend_1_week} />
                              <TrendBadge label="1 Month Trend" trend={mData.trend_1_month} />
                            </div>
                          </CardContent>
                        </Card>
                    );
                })}
              </div>
          ) : (
              <div className="p-6 bg-surface border border-border rounded-xl text-center">
                  <p className="text-text-muted">Please select at least one market to view prices.</p>
              </div>
          )}

          <Card className="shadow-sm border border-border">
            <CardHeader className="p-4 md:p-5 pb-0 border-b-0">
              <CardTitle className="text-base font-bold text-text">Historical Price Trends (YTD)</CardTitle>
              <p className="text-xs text-text-muted mt-1">Modal price comparison across selected markets</p>
            </CardHeader>
            <CardContent className="p-4 md:p-5">
              <MultiLineChart datasets={chartDatasets} labels={chartLabels} />
            </CardContent>
          </Card>

          <Card className="shadow-sm border border-border">
            <CardHeader className="p-4 md:p-5 border-b border-border bg-surface/30">
              <CardTitle className="text-sm font-bold text-text flex items-center gap-2">
                <Calendar size={16} className="text-primary" />
                Historical Festival Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-5">
              {selectedData.festival_intelligence && selectedData.festival_intelligence.length > 0 ? (
                <div className="space-y-4">
                  {selectedData.festival_intelligence.map((fest, idx) => (
                    <div key={idx} className="border border-border rounded-xl p-4">
                      <div className="flex justify-between items-center mb-3">
                          <h4 className="font-bold text-sm text-text">{fest.festival_name} {fest.year}</h4>
                          <span className="text-xs text-text-muted bg-surface px-2 py-1 rounded-md border">{fest.date}</span>
                      </div>
                      
                      <div className="space-y-3">
                          {currentActiveMarkets.map(m => {
                              const obs = fest.observations?.[m];
                              if (!obs) return null;
                              
                              const isPositive = obs.change_pct >= 0;
                              return (
                                  <div key={`fest-${m}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg">
                                      <div className="font-bold text-sm flex items-center gap-2 text-text">
                                          <MapPin size={14} className="text-gray-400"/> {m}
                                      </div>
                                      <div className="flex items-center gap-4 text-sm">
                                          <div className="text-center">
                                              <p className="text-[10px] text-text-muted uppercase">Before</p>
                                              <p className="font-medium text-gray-700">₹{obs.price_before}</p>
                                          </div>
                                          <div className="text-gray-300">→</div>
                                          <div className="text-center">
                                              <p className="text-[10px] text-text-muted uppercase">During</p>
                                              <p className="font-bold text-primary">₹{obs.price_during}</p>
                                          </div>
                                          <div className="text-gray-300">→</div>
                                          <div className="text-center">
                                              <p className="text-[10px] text-text-muted uppercase">After</p>
                                              <p className="font-medium text-gray-700">₹{obs.price_after || 'N/A'}</p>
                                          </div>
                                      </div>
                                      <div className={`flex items-center gap-1 font-bold text-sm ${isPositive ? 'text-success' : 'text-danger'}`}>
                                          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                          {Math.abs(obs.change_pct)}%
                                      </div>
                                  </div>
                              )
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <AlertCircle size={24} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-600">Insufficient historical data available for reliable analysis.</p>
                  <p className="text-xs text-gray-400 mt-1">Festival and seasonal patterns are only shown when supported by uploaded historical data.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : !loading && status !== 'Loading...' && (
        <div className="text-center py-12 px-4 border border-dashed rounded-xl border-border">
          <Info className="mx-auto text-text-muted mb-3" size={32} />
          <h3 className="text-lg font-medium text-text mb-1">No crops available</h3>
          <p className="text-sm text-text-muted">Import market data to see intelligence insights.</p>
        </div>
      )}
    </div>
  );
}