import re

def update_file():
    path = r"c:\Users\mdamo\OneDrive\Desktop\FaReM\web\src\pages\MarketIntelligence.jsx"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add recharts import
    import_stmt = "import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';\n"
    content = content.replace("import { TrendingUp,", import_stmt + "import { TrendingUp,")

    # 2. Add custom tooltip
    custom_tooltip = """
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
"""
    content = content.replace("export default function MarketIntelligence", custom_tooltip + "\nexport default function MarketIntelligence")

    # 3. Fix "No Img" to Sprout
    content = content.replace('<span className="text-xs text-gray-400">No Img</span>', '<Sprout className="text-gray-300" size={24}/>')

    # 4. Rewrite renderChart
    old_render_chart = re.search(r'const renderChart = \(\) => \{.*?^\s+};\n', content, re.DOTALL | re.MULTILINE)
    new_render_chart = """  const renderChart = () => {
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
"""
    if old_render_chart:
        content = content.replace(old_render_chart.group(0), new_render_chart)

    # 5. Add renderApproachingFestivals
    render_festivals = """  const renderApproachingFestivals = () => {
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
"""
    
    # 6. Add renderSeasonalPricePattern
    render_heatmap = """  const renderSeasonalPricePattern = () => {
      if (!marketDetails || !selectedMarkets.length) return null;
      const prefMarket = getPreferredMarket() || selectedMarkets[0];
      const mData = marketDetails.markets_data[prefMarket]?.chart_data;
      if (!mData) return null;
      
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const years = [
          { label: mData.two_years_ago_label || '2024', data: mData.two_years_ago },
          { label: mData.last_year_label || '2025', data: mData.last_year },
          { label: (mData.current_year_label || '2026') + ' (YTD)', data: mData.current_year }
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
                      <div className="grid grid-cols-13 gap-1 mb-2">
                          <div className="col-span-1"></div>
                          {months.map(m => (
                              <div key={m} className="col-span-1 text-center text-[10px] font-bold text-text-muted">{m}</div>
                          ))}
                      </div>
                      
                      {years.map(yr => (
                          <div key={yr.label} className="grid grid-cols-13 gap-1 mb-1 items-center">
                              <div className="col-span-1 text-[10px] font-bold text-text text-right pr-2">{yr.label}</div>
                              {yr.data.map((val, idx) => (
                                  <div key={idx} className="col-span-1 h-8 rounded text-[10px] font-bold text-text/80 flex items-center justify-center" style={{backgroundColor: getColor(val)}}>
                                      {val ? val.toLocaleString() : '-'}
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
"""
    
    # 7. Add context cards to have the right festival text
    # Actually wait, context cards are fine. Let's just insert the new components into the render function.
    
    old_return = re.search(r'        \{renderMyCrops\(\)\}.*?      </div>\n    </div>', content, re.DOTALL)
    new_return = """        {renderMyCrops()}
        {renderMarketIntelligenceSelector()}
        {renderChart()}
        {renderStatsGrid()}
        {renderContextCards()}
        {renderApproachingFestivals()}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderSeasonalPricePattern()}
            <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-border mb-6">
                 <h3 className="text-sm font-bold text-text uppercase mb-4">Supply Snapshot <span className="text-xs font-normal text-text-muted normal-case">(This Week)</span></h3>
                 <div className="flex items-center justify-center h-48 text-sm text-text-muted bg-gray-50 rounded-xl border border-dashed border-gray-200">
                     Supply data metrics unavailable
                 </div>
            </div>
        </div>
      </div>
    </div>"""
    
    if old_return:
        content = content.replace(old_return.group(0), new_return)
        
    content = content.replace("  const renderMyCrops = () => {", render_festivals + render_heatmap + "  const renderMyCrops = () => {")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

update_file()
