import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../auth/AuthProvider.jsx';

export default function CartAllocation() {
  const { authFetch } = useContext(AuthContext);
  const [carts, setCarts] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [pendingGroups, setPendingGroups] = useState([]);
  const [isClustering, setIsClustering] = useState(false);
  const [assignModal, setAssignModal] = useState({ show: false, group: null });
  const [selectedCart, setSelectedCart] = useState('');
  const [selectedWorker, setSelectedWorker] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  // Add Form States
  const [newCart, setNewCart] = useState({ max_weight_kg: 150, max_volume_cf: 40 });
  const [newWorker, setNewWorker] = useState({ name: '', role: 'picker', shift: 'morning' });

  const loadData = async () => {
    try {
      const cartsRes = await authFetch('/api/carts');
      const cartsData = await cartsRes.json();
      if (cartsData.success) setCarts(cartsData.carts);

      const workersRes = await authFetch('/api/workers?role=picker');
      const workersData = await workersRes.json();
      if (workersData.success) setWorkers(workersData.workers);

      const groupsRes = await authFetch('/api/cart-allocation/pending-groups');
      const groupsData = await groupsRes.json();
      if (groupsData.success) setPendingGroups(groupsData.groups);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const runClustering = async () => {
    setIsClustering(true);
    setMessage({ text: '', type: '' });
    try {
      const res = await authFetch('/api/cart-allocation/cluster', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (data.groups.length > 0) {
          setMessage({ text: `Successfully grouped items into ${data.groups.length} pending cart groups!`, type: 'success' });
        } else {
          setMessage({ text: data.message || 'No items available for clustering.', type: 'info' });
        }
        loadData();
      } else {
        setMessage({ text: data.error || 'Clustering failed.', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Clustering failed: Network error', type: 'error' });
    } finally {
      setIsClustering(false);
    }
  };

  const handleOpenAssignModal = (group) => {
    const availableCarts = carts.filter(c => c.status === 'available');
    if (availableCarts.length === 0) {
      alert('No available carts! Please add or free a cart first.');
      return;
    }
    const pickerWorkers = workers.filter(w =>
      w.role === 'picker' && w.is_active !== false
    );
    if (pickerWorkers.length === 0) {
      alert('No active picker workers available! Please add a picker worker first.');
      return;
    }
    setSelectedCart(availableCarts[0].cart_id);
    const defaultWorker = pickerWorkers.find(w => w.status === 'Available') || pickerWorkers[0];
    setSelectedWorker(defaultWorker.worker_id);
    setAssignModal({ show: true, group });
  };

  const handleAssign = async () => {
    try {
      const res = await authFetch('/api/cart-allocation/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart_group_id: assignModal.group.cart_group_id,
          cart_id: selectedCart,
          worker_id: selectedWorker
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: `Assigned group ${assignModal.group.cart_group_id} successfully.`, type: 'success' });
        setAssignModal({ show: false, group: null });
        loadData();
      } else {
        alert('Assignment failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Assignment failed: Network error');
    }
  };

  const handleAddCart = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/carts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCart)
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: `Cart ${data.cart_id} added successfully.`, type: 'success' });
        setNewCart({ max_weight_kg: 150, max_volume_cf: 40 });
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveCart = async (cartId) => {
    if (!window.confirm(`Are you sure you want to remove Cart ${cartId}?`)) return;
    try {
      const res = await authFetch(`/api/carts/${cartId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: 'Cart removed successfully.', type: 'success' });
        loadData();
      } else {
        alert(data.error || 'Failed to remove cart.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddWorker = async (e) => {
    e.preventDefault();
    if (!newWorker.name) return;
    try {
      const res = await authFetch('/api/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWorker)
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: `Worker ${data.worker_id} (Login: ${data.login_id}) added successfully.`, type: 'success' });
        setNewWorker({ name: '', role: 'picker', shift: 'morning' });
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveWorker = async (workerId) => {
    if (!window.confirm(`Are you sure you want to deactivate worker ${workerId}?`)) return;
    try {
      const res = await authFetch(`/api/workers/${workerId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: 'Worker deactivated successfully.', type: 'success' });
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      
      {/* Title Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Cart Allocation & Dispatch</h1>
        <p className="text-slate-500 mt-1">Spatial grouping of pending warehouse arrivals and dispatching to worker carts.</p>
      </div>

      {/* Message Alert banner */}
      {message.text && (
        <div className={`p-4 rounded-lg border text-sm font-semibold ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Grid Allocation Split */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Side: Clustering & Pending Groups (2 cols on large screen) */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          
          {/* Section A: Clustering */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-2">Clustering Engine</h2>
            <p className="text-slate-500 text-sm mb-4">
              Groups arrived items (marked as 'Slot Only') that are physically clustered on the warehouse floor using a Fuzzy C-Means algorithm.
            </p>
            <button
              onClick={runClustering}
              disabled={isClustering}
              className="si-btn bg-[var(--si-primary)] text-white font-semibold py-2 px-4 rounded hover:bg-opacity-95 disabled:opacity-50 transition"
            >
              {isClustering ? 'Clustering in progress...' : 'Group Slot-Only Items into Carts'}
            </button>
          </div>

          {/* Section B: Pending Cart Groups */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <h2 className="font-bold text-slate-800">Pending Cart Groups (Unassigned)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-700">
                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-xs">
                  <tr>
                    <th className="p-3">Group ID</th>
                    <th className="p-3">Items Count</th>
                    <th className="p-3">Items List</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pendingGroups.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-4 text-center text-slate-400">No pending groups. Run clustering first!</td>
                    </tr>
                  ) : (
                    pendingGroups.map(g => (
                      <tr key={g.cart_group_id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-slate-800">{g.cart_group_id}</td>
                        <td className="p-3">{g.items.length} items</td>
                        <td className="p-3 font-mono text-xs max-w-xs truncate" title={g.items.map(i => i.item_id).join(', ')}>
                          {g.items.map(i => i.item_id.split('_').slice(0,3).join('_')).join(', ')}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleOpenAssignModal(g)}
                            className="bg-indigo-600 text-white text-xs font-semibold py-1 px-3 rounded hover:bg-indigo-700 transition"
                          >
                            Assign →
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Side: Manage Carts */}
        <div className="flex flex-col gap-6">
          
          {/* Section C: Manage Carts */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-bold text-slate-800">Manage Carts</h2>
            </div>
            
            {/* Add Cart Form */}
            <form onSubmit={handleAddCart} className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Max Weight (kg)</label>
                <input
                  type="number"
                  value={newCart.max_weight_kg}
                  onChange={(e) => setNewCart({ ...newCart, max_weight_kg: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded p-1.5 text-sm bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Max Volume (cf)</label>
                <input
                  type="number"
                  value={newCart.max_volume_cf}
                  onChange={(e) => setNewCart({ ...newCart, max_volume_cf: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded p-1.5 text-sm bg-white"
                  required
                />
              </div>
              <div className="col-span-2">
                <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-1.5 px-3 rounded text-sm transition">
                  + Add New Cart
                </button>
              </div>
            </form>

            {/* Carts Table */}
            <div className="overflow-y-auto max-h-[300px]">
              <table className="w-full text-xs text-left text-slate-700">
                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase sticky top-0">
                  <tr>
                    <th className="p-2">Cart ID</th>
                    <th className="p-2">Capacity</th>
                    <th className="p-2">Status</th>
                    <th className="p-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {carts.map(c => (
                    <tr key={c.cart_id} className="hover:bg-slate-50">
                      <td className="p-2 font-mono font-bold text-slate-800">{c.cart_id}</td>
                      <td className="p-2">{c.max_weight_kg}kg / {c.max_volume_cf}cf</td>
                      <td className="p-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          c.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        <button
                          onClick={() => handleRemoveCart(c.cart_id)}
                          disabled={c.status !== 'available'}
                          className="text-red-600 hover:text-red-800 font-semibold disabled:opacity-30 transition"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

      {/* Bottom Grid: Manage Workers */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
          <h2 className="font-bold text-slate-800 text-lg">Manage Picker Workers</h2>
        </div>
        
        {/* Add Worker Form */}
        <form onSubmit={handleAddWorker} className="p-6 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-semibold text-slate-600 mb-1">Worker Name</label>
            <input
              type="text"
              placeholder="e.g. John Doe"
              value={newWorker.name}
              onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })}
              className="w-full border border-slate-300 rounded p-2 text-sm bg-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Role</label>
            <select
              value={newWorker.role}
              onChange={(e) => setNewWorker({ ...newWorker, role: e.target.value })}
              className="border border-slate-300 rounded p-2 text-sm bg-white"
            >
              <option value="picker">Picker</option>
              <option value="packer">Packer</option>
              <option value="shipper">Shipper</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Shift</label>
            <select
              value={newWorker.shift}
              onChange={(e) => setNewWorker({ ...newWorker, shift: e.target.value })}
              className="border border-slate-300 rounded p-2 text-sm bg-white"
            >
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="night">Night</option>
            </select>
          </div>
          <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded text-sm transition">
            + Add New Worker
          </button>
        </form>

        {/* Workers Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-xs">
              <tr>
                <th className="p-3">Worker ID</th>
                <th className="p-3">Login ID</th>
                <th className="p-3">Name</th>
                <th className="p-3">Role</th>
                <th className="p-3">Shift</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {workers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-4 text-center text-slate-400">No active workers. Add one above!</td>
                </tr>
              ) : (
                workers.map(w => (
                  <tr key={w.worker_id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-800">{w.worker_id}</td>
                    <td className="p-3 font-mono text-indigo-600">{w.login_id}</td>
                    <td className="p-3 font-semibold">{w.name}</td>
                    <td className="p-3 capitalize">{w.role}</td>
                    <td className="p-3 capitalize">{w.shift}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleRemoveWorker(w.worker_id)}
                        className="text-red-600 hover:text-red-800 font-semibold"
                      >
                        Deactivate
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Dialog Modal */}
      {assignModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Assign Group: {assignModal.group.cart_group_id}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Select Cart</label>
                <select
                  value={selectedCart}
                  onChange={(e) => setSelectedCart(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2 text-sm bg-white"
                >
                  {carts.filter(c => c.status === 'available').map(c => (
                    <option key={c.cart_id} value={c.cart_id}>
                      {c.cart_id} ({c.max_weight_kg}kg limit)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Select Active Worker</label>
                <select
                  value={selectedWorker}
                  onChange={(e) => setSelectedWorker(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2 text-sm bg-white"
                >
                  {workers
                    .filter(w => w.role === 'picker' && w.is_active !== false)
                    .map(w => (
                      <option
                        key={w.worker_id}
                        value={w.worker_id}
                        disabled={w.status !== 'Available'}
                      >
                        {w.name} {w.status !== 'Available' ? '(Busy)' : '(Available)'}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setAssignModal({ show: false, group: null })}
                className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                className="px-4 py-2 bg-indigo-600 text-white rounded font-semibold hover:bg-indigo-700 transition"
              >
                Confirm & Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
