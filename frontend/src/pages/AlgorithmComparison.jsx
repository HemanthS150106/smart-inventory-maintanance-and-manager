import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AlgorithmComparison() {
  const navigate = useNavigate();
  const [results,   setResults]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [sampleSize,setSampleSize]= useState(10);

  async function runComparison() {
    setLoading(true);
    try {
      const res  = await fetch(
        `/api/algorithm-compare?samples=${sampleSize}`
      );
      const data = await res.json();
      setResults(data);
    } catch (err) {
      alert('Comparison failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Verify login and role
    const admin = JSON.parse(
      sessionStorage.getItem('admin') || 'null'
    );
    if (!admin) { return; }
    if (admin.role !== 'simulation') {
      navigate('/home');
      return;
    }
    runComparison();
  }, []);

  if (loading) return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center',
      height:'100vh', flexDirection:'column', gap:'16px',
      background:'#f8fafc', fontFamily:'sans-serif'
    }}>
      <div style={{fontSize:'48px'}}>⚙️</div>
      <h2>Running algorithm comparison...</h2>
      <p style={{color:'#64748b'}}>
        Simulating {sampleSize} order scenarios with optimized and unoptimized configurations
      </p>
    </div>
  );

  return (
    <div style={{
      minHeight:'100vh', background:'#f8fafc',
      fontFamily:'sans-serif', display:'flex', flexDirection:'column'
    }}>
      {/* Simulation Header */}
      <div style={{
        background:'#1e293b', padding:'12px 24px',
        display:'flex', justifyContent:'space-between',
        alignItems:'center', borderBottom:'1px solid #334155',
        flexShrink:0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div>
            <h1 style={{margin:0, color:'white', fontSize:'18px'}}>
               Smart Inventory Simulation Module
            </h1>
            <p style={{margin:0, color:'#94a3b8', fontSize:'12px'}}>
              Logged in as Simulation Specialist
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => navigate('/simulation')}
              style={{
                padding: '6px 12px',
                background: '#334155',
                color: '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              🎮 Simulation
            </button>
            <button
              onClick={() => navigate('/algorithm-comparison')}
              style={{
                padding: '6px 12px',
                background: '#1e3a8a',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
               Comparison
            </button>
          </div>
        </div>
        <div style={{display:'flex', gap:'12px', alignItems:'center'}}>
          <label style={{color:'#e2e8f0', fontSize:'13px'}}>Sample orders:</label>
          <select value={sampleSize}
            onChange={e => setSampleSize(Number(e.target.value))}
            style={{padding:'6px 12px', borderRadius:'6px',
                    border:'1px solid #475569', background:'#334155', color:'white'}}>
            {[5,10,20,50].map(n => (
              <option key={n} value={n}>{n} orders</option>
            ))}
          </select>
          <button onClick={runComparison} disabled={loading}
            style={{
              padding:'8px 16px', background:'#1e40af',
              color:'white', border:'none', borderRadius:'6px',
              cursor:'pointer', fontWeight:'600', fontSize:'13px'
            }}>
            ↺ Re-run
          </button>
          <button onClick={() => {
            sessionStorage.removeItem('admin');
            sessionStorage.removeItem('worker');
            navigate('/login');
          }}
            style={{
              padding:'8px 16px', background:'#ef4444',
              color:'white', border:'none', borderRadius:'6px',
              cursor:'pointer', fontWeight:'600', fontSize:'13px'
            }}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ padding:'32px', maxWidth:'1200px', width:'100%', margin:'0 auto', boxSizing:'border-box' }}>
        <div style={{ marginBottom:'28px' }}>
          <h2 style={{margin:0, color:'#0f172a'}}>
             Algorithm Performance & Slotting Efficiency
          </h2>
          <p style={{margin:'6px 0 0', color:'#64748b'}}>
            Comparison of A* + NN search steps and path lengths against traditional Dijkstra and non-forecast (random) slotting models.
          </p>
        </div>

        {results && (
          <>
            {/* Summary cards */}
            <div style={{
              display:'grid', gridTemplateColumns:'repeat(4,1fr)',
              gap:'16px', marginBottom:'32px'
            }}>
              {[
                {
                  label: 'A* Routing Gain',
                  value: `${results.summary.distanceImprovement}%`,
                  desc:  'A* NN vs Dijkstra raw route',
                  color: '#22c55e', icon: '📏'
                },
                {
                  label: 'Search Steps Reduced',
                  value: `${results.summary.timeImprovement}%`,
                  desc:  'A* explores fewer nodes',
                  color: '#3b82f6', icon: '⏱️'
                },
                {
                  label: 'Forecast Slotting Benefit',
                  value: `${results.summary.forecastSlottingImprovement}%`,
                  desc:  'Distance saved vs random slots',
                  color: '#8b5cf6', icon: '🎯'
                },
                {
                  label: 'Average Distances',
                  value: `${results.summary.avgAstarDist} u`,
                  desc:  `Random: ${results.summary.avgUnoptimizedDist}u | Dijkstra: ${results.summary.avgDijkstraDist}u`,
                  color: '#0f172a', icon: ''
                }
              ].map(card => (
                <div key={card.label} style={{
                  background:'white', borderRadius:'12px',
                  padding:'20px', border:'1px solid #e2e8f0',
                  boxShadow:'0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <div style={{fontSize:'24px'}}>{card.icon}</div>
                  <div style={{
                    fontSize:'26px', fontWeight:'700',
                    color: card.color, margin:'8px 0 4px'
                  }}>
                    {card.value}
                  </div>
                  <div style={{fontWeight:'600', color:'#1e293b', fontSize:'14px'}}>
                    {card.label}
                  </div>
                  <div style={{fontSize:'12px', color:'#64748b',
                               marginTop:'4px'}}>
                    {card.desc}
                  </div>
                </div>
              ))}
            </div>

            {/* Per-order comparison table */}
            <div style={{
              background:'white', borderRadius:'12px',
              border:'1px solid #e2e8f0', overflow:'hidden',
              marginBottom:'32px', boxShadow:'0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                padding:'16px 20px',
                borderBottom:'1px solid #e2e8f0',
                fontWeight:'600', fontSize:'15px', color:'#0f172a'
              }}>
                Per-Order Scenarios
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{
                  width:'100%', borderCollapse:'collapse',
                  fontSize:'13px', textAlign:'left'
                }}>
                  <thead>
                    <tr style={{background:'#f8fafc', borderBottom:'1px solid #e2e8f0'}}>
                      {['Scenario', 'Items', 'Traditional Dijkstra', 'Non-Forecast (Random Slots)', 'Forecast-Optimized (Current)', 'Slotting Savings', 'Dijkstra Nodes', 'A* Nodes', 'Winner'].map(h => (
                        <th key={h} style={{
                          padding:'12px 16px', fontWeight:'600', color:'#475569'
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(results.scenarios||[]).map((s, i) => {
                      const slottingSaving = s.unoptimizedDist > 0 ? Math.round(((s.unoptimizedDist - s.astarDist) / s.unoptimizedDist) * 100) : 0;
                      return (
                        <tr key={i} style={{ borderBottom:'1px solid #f1f5f9' }}>
                          <td style={{padding:'12px 16px', fontWeight:'600', color:'#334155'}}>
                            #{i+1}
                          </td>
                          <td style={{padding:'12px 16px', color:'#334155'}}>
                            {s.itemCount} items
                          </td>
                          <td style={{padding:'12px 16px', color:'#dc2626'}}>
                            {s.dijkstraDist} u
                          </td>
                          <td style={{padding:'12px 16px', color:'#d97706'}}>
                            {s.unoptimizedDist} u
                          </td>
                          <td style={{padding:'12px 16px', color:'#16a34a', fontWeight:'bold'}}>
                            {s.astarDist} u
                          </td>
                          <td style={{padding:'12px 16px', color:'#8b5cf6', fontWeight:'600'}}>
                            {slottingSaving}% saved
                          </td>
                          <td style={{padding:'12px 16px', color:'#dc2626'}}>
                            {s.dijkstraSteps}
                          </td>
                          <td style={{padding:'12px 16px', color:'#16a34a'}}>
                            {s.astarSteps}
                          </td>
                          <td style={{padding:'12px 16px', fontWeight:'600', color:'#16a34a'}}>
                            🏆 A* (Opt)
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Why A* and forecasting is better explanation */}
            <div style={{
              background:'#eff6ff', borderRadius:'12px',
              padding:'24px', border:'1px solid #bfdbfe'
            }}>
              <h3 style={{margin:'0 0 16px', color:'#1e40af'}}>
                 Evaluating Search Heuristics and Demand Slotting Efficiency
              </h3>
              <div style={{
                display:'grid', gridTemplateColumns:'1fr 1fr',
                gap:'24px', fontSize:'14px', color:'#1e3a5f',
                lineHeight:'1.6'
              }}>
                <div>
                  <h4 style={{margin:'0 0 8px', color:'#1e40af'}}>
                    Impact of Demand-Based Forecasting (Slotting)
                  </h4>
                  <p style={{margin:0}}>
                    When items are slotted randomly without forecast data (<b>Non-Forecast Layout</b>), frequently co-ordered products end up scattered in remote racks or upper tiers. Placing items based on sales velocity and associations places high-demand items closer to primary aisles. This shortens the physical boundaries A* must solve, yielding <b>distance savings of {results.summary.forecastSlottingImprovement}%</b>.
                  </p>
                </div>
                <div>
                  <h4 style={{margin:'0 0 8px', color:'#16a34a'}}>
                    Impact of A* Routing over Dijkstra
                  </h4>
                  <p style={{margin:0}}>
                    Dijkstra's algorithm executes an uninformed search, exploring all nodes uniformly in radial waves. A* applies heuristic guidance directed strictly toward target storage grids. In complex aisle layouts, this goal-oriented navigation restricts search exploration to only relevant channels, resulting in a <b>{results.summary.timeImprovement}% reduction in pathfinding nodes checked</b>.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
