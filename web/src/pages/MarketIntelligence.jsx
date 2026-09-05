import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, RefreshCw, Upload, Calendar, MapPin, AlertCircle, Info, ChevronRight, ChevronDown, Maximize, Sprout } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../components/AuthProvider';

const COLORS = ['#16a34a', '#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b', '#06b6d4'];

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const HOST_BASE = API_BASE.replace('/api', '');

export const getImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('data:image')) return path;
  const baseUrl = HOST_BASE.replace(/\/$/, "");
  const imagePath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${imagePath}`;
};


const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-border shadow-md rounded-lg">
        <p className="font-bold text-sm mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-xs mb-1">
            <span className="w-2 h-2 rounded-full" style={{backgroundColor: entry.color}}></span>
            <span className="text-text-muted">{entry.name}:</span>
            <span className="font-bold">₹{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

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
  const renderApproachingFestivals = () => {
      if (!marketDetails || !marketDetails.festival_intelligence || marketDetails.festival_intelligence.length === 0) return null;
      
      return (
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-border mb-6">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-text uppercase">Approaching Festivals</h3>
                  <button className="text-xs font-bold text-primary flex items-center hover:underline">View All</button>
              </div>
              <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
                  {marketDetails.festival_intelligence.map((fest, idx) => {
                      // Calculate days away
                      const festDate = new Date(fest.date);
                      const today = new Date();
                      const diffTime = festDate - today;
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      
                      return (
                          <div key={idx} className="min-w-[200px] border border-border rounded-xl p-3 flex gap-3 items-center bg-gray-50/50">
                              <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                                  <span className="text-2xl">🎊</span>
                              </div>
                              <div>
                                  <p className="text-xs font-bold text-primary">{fest.festival_name}</p>
                                  <p className="text-[10px] text-text-muted">{festDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                  <p className="text-[10px] font-bold text-orange-500 mt-1">In {diffDays > 0 ? diffDays : 0} days</p>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };
  const renderSeasonalPricePattern = () => {
      if (!marketDetails || !selectedMarkets.length) return null;
      const prefMarket = getPreferredMarket() || selectedMarkets[0];
      const mData = marketDetails.markets_data[prefMarket]?.chart_data;
      const gData = marketDetails.global_chart_data;
      if (!mData && !gData) return null;
      
      const getVal = (yearKey, idx) => {
          if (mData && mData[yearKey] && mData[yearKey][idx] != null) {
              return mData[yearKey][idx];
          }
          if (gData && gData[yearKey] && gData[yearKey][idx] != null) {
              return gData[yearKey][idx];
          }
          return null;
      };
      
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      const two_years_ago = Array.from({length: 12}, (_, i) => getVal('two_years_ago', i));
      const last_year = Array.from({length: 12}, (_, i) => getVal('last_year', i));
      const current_year = Array.from({length: 12}, (_, i) => getVal('current_year', i));
      
      const activeData = mData || gData;
      
      const years = [
          { label: activeData.two_years_ago_label || '2024', data: two_years_ago },
          { label: activeData.last_year_label || '2025', data: last_year },
          { label: (activeData.current_year_label || '2026') + ' (YTD)', data: current_year }
      ];
      
      // Find min and max for color scaling
      let minPrice = Infinity;
      let maxPrice = -Infinity;
      years.forEach(yr => {
          yr.data.forEach(val => {
              if (val) {
                  if (val < minPrice) minPrice = val;
                  if (val > maxPrice) maxPrice = val;
              }
          });
      });
      
      const getColor = (val) => {
          if (!val) return 'transparent';
          if (minPrice === maxPrice) return '#fef08a'; // flat
          // Normalize between 0 and 1
          const ratio = (val - minPrice) / (maxPrice - minPrice);
          // 0 = green (low), 0.5 = yellow (mid), 1 = red (high)
          // HSL: 120 is green, 60 is yellow, 0 is red
          const hue = (1 - ratio) * 120;
          return `hsl(${hue}, 70%, 80%)`;
      };

      return (
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-border mb-6">
              <h3 className="text-sm font-bold text-text uppercase mb-4">Seasonal Price Pattern <span className="text-xs font-normal text-text-muted normal-case">(Last 3 Years)</span></h3>
              <p className="text-[10px] text-text-muted mb-2">₹/Quintal (Modal Price)</p>
              
              <div className="overflow-x-auto">
                  <div className="min-w-[600px]">
                      <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}>
                          <div className="col-span-1"></div>
                          {months.map(m => (
                              <div key={m} className="col-span-1 text-center text-[10px] font-bold text-text-muted">{m}</div>
                          ))}
                      </div>
                      
                      {years.map(yr => (
                          <div key={yr.label} className="grid gap-1 mb-1 items-center" style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}>
                              <div className="col-span-1 text-[10px] font-bold text-text text-right pr-2">{yr.label}</div>
                              {yr.data.map((val, idx) => (
                                  <div key={idx} className="col-span-1 h-8 rounded text-[10px] font-bold text-text/80 flex items-center justify-center" style={{backgroundColor: getColor(val)}}>
                                      {val ? val.toLocaleString() : 'NA'}
                                  </div>
                              ))}
                          </div>
                      ))}
                  </div>
              </div>
              
              <div className="flex items-center justify-center gap-2 mt-4 text-[10px] font-bold text-text-muted">
                  <span>Low</span>
                  <div className="w-48 h-2 rounded-full" style={{background: 'linear-gradient(to right, hsl(120,70%,80%), hsl(60,70%,80%), hsl(0,70%,80%))'}}></div>
                  <span>High</span>
              </div>
          </div>
      );
  };
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
                                      <img src={getImageUrl(crop.reference_image)} alt={crop.crop_name} className="w-full h-full object-contain" />
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
                                      <img src={getImageUrl(crop.reference_image)} alt={crop.crop_name} className="w-full h-full object-contain" />
                                  ) : (
                                      <Sprout className="text-gray-300" size={24}/>
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
      
      // Build Recharts data
      const chartData = [];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      for (let i = 0; i < 12; i++) {
          let row = { name: months[i] };
          selectedMarkets.forEach(m => {
              const mData = marketDetails.markets_data[m]?.chart_data;
              if (mData) {
                  if (timeScale === '2Y' || timeScale === '1Y' || timeScale === 'YTD') {
                      row[`${m}_current`] = mData.current_year[i];
                  }
                  if (timeScale === '2Y' || timeScale === '1Y') {
                      row[`${m}_last`] = mData.last_year[i];
                  }
                  if (timeScale === '2Y') {
                      row[`${m}_prev`] = mData.two_years_ago[i];
                  }
              }
          });
          chartData.push(row);
      }
      
      return (
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-border mb-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <h3 className="text-sm font-bold text-text uppercase">Price Trend – {marketDetails.crop_name}</h3>
                  <div className="flex items-center gap-3">
                      <div className="relative group">
                          <button className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-sm bg-white font-medium hover:bg-gray-50">
                              <MapPin size={14} className="text-primary"/> Markets ({selectedMarkets.length}) <ChevronDown size={14}/>
                          </button>
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-border shadow-lg rounded-xl overflow-hidden hidden group-hover:block z-10">
                              {allMarkets.map(m => (
                                  <div key={m} className="px-4 py-2 text-sm hover:bg-gray-50 cursor-pointer flex items-center gap-2" onClick={() => toggleMarket(m)}>
                                      <input type="checkbox" checked={selectedMarkets.includes(m)} readOnly className="rounded border-gray-300 text-primary focus:ring-primary" />
                                      {m}
                                  </div>
                              ))}
                          </div>
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
                  <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#9ca3af'}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} dx={-10} tickFormatter={(v) => v.toLocaleString()} />
                          <Tooltip content={<CustomTooltip />} />
                          {selectedMarkets.map((m, i) => (
                              <React.Fragment key={m}>
                                  {(timeScale === '2Y' || timeScale === '1Y' || timeScale === 'YTD') && (
                                      <Line type="monotone" dataKey={`${m}_current`} name={`${m} (Current)`} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{r:3}} activeDot={{r: 5}} connectNulls />
                                  )}
                                  {(timeScale === '2Y' || timeScale === '1Y') && (
                                      <Line type="monotone" dataKey={`${m}_last`} name={`${m} (Last Yr)`} stroke={COLORS[i % COLORS.length]} strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls />
                                  )}
                                  {(timeScale === '2Y') && (
                                      <Line type="monotone" dataKey={`${m}_prev`} name={`${m} (2 Yrs Ago)`} stroke={COLORS[i % COLORS.length]} strokeWidth={2} strokeDasharray="2 2" dot={false} connectNulls />
                                  )}
                              </React.Fragment>
                          ))}
                      </LineChart>
                  </ResponsiveContainer>
              </div>
          </div>
      );
  };

  const getPreferredMarket = () => {
      if (!marketDetails || !marketDetails.markets_data) return null;
      const allMarkets = Object.keys(marketDetails.markets_data);
      if (allMarkets.length === 0) return null;
      for (const pref of ['Mumbai', 'Pune', 'Nashik', 'Nagpur']) {
          if (allMarkets.includes(pref)) return pref;
      }
      return allMarkets[0];
  };

  const renderStatsGrid = () => {
      if (!marketDetails || !selectedMarkets.length) return null;
      const prefMarket = getPreferredMarket() || selectedMarkets[0];
      const mData = marketDetails.markets_data[prefMarket];
      if (!mData || !mData.latest_price) return null;
      
      const { modal, high, low, date } = mData.latest_price;
      const w1 = mData.trend_1_week;
      const m1 = mData.trend_1_month;

      return (
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-border mb-6">
              <h3 className="text-sm font-bold text-text uppercase mb-4 flex items-center gap-2">
                  Latest Available <span className="text-xs font-normal text-text-muted normal-case">({date} • {prefMarket})</span>
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
      const prefMarket = getPreferredMarket();
      const mData = prefMarket ? marketDetails.markets_data[prefMarket] : null;
      const sml = mData?.sml;
      
      let festivalData = null;
      if (marketDetails.festival_intelligence?.length > 0) {
          const fest = marketDetails.festival_intelligence[0];
          if (fest.observations && prefMarket && fest.observations[prefMarket]) {
              festivalData = { festival: fest, obs: fest.observations[prefMarket], market: prefMarket };
          } else if (fest.observations && Object.keys(fest.observations).length > 0) {
              const anyMarket = Object.keys(fest.observations)[0];
              festivalData = { festival: fest, obs: fest.observations[anyMarket], market: anyMarket };
          }
      }

      return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-border flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-text mb-1">
                      Same Month<br/><span className="font-normal text-text-muted">Last Year {prefMarket ? `(${prefMarket})` : ''}</span>
                  </p>
                  {sml ? (
                      <div>
                          <p className="text-lg font-bold text-text">₹{sml.prior_price?.toLocaleString() || 'N/A'}</p>
                          <div className={`flex items-center gap-1 text-[10px] font-bold mt-1 ${sml.change_pct >= 0 ? 'text-success' : 'text-danger'}`}>
                              {sml.change_pct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} 
                              {Math.abs(sml.change_pct)}% vs now
                          </div>
                      </div>
                  ) : <p className="text-sm font-bold text-text-muted">N/A</p>}
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-border flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-text mb-1">YTD Avg {marketDetails.global_latest_date?.substring(0,4)}<br/><span className="font-normal text-text-muted">(Up to current)</span></p>
                  <p className="text-lg font-bold text-text">₹{marketDetails.ytd_avg?.toLocaleString() || 'N/A'}</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-border flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                      <span className="text-xl">🎊</span>
                  </div>
                  <div>
                      <p className="text-[10px] font-bold text-text">Approaching Festival<br/>{festivalData ? festivalData.festival.festival_name : 'No upcoming'}</p>
                      {festivalData && (
                          <p className="text-[10px] font-bold text-orange-500 mt-1">Found market behavior</p>
                      )}
                  </div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-border flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-text mb-1">Last Year Trend<br/><span className="font-normal text-text-muted">Around Festival {festivalData ? `(${festivalData.market})` : ''}</span></p>
                  {festivalData ? (
                      <div className={`flex items-center gap-1 font-bold text-lg ${festivalData.obs.change_pct >= 0 ? 'text-success' : 'text-danger'}`}>
                          {festivalData.obs.change_pct >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                          {Math.abs(festivalData.obs.change_pct)}%
                      </div>
                  ) : <p className="text-sm font-bold text-text-muted">N/A</p>}
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
        {renderApproachingFestivals()}
        <div className="mb-6">
            {renderSeasonalPricePattern()}
        </div>
      </div>
    </div>
  );
}
