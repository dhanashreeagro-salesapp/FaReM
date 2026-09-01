import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { TrendingUp, TrendingDown, RefreshCw, Upload, Calendar, MapPin, AlertCircle, Info } from 'lucide-react';
import api from '../services/api';

const LineChart = ({ data }) => {
  if (!data || !data.months || !data.months.length) return <div className="p-4 text-center text-text-muted">No chart data available</div>;
  
  const { months, current_year, last_year, two_years_ago, current_year_label, last_year_label, two_years_ago_label } = data;
  
  // Flatten to find min/max, ignoring zeros which we consider as missing data
  const extractValid = (arr) => (arr || []).filter(v => v !== null && v !== undefined && v !== 0);
  const allValues = [...extractValid(current_year), ...extractValid(last_year), ...extractValid(two_years_ago)];
  
  if (allValues.length === 0) return <div className="p-4 text-center text-text-muted">No valid prices to chart</div>;
  
  const maxVal = Math.max(...allValues) * 1.05; 
  const minVal = Math.max(0, Math.min(...allValues) * 0.95);

  const width = 600;
  const height = 240;
  const paddingX = 45;
  const paddingY = 20;
  
  const chartWidth = width - 2 * paddingX;
  const chartHeight = height - 2 * paddingY;
  
  const getX = (index) => paddingX + (index * (chartWidth / Math.max(months.length - 1, 1)));
  const getY = (value) => height - paddingY - ((value - minVal) / (maxVal - minVal) * chartHeight);

  const createPath = (series) => {
    if (!series || !series.length) return "";
    let d = "";
    let isFirst = true;
    series.forEach((val, i) => {
      if (val === null || val === undefined || val === 0) {
        isFirst = true; // Break line
      } else {
        const prefix = isFirst ? "M" : "L";
        d += `${prefix} ${getX(i)} ${getY(val)} `;
        isFirst = false;
      }
    });
    return d.trim();
  };

  const currentYearPath = createPath(current_year);
  const lastYearPath = createPath(last_year);
  const twoYearsAgoPath = createPath(two_years_ago);

  return (
    <div className="w-full overflow-x-auto hide-scrollbar pb-2">
      <div className="min-w-[500px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto text-xs font-mono select-none">
          {/* Grid lines */}
          <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#e5e7eb" strokeDasharray="3,3" />
          <line x1={paddingX} y1={height/2} x2={width - paddingX} y2={height/2} stroke="#e5e7eb" strokeDasharray="3,3" />
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#e5e7eb" />
          
          <text x={paddingX - 8} y={paddingY + 4} textAnchor="end" fill="#9ca3af">{Math.round(maxVal)}</text>
          <text x={paddingX - 8} y={height/2 + 4} textAnchor="end" fill="#9ca3af">{Math.round((maxVal+minVal)/2)}</text>
          <text x={paddingX - 8} y={height - paddingY + 4} textAnchor="end" fill="#9ca3af">{Math.round(minVal)}</text>
          
          {/* X axis labels */}
          {months.map((m, i) => (
            <text key={i} x={getX(i)} y={height - 2} textAnchor="middle" fill="#9ca3af" fontSize="10">{m}</text>
          ))}
          
          {/* Lines */}
          {two_years_agoPath && <path d={two_years_agoPath} fill="none" stroke="#d1d5db" strokeWidth="2" strokeDasharray="4,4" />}
          {lastYearPath && <path d={lastYearPath} fill="none" stroke="#9ca3af" strokeWidth="2" />}
          {currentYearPath && <path d={currentYearPath} fill="none" stroke="#16a34a" strokeWidth="3" />}
          
          {/* Data points for current year */}
          {current_year && current_year.map((val, i) => val ? (
            <circle key={`cy-${i}`} cx={getX(i)} cy={getY(val)} r="4" fill="#16a34a" stroke="#fff" strokeWidth="1.5" />
          ) : null)}
        </svg>
        
        {/* Legend */}
        <div className="flex justify-center flex-wrap gap-4 mt-3 text-xs text-text-muted">
          {current_year_label && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-success"></div>
              {current_year_label}
            </div>
          )}
          {last_year_label && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0 border-t-2 border-gray-400"></div>
              {last_year_label}
            </div>
          )}
          {two_years_ago_label && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0 border-t-2 border-dashed border-gray-300"></div>
              {two_years_ago_label}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TrendBadge = ({ label, trend }) => {
  if (!trend) return null;
  const isPositive = trend.change_pct >= 0;
  return (
    <div className="flex flex-col p-3 rounded-xl bg-surface border border-border">
      <span className="text-xs text-text-muted">{label}</span>
      <div className="flex items-center mt-1 gap-1.5">
        <span className={`text-sm font-bold flex items-center ${isPositive ? 'text-success' : 'text-danger'}`}>
          {isPositive ? <TrendingUp size={14} className="mr-0.5" /> : <TrendingDown size={14} className="mr-0.5" />}
          {Math.abs(trend.change_pct).toFixed(1)}%
        </span>
        <span className="text-sm font-bold text-text ml-auto">₹{trend.prior_price || 'N/A'}</span>
      </div>
      <span className="text-[10px] text-text-muted mt-1 opacity-70">Vs {trend.prior_date}</span>
    </div>
  );
};

export default function MarketIntelligence() {
  const [snapshotData, setSnapshotData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Loading...');
  const [selectedCropId, setSelectedCropId] = useState(null);
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
          if (!response[0].hasOwnProperty('crop_id')) {
              // Legacy backend API polyfill
              const polyfilled = response.map((item, idx) => ({
                  crop_id: `legacy-${idx}`,
                  crop_name: item.commodity_name,
                  total_acres: null,
                  latest_price: {
                      modal: item.modal_price,
                      high: item.max_price,
                      low: item.min_price,
                      date: item.date,
                      market: item.market_name
                  },
                  trend_1_week: item.change_7_day_percent != null ? {
                      change_pct: item.change_7_day_percent,
                      prior_price: item.prior_price,
                      prior_date: '7 days ago'
                  } : null,
                  trend_1_month: null,
                  same_month_last_year: null,
                  chart_data: null,
                  festival_intelligence: []
              }));
              setSnapshotData(polyfilled);
              if (!selectedCropId || !polyfilled.find(r => r.crop_id === selectedCropId)) {
                 setSelectedCropId(polyfilled[0].crop_id);
              }
              setStatus('Data loaded (Legacy API)');
          } else {
              setSnapshotData(response);
              if (!selectedCropId || !response.find(r => r.crop_id === selectedCropId)) {
                 setSelectedCropId(response[0].crop_id);
              }
              setStatus('Data loaded');
          }
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
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
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
                {crop.total_acres ? (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedCropId === crop.crop_id ? 'bg-white/20' : 'bg-gray-100'}`}>
                    {crop.total_acres} ac
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && snapshotData.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-text-muted">
          <RefreshCw size={32} className="animate-spin text-primary mb-4" />
          <p>Fetching market intelligence...</p>
        </div>
      ) : snapshotData.length === 0 ? (
        <div className="py-20 text-center text-text-muted bg-surface rounded-xl border border-dashed border-border">
          <Info size={32} className="mx-auto mb-3 opacity-50" />
          <p>{status === 'Failed to load' ? 'Failed to fetch market data.' : 'No crop market data available.'}</p>
        </div>
      ) : selectedData ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          
          <div className="lg:col-span-1 flex flex-col gap-4">
            <Card className="border-t-4 border-t-primary shadow-sm">
              <CardHeader className="pb-3 border-b border-border bg-gray-50/50">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg font-bold font-heading text-text">Latest Prices</CardTitle>
                    <div className="flex flex-col text-xs text-text-muted mt-1.5 gap-1">
                      {selectedData.latest_price?.market && (
                        <span className="flex items-center gap-1.5"><MapPin size={12} className="text-primary"/> {selectedData.latest_price.market}</span>
                      )}
                      {selectedData.latest_price?.date && (
                        <span className="flex items-center gap-1.5"><Calendar size={12} className="text-primary"/> {selectedData.latest_price.date}</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-5 pb-5">
                <div className="flex justify-between items-end">
                  <div className="text-center flex-1">
                    <div className="text-xs text-text-muted mb-1 uppercase tracking-wider font-semibold">High</div>
                    <div className="text-lg font-bold text-text">
                      {selectedData.latest_price?.high ? `₹${selectedData.latest_price.high}` : 'N/A'}
                    </div>
                  </div>
                  <div className="text-center flex-1 border-x border-border/50 px-2">
                    <div className="text-xs text-primary mb-1 uppercase tracking-wider font-bold">Modal</div>
                    <div className="text-3xl font-bold text-primary">
                      {selectedData.latest_price?.modal ? `₹${selectedData.latest_price.modal}` : 'N/A'}
                    </div>
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-xs text-text-muted mb-1 uppercase tracking-wider font-semibold">Low</div>
                    <div className="text-lg font-bold text-text">
                      {selectedData.latest_price?.low ? `₹${selectedData.latest_price.low}` : 'N/A'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <TrendBadge label="1 Week Trend" trend={selectedData.trend_1_week} />
              <TrendBadge label="1 Month Trend" trend={selectedData.trend_1_month} />
            </div>
            
            <Card className="shadow-sm">
              <CardHeader className="py-3 px-4 border-b border-border">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <AlertCircle size={16} className="text-primary"/> Festival Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {selectedData.festival_intelligence && selectedData.festival_intelligence.length > 0 ? (
                   <ul className="space-y-3">
                     {selectedData.festival_intelligence.map((fest, idx) => (
                       <li key={idx} className="flex gap-3 items-start">
                         <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                         <div>
                           <div className="text-sm font-bold">{fest.name}</div>
                           <div className="text-xs text-text-muted mt-0.5">{fest.impact_summary}</div>
                         </div>
                       </li>
                     ))}
                   </ul>
                ) : (
                  <div className="py-4 text-center text-xs text-text-muted bg-gray-50 rounded-lg border border-dashed border-gray-200">
                     No upcoming festival impacts identified.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            <Card className="shadow-sm">
              <CardHeader className="py-4 border-b border-border">
                <CardTitle className="text-md">Historical Price Trends</CardTitle>
                <p className="text-xs text-text-muted mt-1">Monthly modal price comparison across years</p>
              </CardHeader>
              <CardContent className="pt-4 pb-2 px-2 md:px-4">
                {selectedData.chart_data ? (
                  <LineChart data={selectedData.chart_data} />
                ) : (
                  <div className="py-12 text-center text-sm text-text-muted">Chart data not available</div>
                )}
              </CardContent>
            </Card>

            {selectedData.same_month_last_year && (
              <Card className="shadow-sm bg-gradient-to-br from-surface to-gray-50">
                <CardHeader className="py-3 px-4 border-b border-border/50">
                  <CardTitle className="text-sm">Year over Year Comparison</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                     <div className="flex-1">
                        <div className="text-xs text-text-muted mb-1">{selectedData.same_month_last_year.current_month || 'Current Month'}</div>
                        <div className="text-xl font-bold text-text">
                          {selectedData.same_month_last_year.current_price ? `₹${selectedData.same_month_last_year.current_price}` : 'N/A'}
                        </div>
                     </div>
                     
                     <div className="flex-1 flex justify-center">
                        {selectedData.same_month_last_year.change_pct !== undefined && selectedData.same_month_last_year.change_pct !== null && (
                          <div className={`flex flex-col items-center px-4 py-1.5 rounded-full shadow-sm ${
                              selectedData.same_month_last_year.change_pct >= 0 ? 'bg-success/10 border border-success/20 text-success' : 'bg-danger/10 border border-danger/20 text-danger'
                            }`}>
                              <span className="text-sm font-bold flex items-center">
                                {selectedData.same_month_last_year.change_pct >= 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                                {Math.abs(selectedData.same_month_last_year.change_pct).toFixed(1)}%
                              </span>
                              <span className="text-[9px] uppercase tracking-wider opacity-80 font-semibold mt-0.5">YoY Change</span>
                          </div>
                        )}
                     </div>
                     
                     <div className="flex-1 text-right">
                        <div className="text-xs text-text-muted mb-1">{selectedData.same_month_last_year.last_year_month || 'Last Year'}</div>
                        <div className="text-lg font-bold text-text">
                          {selectedData.same_month_last_year.last_year_price ? `₹${selectedData.same_month_last_year.last_year_price}` : 'N/A'}
                        </div>
                     </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
        </div>
      ) : null}
    </div>
  );
}
