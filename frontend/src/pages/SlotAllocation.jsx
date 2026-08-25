import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../auth/AuthProvider.jsx';
import WarehouseSVGViewer from '../components/WarehouseSVGViewer.jsx';

export default function SlotAllocation() {
  const auth = useContext(AuthContext);
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [viewMode, setViewMode] = useState('allocated'); // 'empty', 'allocated', 'batch'
  const [isSimulating, setIsSimulating] = useState(false);
  const [svgContent, setSvgContent] = useState('');

  // Auto-reload data
  const fetchData = () => {
    fetch('/data/registry/arrivals_history.json?t=' + Date.now())
      .then(res => {
        if (!res.ok) return [];
        return res.json();
      })
      .then(data => {
        setBatches(data);
        if (data.length > 0 && !selectedBatchId) {
            setSelectedBatchId(data[data.length - 1].batch_id);
        }
      })
      .catch(err => {
        console.error(err);
        setBatches([]);
      });
      
    // Fetch SVG
    fetchSVG(viewMode);
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (viewMode === 'batch' && selectedBatchId) {
      applyBatchDimming(selectedBatchId);
    } else {
      fetchSVG(viewMode);
      setTimeout(restoreDimming, 100);
    }
  }, [viewMode, batches, selectedBatchId]);

  const applyBatchDimming = (bId) => {
    const container = document.getElementById('svg-viewer-allocated');
    if (!container) return;
    const rects = container.querySelectorAll('rect[data-batch-id]');
    rects.forEach(rect => {
       if (parseInt(rect.getAttribute('data-batch-id')) !== bId) {
           rect.style.opacity = '0.15';
           rect.style.filter = 'grayscale(1)';
       } else {
           rect.style.opacity = '1.0';
           rect.style.filter = 'drop-shadow(0px 0px 4px rgba(255,255,255,0.8))';
       }
    });

    const texts = container.querySelectorAll('text[id^="text-id-"], text[id^="text-wt-"]');
    texts.forEach(text => {
       const slotId = text.id.replace('text-id-', '').replace('text-wt-', '');
       const rect = container.querySelector(`[id="rect-${slotId}"]`);
       if (rect && parseInt(rect.getAttribute('data-batch-id')) !== bId) {
           text.style.opacity = '0.15';
       } else {
           text.style.opacity = '1.0';
       }
    });
  };

  const restoreDimming = () => {
    const container = document.getElementById('svg-viewer-allocated');
    if (!container) return;
    container.querySelectorAll('rect[data-batch-id]').forEach(rect => {
       rect.style.opacity = '1.0';
       rect.style.filter = 'none';
    });
    container.querySelectorAll('text[id^="text-id-"], text[id^="text-wt-"]').forEach(text => {
       text.style.opacity = '1.0';
    });
  };

  const fetchSVG = (mode) => {
    if (mode === 'batch') return; // We don't fetch anything new for batch mode
    const file = mode === 'empty' ? '/svgs/warehouse_blueprint.svg' : '/svgs/warehouse_allocated.svg';
    fetch(file + '?t=' + Date.now())
      .then(r => r.text())
      .then(text => {
          setSvgContent(text);
      })
      .catch(err => console.error("SVG block:", err));
  };

  const resetWarehouse = async () => {
    const confirmed = window.confirm("This will clear all orders and reset the warehouse. Are you sure?");
    if (!confirmed) return;
    if (!auth?.token) {
        alert('You must be logged in to reset the warehouse.');
        return;
    }
    try {
        const res = await auth.authFetch('/api/reset-warehouse', { method: 'POST' });
        if (!res.ok) {
            let text = '';
            try { text = await res.text(); } catch (err) {}
            alert(`Reset failed: ${res.status} ${res.statusText}${text ? ' - ' + text : ''}`);
            return;
        }

        // Force reload the SVG with cache-busting
        fetchSVG('allocated');

        // Reset all UI state
        setBatches([]);
        setSelectedBatchId(null);
        setViewMode('empty');
        fetchData();
    } catch(e) {
        alert(`Reset failed: ${e.message || 'Network error'}`);
    }
  };

  const selectedBatch = batches.find(b => b.batch_id === selectedBatchId);
  const totalAllocated = batches.reduce((acc, b) => acc + b.slots_allocated.length, 0);

  const getDemandColor = (demand) => {
    if (demand >= 600) return 'bg-[#FFF7E6] text-[#B7791F] border border-[#E8C77B]';
    if (demand >= 300) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getShelfBadge = (slotId) => {
      const level = slotId.split('-').pop();
      const colors = {
          'L5': 'bg-slate-200 text-slate-600',
          'L4': 'bg-slate-300 text-slate-700',
          'L3': 'bg-slate-400 text-slate-800',
          'L2': 'bg-slate-600 text-white',
          'L1': 'bg-slate-900 text-white font-bold'
      };
      return <span className={`px-2 py-0.5 rounded text-xs ml-2 font-bold ${colors[level] || ''}`}>{level}</span>;
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      
      {/* Control Panel */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Slot Allocation Map</h1>
          <p className="text-slate-500 mt-1">Real-time footprint visualization based on physical arrivals.</p>
        </div>
        <div className="flex gap-4 mt-4 md:mt-0">
            <button 
                onClick={resetWarehouse} 
                className="px-4 py-2 border border-[#E8C77B] text-[#B7791F] hover:bg-[#FFF7E6] rounded font-semibold transition"
            >
                RESET WAREHOUSE
            </button>
        </div>
      </div>

      {/* Main Grid Split */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Main Layout Viewer (3 cols) */}
          <div className="lg:col-span-3 flex flex-col gap-6">
              
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                  <div className="border-b border-slate-200 p-4 bg-slate-50 flex justify-between items-center">
                    <h2 className="font-bold text-slate-800 text-lg">Layout Viewer</h2>
                    <div className="flex bg-slate-100 p-1 border border-slate-200 rounded">
                      <button onClick={() => setViewMode('empty')} className={`px-3 py-1 text-sm font-semibold rounded ${viewMode==='empty'?'bg-white shadow text-slate-800':'text-slate-500'}`}>Empty</button>
                      <button onClick={() => setViewMode('allocated')} className={`px-3 py-1 text-sm font-semibold rounded ${viewMode==='allocated'?'bg-white shadow text-blue-600':'text-slate-500'}`}>Cumulative</button>
                      <button onClick={() => setViewMode('batch')} className={`px-3 py-1 text-sm font-semibold rounded ${viewMode==='batch'?'bg-white shadow text-indigo-600':'text-slate-500'}`} disabled={!selectedBatch}>Batch View</button>
                    </div>
                  </div>
                  <div className="p-4 relative">
                     <WarehouseSVGViewer
                        svgContent={svgContent}
                        mode={viewMode}
                        containerId="svg-viewer-allocated"
                     />
                  </div>
              </div>

              {/* Cumulative Utilization Bar Chart Area */}
              <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                  <h3 className="font-bold text-slate-800 mb-4">Cumulative Zone Utilization</h3>
                  <div className="space-y-4">
                      {['A', 'B', 'C', 'D'].map(zone => {
                          const maxSlots = zone === 'A' || zone === 'B' ? 160 : 120; // 4 rows * 4 bays * 5 = 80 per pair, 2 pairs = 160! (Wait: 4 racks * 4 rows = 16. 16 * 5 = 80? No, pair has 2 rows. 2 pairs = 4 rows. 4 rows of 4 bays = 16 bays * 5 = 80 total per zone! Wait, Pair 1: Row A (4), Row B (4). Pair 2: Row A (4), Row B (4). So 4 rows. 4 * 4 = 16. 16 * 5 = 80 slots per zone.)
                          const zoneSlotsMap = {'A':160, 'B':160, 'C':120, 'D':120}; 
                          const mSlots = zoneSlotsMap[zone];
                          
                          let uTotal = 0;
                          let lCounts = {'L1':0, 'L2':0, 'L3':0, 'L4':0, 'L5':0};
                          
                          batches.forEach(b => {
                              b.slots_allocated.forEach(s => {
                                  if(s.Zone === zone) {
                                      uTotal++;
                                      lCounts[s['Slot ID'].split('-').pop()]++;
                                  }
                              })
                          });
                          
                          const pct = ((uTotal / mSlots) * 100).toFixed(1);
                          return (
                              <div key={zone}>
                                  <div className="flex justify-between text-sm mb-1">
                                      <span className="font-bold">Zone {zone}</span>
                                      <span className="text-slate-500">{uTotal}/{mSlots} slots ({pct}%)</span>
                                  </div>
                                  <div className="w-full bg-slate-100 h-3 rounded overflow-hidden">
                                      <div className={`h-full ${pct > 80 ? 'bg-[#B7791F]' : 'bg-slate-700'}`} style={{width:`${pct}%`}}></div>
                                  </div>
                                  <div className="flex gap-4 mt-1 text-xs text-slate-400 font-mono">
                                      {['L5','L4','L3','L2','L1'].map(lvl => (
                                          <span key={lvl}>{lvl}: <span className="text-slate-600 font-bold">{lCounts[lvl]}</span></span>
                                      ))}
                                  </div>
                              </div>
                          )
                      })}
                  </div>
              </div>

          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">
              
              {/* Arrival History Sidebar */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[400px]">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                    <h2 className="font-bold text-slate-800">Arrival History</h2>
                  </div>
                  <div className="overflow-y-auto flex-1 p-2 space-y-2">
                      {batches.length === 0 && <p className="text-slate-400 text-sm text-center p-4">No arrivals slotted yet.</p>}
                      {[...batches].reverse().map(b => (
                          <div 
                              key={b.batch_id}
                              onClick={() => { setSelectedBatchId(b.batch_id); setViewMode('batch'); }}
                              className={`p-3 rounded border cursor-pointer transition ${selectedBatchId === b.batch_id ? 'border-indigo-500 bg-[#F4F6F8]' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}
                          >
                              <div className="flex justify-between items-center font-bold text-slate-800">
                                  <span>Arrival #{b.global_arrival_id || b.batch_id} — <span className="font-mono text-xs">{b.order_id || 'ORD-SYNC'}</span></span>
                              </div>
                              <div className="text-xs text-slate-500 mt-1">{b.slots_allocated.length} items — {b.timestamp}</div>
                          </div>
                      ))}
                  </div>
              </div>

              {/* Selected Batch Manifest */}
              {selectedBatch && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1">
                  <div className="bg-[#F4F6F8] px-4 py-3 border-b border-indigo-100 flex justify-between items-center">
                    <h2 className="font-bold text-indigo-900 text-sm">Arrival #{selectedBatch.batch_id} Items</h2>
                  </div>
                  <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
                      <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-500 sticky top-0">
                              <tr>
                                  <th className="p-2 border-b">Item</th>
                                  <th className="p-2 border-b">Wt</th>
                                  <th className="p-2 border-b">Slot</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {selectedBatch.slots_allocated.map(item => (
                                  <tr key={item['Item ID']}>
                                      <td className="p-2 font-medium">{item['Item ID']}</td>
                                      <td className="p-2">{item['Weight(kg)']}</td>
                                      <td className="p-2 font-mono text-zinc-600 flex items-center">
                                          {item['Slot ID']}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
              )}
          </div>
          
      </div>
    </div>
  );
}
