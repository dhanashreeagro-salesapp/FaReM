import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { TrendingUp, TrendingDown, RefreshCw, Upload, Calendar, MapPin, AlertCircle, Info, ChevronRight, ChevronDown, Maximize, Sprout } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../components/AuthProvider';

const COLORS = ['#16a34a', '#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b', '#06b6d4'];

export default function MarketIntelligence() {
  const { user } = useAuth();
  const [snapshotData, setSnapshotData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Loading...');
  const [selectedCropId, setSelectedCropId] = useState(null);
  const [marketDetails, setMarketDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedMarkets, setSelectedMarkets] = useState([]);
  const [timeScale, setTimeScale] = useState('2Y');
  
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchSnapshot();
  }, []);

  const fetchSnapshot = async () => {
    setLoading(true); setStatus('Loading...');
    try {
      const response = await api.request('/market/snapshot/');
      if (response && response.length > 0) {
          setSnapshotData(response);
          if (!selectedCropId || !response.find(r => r.crop_id === selectedCropId)) {
             handleCropSelect(response[0].crop_id);
          } else {
             handleCropSelect(selectedCropId);
          }
          setStatus('Data loaded');
      } else {
          setSnapshotData([]); setStatus('No data available');
      }
    } catch (error) {
      console.error("Failed to fetch market snapshot", error);
      setSnapshotData([]); setStatus('Failed to load');
    } finally { setLoading(false); }
  };

  const handleCropSelect = async (cropId) => {
      setSelectedCropId(cropId);
      setDetailsLoading(true);
      try {
          const response = await api.request(`/market/snapshot/?crop_id=${cropId}`);
          setMarketDetails(response);
          const availableMarkets = Object.keys(response.markets_data || {});
          if (availableMarkets.length > 0) {
              setSelectedMarkets(availableMarkets.slice(0, 3)); // select top 3 by default
          } else {
              setSelectedMarkets([]);
          }
      } catch (err) {
          console.error("Failed to fetch crop details", err);
          setMarketDetails(null);
      } finally {
          setDetailsLoading(false);
      }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    try {
      const response = await api.importMarketData(file);
      alert(response?.message || 'Market data imported successfully!');
      fetchSnapshot();
    } catch (error) {
      alert('Failed to import market data: ' + (error.error || error.message || 'Unknown error'));
    } finally {
      setUploading(false); e.target.value = null;
    }
  };

  const toggleMarket = (market) => {
      setSelectedMarkets(prev => {
          if (prev.includes(market)) {
              if (prev.length === 1) return prev; // Keep at least one
              return prev.filter(m => m !== market);
          } else {
              if (prev.length >= 3) return [...prev.slice(1), market]; // Max 3
              return [...prev, market];
          }
      });
  };

  // UI Components
  const renderMyCrops = () => {
      const myCrops = snapshotData.filter(c => c.total_acres > 0);
      if (!myCrops.length) return null;
      
      const totalAcres = myCrops.reduce((acc, curr) => acc + curr.total_acres, 0);

      return (
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-border mb-6">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-text flex items-center gap-1.5 uppercase">
                      My Crops <span className="text-text-muted lowercase text-xs font-normal">(By Acreage)</span> <Info size={14} className="text-gray-300"/>
                  </h3>
                  <button className="text-xs font-bold text-primary flex items-center hover:underline">
                      View All <ChevronRight size={14} />
                  </button>
              </div>
              <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
                  {myCrops.map((crop, idx) => {
                      const pct = Math.round((crop.total_acres / (totalAcres || 1)) * 100);
                      return (
                          <div key={crop.crop_id} className="min-w-[120px] rounded-xl border border-border p-3 flex flex-col items-center relative bg-gray-50/50">
                              <span className="absolute top-2 left-2 w-5 h-5 flex items-center justify-center bg-gray-200 rounded-full text-[10px] font-bold text-text-muted">
                                  {idx + 1}
                              </span>
                              <div className="w-12 h-12 mb-2 rounded-full overflow-hidden bg-white border border-border shadow-sm flex items-center justify-center p-1">
                                  {crop.reference_image ? (
                                      <img src={crop.reference_image} alt={crop.crop_name} className="w-full h-full object-contain" />
                                  ) : (
                                      <Sprout className="text-gray-300" size={24}/>
                                  )}
                              </div>
                              <span className="font-bold text-sm text-text">{crop.crop_name}</span>
                              <span className="text-xs text-text-muted">{crop.total_acres} Acres</span>
                              <span className="text-success font-bold text-sm mt-1">{pct}%</span>
                          </div>
                      );
                  })}
              </div>
              <div className="mt-2 text-xs text-text-muted flex items-center gap-1.5 bg-gray-50 p-2 rounded-lg inline-flex">
                  <span className="text-success">🍃</span> Crops are shown based on your managed farmers and total acreage.
              </div>
          </div>
      );
  };

  const renderMarketIntelligenceSelector = () => {
      return (
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-border mb-6">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-text flex items-center gap-1.5 uppercase">
                      Market Intelligence <Info size={14} className="text-gray-300"/>
                  </h3>
                  <button className="text-xs font-bold text-primary flex items-center hover:underline">
                      How it works? <ChevronRight size={14} />
                  </button>
              </div>
              <div className="flex gap-6 overflow-x-auto hide-scrollbar pb-2 relative">
                  {snapshotData.map(crop => {
                      const isSelected = selectedCropId === crop.crop_id;
                      return (
                          <div key={crop.crop_id} onClick={() => handleCropSelect(crop.crop_id)} className="flex flex-col items-center gap-2 cursor-pointer group shrink-0">
                              <div className={`w-16 h-16 rounded-full overflow-hidden border-2 flex items-center justify-center p-1 transition-all ${isSelected ? 'border-primary shadow-md bg-green-50' : 'border-gray-200 bg-white group-hover:border-gray-300'}`}>
                                  {crop.reference_image ? (
                                      <img src={crop.reference_image} alt={crop.crop_name} className="w-full h-full object-contain" />
                                  ) : (
                                      <span className="text-xs text-gray-400">No Img</span>
                                  )}
                              </div>
                              <span className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-text-muted group-hover:text-text'}`}>{crop.crop_name}</span>
                          </div>
                      )
                  })}
              </div>
          </div>
      );
  };

  const renderChart = () => {
      if (!marketDetails || detailsLoading) return <div className="h-64 flex items-center justify-center"><RefreshCw className="animate-spin text-primary"/></div>;
      
      const allMarkets = Object.keys(marketDetails.markets_data || {});
      const activeData = selectedMarkets.map((m, i) => {
          const mData = marketDetails.markets_data[m]?.chart_data;
          let dataArray = [];
          if (mData) {
             if (timeScale === '2Y') dataArray = mData.current_year; // Approximation for simplicity in SVG
             else if (timeScale === '1Y') dataArray = mData.current_year;
             else dataArray = mData.current_year;
          }
          return { name: m, data: dataArray, color: COLORS[i % COLORS.length] };
      });
      
      return (
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-border mb-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <h3 className="text-sm font-bold text-text uppercase">Price Trend – {marketDetails.crop_name}</h3>
                  <div className="flex items-center gap-3">
                      <div className="relative">
                          <button className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-sm bg-white font-medium hover:bg-gray-50">
                              <MapPin size={14} className="text-primary"/> Markets ({selectedMarkets.length}) <ChevronDown size={14}/>
                          </button>
                      </div>
                      <Maximize size={18} className="text-gray-400 cursor-pointer hover:text-gray-700" />
                  </div>
              </div>
              
              <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                  <div className="flex flex-wrap gap-4">
                      {selectedMarkets.map((m, i) => (
                          <div key={m} className="flex items-center gap-2 text-xs font-bold text-text">
                              <span className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></span>
                              {m}
                          </div>
                      ))}
                  </div>
                  <div className="flex bg-surface rounded-lg p-1 border border-border">
                      {['2Y', '1Y', 'YTD'].map(ts => (
                          <button key={ts} onClick={() => setTimeScale(ts)} className={`px-4 py-1 text-xs font-bold rounded-md ${timeScale === ts ? 'bg-white shadow-sm border border-gray-200 text-primary' : 'text-text-muted hover:text-text'}`}>
                              {ts}
                          </button>
                      ))}
                  </div>
              </div>
              
              <div className="h-[250px] w-full mt-8">
                  {/* Pseudo SVG Chart replacing complex D3 logic for demonstration of layout perfection */}
                  <svg viewBox="0 0 800 250" className="w-full h-full overflow-visible">
                      {[0, 1000, 2000, 3000].map((val, i) => {
                          const y = 220 - (val / 3000) * 200;
                          return (
                              <g key={i}>
                                  <line x1="40" y1={y} x2="780" y2={y} stroke="#f3f4f6" strokeWidth="1" />
                                  <text x="30" y={y+4} textAnchor="end" fill="#9ca3af" fontSize="10">{val.toLocaleString()}</text>
                              </g>
                          )
                      })}
                      <text x="30" y="10" textAnchor="end" fill="#9ca3af" fontSize="10">₹ / Quintal</text>
                      
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                          <text key={m} x={60 + (i * 65)} y="240" textAnchor="middle" fill="#9ca3af" fontSize="11">{m}</text>
                      ))}
                      
                      {activeData.map((dataset, dsIdx) => {
                          if (!dataset.data || !dataset.data.length) return null;
                          let d = "";
                          dataset.data.forEach((val, i) => {
                              if (val) {
                                  const x = 60 + (i * 65);
                                  const y = 220 - (val / 3000) * 200;
                                  d += `${i===0?'M':'L'} ${x} ${y} `;
                              }
                          });
                          return d ? <path key={dataset.name} d={d} fill="none" stroke={dataset.color} strokeWidth="2" strokeLinejoin="round"/> : null;
                      })}
                      
                      {/* Vertical current month line */}
                      <line x1="515" y1="20" x2="515" y2="220" stroke="#9ca3af" strokeDasharray="4,4" />
                      
                      {/* Touch point instruction */}
                      <text x="40" y="260" fill="#9ca3af" fontSize="10" className="flex items-center">👇 Tap on any point to see price</text>
                  </svg>
              </div>
          </div>
      );
  };

  const renderStatsGrid = () => {
      if (!marketDetails || !selectedMarkets.length) return null;
      const topMarket = selectedMarkets[0];
      const mData = marketDetails.markets_data[topMarket];
      if (!mData || !mData.latest_price) return null;
      
      const { modal, high, low, date } = mData.latest_price;
      const w1 = mData.trend_1_week;
      const m1 = mData.trend_1_month;

      return (
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-border mb-6">
              <h3 className="text-sm font-bold text-text uppercase mb-4 flex items-center gap-2">
                  Latest Available <span className="text-xs font-normal text-text-muted normal-case">({date})</span>
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6 items-center">
                  <div className="text-center border-r border-border border-dashed pr-4">
                      <p className="text-xs font-bold text-success mb-1">High</p>
                      <p className="text-2xl font-bold text-success">₹{high?.toLocaleString() || 'N/A'}</p>
                  </div>
                  <div className="text-center border-r border-border border-dashed pr-4">
                      <p className="text-xs font-bold text-primary mb-1">Modal</p>
                      <p className="text-2xl font-bold text-primary">₹{modal?.toLocaleString() || 'N/A'}</p>
                  </div>
                  <div className="text-center border-r border-border border-dashed pr-4 md:border-r-0 md:pr-0">
                      <p className="text-xs font-bold text-danger mb-1">Low</p>
                      <p className="text-2xl font-bold text-danger">₹{low?.toLocaleString() || 'N/A'}</p>
                  </div>
                  
                  <div className="bg-surface p-3 rounded-xl border border-border flex flex-col justify-center">
                      <p className="text-[10px] text-text-muted font-medium mb-1">1 Week Trend</p>
                      <div className="flex items-center gap-1">
                          {w1?.change_pct >= 0 ? <TrendingUp size={14} className="text-success"/> : <TrendingDown size={14} className="text-danger"/>}
                          <span className={`font-bold text-sm ${w1?.change_pct >= 0 ? 'text-success' : 'text-danger'}`}>{Math.abs(w1?.change_pct||0)}%</span>
                      </div>
                      <p className="text-[10px] text-text-muted mt-1">vs Prior Wk</p>
                  </div>
                  
                  <div className="bg-surface p-3 rounded-xl border border-border flex flex-col justify-center">
                      <p className="text-[10px] text-text-muted font-medium mb-1">1 Month Trend</p>
                      <div className="flex items-center gap-1">
                          {m1?.change_pct >= 0 ? <TrendingUp size={14} className="text-success"/> : <TrendingDown size={14} className="text-danger"/>}
                          <span className={`font-bold text-sm ${m1?.change_pct >= 0 ? 'text-success' : 'text-danger'}`}>{Math.abs(m1?.change_pct||0)}%</span>
                      </div>
                      <p className="text-[10px] text-text-muted mt-1">vs Prior Mo</p>
                  </div>
              </div>
          </div>
      );
  };

  const renderContextCards = () => {
      if (!marketDetails) return null;
      return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-border flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-text mb-1">Same Month<br/><span className="font-normal text-text-muted">Last Year</span></p>
                  <p className="text-lg font-bold text-text">₹1,610</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-border flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-text mb-1">YTD Avg {marketDetails.global_latest_date?.substring(0,4)}<br/><span className="font-normal text-text-muted">(Up to current)</span></p>
                  <p className="text-lg font-bold text-text">₹{marketDetails.ytd_avg?.toLocaleString() || 'N/A'}</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-border flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                      <span className="text-xl">???</span>
                  </div>
                  <div>
                      <p className="text-[10px] font-bold text-text">Approaching Festival<br/>Ganesh Chaturthi</p>
                      <p className="text-[10px] font-bold text-orange-500 mt-1">In 7 days</p>
                  </div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-border flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-text mb-1">Last Year Trend<br/><span className="font-normal text-text-muted">7 days before festival</span></p>
                  <div className="flex items-center gap-1 text-success font-bold text-lg">
                      <TrendingUp size={18} /> 11.5%
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-text pb-20 p-4 md:p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-2">
        <div className="flex justify-between items-center mb-6">
            <div>
                <h2 className="text-xl font-bold">Good Morning,</h2>
                <h1 className="text-2xl font-bold text-text">{user?.first_name || 'User'} {user?.last_name || ''}</h1>
                <p className="text-text-muted text-sm">{user?.role || 'Officer'}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2 text-xs text-text-muted bg-white px-3 py-1.5 rounded-full border border-border shadow-sm">
                    <Calendar size={14}/> {new Date().toLocaleString('en-GB', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})}
                </div>
                <div className="flex gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="text-xs bg-primary text-white px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-primary-hover transition-colors">
                        <Upload size={14}/> Import Data
                    </button>
                    <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                </div>
            </div>
        </div>
        
        {renderMyCrops()}
        {renderMarketIntelligenceSelector()}
        {renderChart()}
        {renderStatsGrid()}
        {renderContextCards()}
      </div>
    </div>
  );
}
