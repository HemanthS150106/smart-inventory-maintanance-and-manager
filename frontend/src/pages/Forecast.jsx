import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ForecastLineChart from '../components/ForecastLineChart.jsx'
import { buildDailyForecastSeries, computeForecastPageStats } from '../utils/forecastSeries.js'
import { loadCsv } from '../utils/loadCsv.js'

export default function Forecast() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([])
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)

  const [activeCategory, setActiveCategory] = useState('All')
  const [expandedId, setExpandedId] = useState(null)
  
  const [cart, setCart] = useState(() => {
     try { const stored = localStorage.getItem('inventoryCart'); return stored ? JSON.parse(stored) : []; }
     catch(e) { return []; }
  })

  useEffect(() => {
     localStorage.setItem('inventoryCart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const [csvRes, catalogRes] = await Promise.all([
          loadCsv('/api/forecast'),
          fetch('/item_meta.json').then(r => r.json())
        ]);
        if (cancelled) return;
        setRows(csvRes.data ?? []);
        setCatalog(Object.values(catalogRes ?? {}));
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, []);

  const catalogWithStats = useMemo(() => {
      // Find items that actually have forecasts
      const rowMap = {};
      rows.forEach(r => {
          const id = r.id || r.item_id || r.sku;
          if (!rowMap[id]) rowMap[id] = [];
          rowMap[id].push(r);
      });

      const processed = catalog.map(prod => {
         const pRows = rowMap[prod.item_id] || [];
         if (pRows.length === 0) return null;

         const series = buildDailyForecastSeries(pRows);
         const stats = computeForecastPageStats(pRows, series);
         
         const forecast28d = stats.totalForecast;
         const shortage = Math.max(0, forecast28d - prod.current_stock);
         
         let risk = 'Low';
         let riskVal = 0;
         if (shortage > forecast28d * 0.5) { risk = 'High'; riskVal = 2; }
         else if (shortage > forecast28d * 0.2) { risk = 'Med'; riskVal = 1; }

         // Calculate depletion data
         let depletion = [];
         let curr = prod.current_stock;
         for (let f of series.forecast) {
             curr -= f;
             depletion.push(curr);
         }

         return {
             ...prod,
             forecast28d,
             shortage,
             risk,
             riskVal,
             series,
             stats,
             depletion
         }
      }).filter(Boolean);

      return processed;
  }, [catalog, rows]);

  const displayList = useMemo(() => {
      let filtered = catalogWithStats;
      if (activeCategory !== 'All') {
          filtered = filtered.filter(p => p.category === activeCategory);
      }
      return filtered.sort((a,b) => b.shortage - a.shortage);
  }, [catalogWithStats, activeCategory]);

  const toggleCart = (prod) => {
      if (cart.some(c => c.item_id === prod.item_id)) {
          setCart(cart.filter(c => c.item_id !== prod.item_id));
      } else {
          setCart([...cart, {
              item_id: prod.item_id,
              display_name: `${prod.category} · Dept ${prod.dept} · #${prod.item_num} · ${prod.store}`,
              shortage: parseInt(prod.shortage),
              weight: prod.unit_weight_kg,
              size: prod.size,
              qty: parseInt(prod.shortage) || 10
          }]);
      }
  };

  const ExpandableRow = ({ p }) => {
      const isExpanded = expandedId === p.item_id;
      const inCart = cart.some(c => c.item_id === p.item_id);

      return (
          <>
          <tr className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 transition ${isExpanded ? 'bg-slate-50' : ''}`} onClick={() => setExpandedId(isExpanded ? null : p.item_id)}>
              <td className="p-3">
                 <div className="font-bold text-slate-800">
                    {p.category} · Dept {p.dept} · #{p.item_num} · {p.store}
                 </div>
                 <div className="text-xs text-slate-400 mt-0.5">{p.item_id}</div>
              </td>
              <td className="p-3">
                 <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{p.category}</span>
              </td>
              <td className="p-3 font-semibold text-slate-700">{p.forecast28d.toFixed(0)} u</td>
              <td className="p-3 font-semibold text-slate-700">{p.current_stock} u</td>
              <td className="p-3 font-bold text-red-600">{p.shortage > 0 ? `${p.shortage.toFixed(0)} u` : '-'}</td>
              <td className="p-3 font-bold">{p.risk}</td>
              <td className="p-3">
                 <button 
                    onClick={(e) => { e.stopPropagation(); toggleCart(p); }} 
                    className={`px-3 py-1 text-sm font-bold rounded shadow-sm transition ${inCart ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                 >
                    {inCart ? '✓ Added' : '+ Add'}
                 </button>
              </td>
          </tr>
          {isExpanded && (
              <tr>
                 <td colSpan="7" className="p-4 bg-slate-50 border-b border-slate-200">
                    <div className="flex flex-col lg:flex-row gap-6">
                        <div className="lg:w-2/3 bg-white p-4 rounded border shadow-sm border-slate-200">
                           <h4 className="font-bold text-sm text-slate-700 mb-2">28-Day Demand Trajectory</h4>
                           <ForecastLineChart 
                               labels={p.series.labels}
                               forecast={p.series.forecast}
                               lower={p.series.lower}
                               upper={p.series.upper}
                               reorderPoint={p.reorder_point}
                               depletionData={p.depletion}
                           />
                        </div>
                        <div className="lg:w-1/3 flex flex-col gap-4">
                            <div className="bg-slate-100 p-4 rounded border border-slate-200 text-sm text-slate-700">
                               <h4 className="font-bold text-sm text-slate-800 mb-1">Item Dimensions</h4>
                               <p>Weight: <strong>{p.unit_weight_kg} kg</strong> · Size: <strong>{p.size}</strong></p>
                            </div>
                        </div>
                    </div>
                 </td>
              </tr>
          )}
          </>
      )
  };

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Loading Warehouse Data...</div>;

  return (
    <div className="space-y-6 pb-32">
      <div className="text-xs font-bold text-slate-400 flex items-center gap-2 mb-4">
          <span className="text-blue-600">1. Review Forecast</span> ──► <span>2. Place Order</span> ──► <span>3. Mark Arrived</span> ──► <span>4. View Allocation</span>
      </div>

      <header>
         <h1 className="text-3xl font-bold text-slate-900">Demand Forecast</h1>
         <p className="text-slate-500 mt-1">Predicted demand for the next 28 days — review and place orders</p>
      </header>

      <div className="flex gap-2">
           {['All', 'FOODS', 'HOBBIES', 'HOUSEHOLD'].map(cat => (
               <button key={cat} onClick={()=>setActiveCategory(cat)} className={`px-4 py-2 text-sm font-bold rounded-full transition ${activeCategory===cat ? 'bg-[var(--si-primary)] text-white shadow' : 'bg-white border text-slate-600 hover:bg-slate-50'}`}>
                   {cat === 'All' ? 'All Items' : cat}
               </button>
           ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
             <thead className="bg-slate-100 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                 <tr>
                    <th className="p-4">Item</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Forecast (28d)</th>
                    <th className="p-4">Current Stock</th>
                    <th className="p-4">Shortage</th>
                    <th className="p-4">Risk</th>
                    <th className="p-4">Order</th>
                 </tr>
             </thead>
             <tbody>
                 {displayList.slice(0, 50).map(p => <ExpandableRow key={p.item_id} p={p} />)}
             </tbody>
          </table>
          {displayList.length > 50 && <div className="p-4 text-center text-slate-500 text-xs bg-slate-50 font-bold">Showing top 50 items. Filter by category to see more.</div>}
      </div>

      {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 p-4 pointer-events-none z-50 flex justify-center">
             <div className="bg-slate-900 text-white rounded-2xl shadow-2xl pointer-events-auto flex items-center justify-between px-6 py-4 w-full max-w-4xl border border-slate-700">
                 <div>
                    <div className="font-bold text-lg text-slate-100">Order Cart — {cart.length} items selected</div>
                    <div className="text-slate-400 text-sm mt-1 flex gap-3 truncate max-w-xl">
                       {cart.slice(0,3).map(c => <span key={c.item_id} className="bg-slate-800 px-2 py-0.5 rounded">{c.item_id.split('_').slice(0,3).join('_')} ({c.shortage}u)</span>)}
                       {cart.length > 3 && <span>[+ {cart.length - 3} more]</span>}
                    </div>
                 </div>
                 <button onClick={()=>navigate('/orders')} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition">
                     Review Order →
                 </button>
             </div>
          </div>
      )}
    </div>
  )
}