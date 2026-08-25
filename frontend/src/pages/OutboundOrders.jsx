import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../auth/AuthProvider.jsx';

export default function OutboundOrders() {
  const { authFetch } = useContext(AuthContext);
  const [slots, setSlots] = useState([]);
  const [dispatchOrders, setDispatchOrders] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [carts, setCarts] = useState([]);

  // Create Pick Order states
  const [selectedItems, setSelectedItems] = useState([]);
  const [itemToAdd, setItemToAdd] = useState('');
  const [qtyToAdd, setQtyToAdd] = useState(1);

  // Assign modal state
  const [assignModal, setAssignModal] = useState({ show: false, order: null });
  const [selectedWorker, setSelectedWorker] = useState('');
  const [selectedCart, setSelectedCart] = useState('');

  // Status message
  const [message, setMessage] = useState({ text: '', type: '' });

  const loadData = async () => {
    try {
      // 1. Fetch slots
      const slotsRes = await authFetch('/api/slots');
      const slotsData = await slotsRes.json();
      if (slotsData.success && slotsData.slots) {
        const occupied = Object.entries(slotsData.slots)
          .filter(([_, s]) => s.occupied && s.item_id)
          .map(([slot_id, s]) => ({ slot_id, ...s }));
        setSlots(occupied);
      }

      // 2. Fetch dispatch orders
      const dispatchRes = await authFetch('/api/dispatch');
      const dispatchData = await dispatchRes.json();
      if (dispatchData.success) {
        setDispatchOrders(dispatchData.dispatch_orders || []);
      }

      // 3. Fetch workers
      const workersRes = await authFetch('/api/workers?role=picker');
      const workersData = await workersRes.json();
      if (workersData.success) {
        setWorkers(workersData.workers || []);
      }

      // 4. Fetch carts
      const cartsRes = await authFetch('/api/carts');
      const cartsData = await cartsRes.json();
      if (cartsData.success) {
        setCarts(cartsData.carts || []);
      }
    } catch (err) {
      console.error('Error loading outbound dispatch flow data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter occupied slots to group unique items and track their total counts
  const availableItems = slots.reduce((acc, slot) => {
    const existing = acc.find(i => i.item_id === slot.item_id);
    if (existing) {
      existing.availableQty += 1;
    } else {
      acc.push({
        item_id: slot.item_id,
        availableQty: 1,
        slot_id: slot.slot_id
      });
    }
    return acc;
  }, []);

  // Automatically select the first available item if none selected
  useEffect(() => {
    if (availableItems.length > 0 && !itemToAdd) {
      setItemToAdd(availableItems[0].item_id);
    }
  }, [availableItems]);

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!itemToAdd) return;

    const matched = availableItems.find(i => i.item_id === itemToAdd);
    if (!matched) return;

    // Check if already added
    const existingIdx = selectedItems.findIndex(i => i.item_id === itemToAdd);
    if (existingIdx > -1) {
      const updated = [...selectedItems];
      updated[existingIdx].qty_needed += Number(qtyToAdd);
      setSelectedItems(updated);
    } else {
      setSelectedItems([...selectedItems, { item_id: itemToAdd, qty_needed: Number(qtyToAdd) }]);
    }

    setMessage({ text: '', type: '' });
  };

  const handleRemoveItem = (index) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const handleCreateOrder = async () => {
    if (selectedItems.length === 0) {
      setMessage({ text: 'Please add at least one item to the order.', type: 'error' });
      return;
    }

    try {
      const res = await authFetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedItems })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: `Successfully created dispatch order ${data.dispatch_order.dispatch_order_id}!`, type: 'success' });
        setSelectedItems([]);
        loadData();
      } else {
        setMessage({ text: data.error || 'Failed to create order.', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Network error occurred.', type: 'error' });
    }
  };

  const handleOpenAssignModal = (order) => {
    setAssignModal({ show: true, order });
    const availableCarts = carts.filter(c => c.status === 'available');
    const availableWorkers = workers.filter(w => w.status === 'Available');

    setSelectedCart(availableCarts[0]?.cart_id || '');
    setSelectedWorker(availableWorkers[0]?.worker_id || '');
  };

  const handleAssign = async () => {
    if (!selectedWorker || !selectedCart) {
      alert('Please select both a worker and a cart.');
      return;
    }

    const { order } = assignModal;
    const workerObj = workers.find(w => w.worker_id === selectedWorker);

    try {
      const res = await authFetch(`/api/dispatch/${order.dispatch_order_id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_id: selectedWorker, cart_id: selectedCart })
      });
      const data = await res.json();

      if (data.success) {
        // Required Alert formatting
        alert(`Worker: ${workerObj?.name} | Login: ${workerObj?.login_id}`);
        setAssignModal({ show: false, order: null });
        loadData();
      } else {
        alert(data.error || 'Assignment failed.');
      }
    } catch (err) {
      alert('Network error occurred during assignment.');
    }
  };

  const handleComplete = async (orderId) => {
    try {
      const res = await authFetch(`/api/dispatch/${orderId}/complete`, {
        method: 'PATCH'
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: `Order ${orderId} successfully completed and dispatched!`, type: 'success' });
        loadData();
      } else {
        setMessage({ text: data.error || 'Failed to complete order.', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Network error occurred.', type: 'error' });
    }
  };

  const pendingOrders = dispatchOrders.filter(o => o.status === 'pending' || o.status === 'assigned');
  const completedOrders = dispatchOrders.filter(o => o.status === 'dispatched');

  const availableWorkersList = workers.filter(w => w.status === 'Available');
  const availableCartsList = carts.filter(c => c.status === 'available');

  return (
    <div className="flex flex-col gap-8 pb-10 font-sans">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900"> Outbound Orders Dispatch Manager</h1>
        <p className="text-slate-500 text-sm mt-1">
          Create picking lists, assign loaders/carts, and track orders leaving the warehouse.
        </p>
      </div>

      {/* Alert message banner */}
      {message.text && (
        <div className={`p-4 rounded-lg border text-sm font-semibold transition-all ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          message.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* SECTION A — Create Pick Order */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-4"> SECTION A: Create Pick Order</h2>

            {availableItems.length === 0 ? (
              <div className="text-slate-400 text-sm py-6 text-center border-2 border-dashed border-slate-200 rounded-lg">
                No stock in warehouse to dispatch.
              </div>
            ) : (
              <form onSubmit={handleAddItem} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Select Slotted Item</label>
                  <select
                    value={itemToAdd}
                    onChange={e => setItemToAdd(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {availableItems.map(item => (
                      <option key={item.item_id} value={item.item_id}>
                        {item.item_id} ({item.availableQty} available)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Quantity Needed</label>
                  <input
                    type="number"
                    min="1"
                    value={qtyToAdd}
                    onChange={e => setQtyToAdd(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg text-sm transition"
                >
                   Add Item
                </button>
              </form>
            )}

            {/* List of items in current order being created */}
            {selectedItems.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Order Basket</h3>
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {selectedItems.map((item, index) => (
                    <div key={item.item_id} className="flex justify-between items-center py-2 text-sm">
                      <span className="font-mono text-slate-700 truncate max-w-[180px]">{item.item_id}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900">Qty: {item.qty_needed}</span>
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="text-rose-500 hover:text-rose-700 text-xs font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              onClick={handleCreateOrder}
              disabled={selectedItems.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
               Submit Outbound Order
            </button>
          </div>
        </div>

        {/* SECTION B — Pending Pick Orders */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4"> SECTION B: Pending Outbound Pick Orders</h2>

          {pendingOrders.length === 0 ? (
            <div className="text-slate-400 text-sm py-12 text-center border border-dashed border-slate-200 rounded-lg">
              No pending outbound pick orders.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold">
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Items Required</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created At</th>
                    <th className="py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingOrders.map(order => (
                    <tr key={order.dispatch_order_id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{order.dispatch_order_id}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          {order.items.map(item => (
                            <span key={item.item_id} className="text-xs text-slate-600">
                              <span className="font-mono text-slate-700">{item.item_id}</span> ({item.qty_needed}x)
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          order.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {order.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {new Date(order.created_at).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        {order.status === 'pending' ? (
                          <button
                            onClick={() => handleOpenAssignModal(order)}
                            className="bg-[#2F6B8A] hover:bg-[#1E3A5F] text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition"
                          >
                            Assign →
                          </button>
                        ) : (
                          <button
                            onClick={() => handleComplete(order.dispatch_order_id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition"
                          >
                            Complete ✓
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* SECTION C — Dispatch History */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 mb-4"> SECTION C: Completed Dispatch History</h2>

        {completedOrders.length === 0 ? (
          <div className="text-slate-400 text-sm py-8 text-center border border-dashed border-slate-200 rounded-lg">
            No orders completed/dispatched yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold">
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Items Picked</th>
                  <th className="py-3 px-4">Worker Picker</th>
                  <th className="py-3 px-4">Cart Used</th>
                  <th className="py-3 px-4">Dispatched At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {completedOrders.map(order => (
                  <tr key={order.dispatch_order_id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{order.dispatch_order_id}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1">
                        {order.items.map(item => (
                          <span key={item.item_id} className="text-xs text-slate-600">
                            <span className="font-mono text-slate-700">{item.item_id}</span> ({item.qty_needed}x)
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{order.assigned_worker_id}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{order.assigned_cart_id}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {new Date(order.dispatched_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assignment Modal */}
      {assignModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 w-[450px] overflow-hidden transform transition-all p-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
              <h3 className="font-bold text-slate-900 text-lg">
                Assign Order: {assignModal.order?.dispatch_order_id}
              </h3>
              <button
                onClick={() => setAssignModal({ show: false, order: null })}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Select Available Worker Picker</label>
                <select
                  value={selectedWorker}
                  onChange={e => setSelectedWorker(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="" disabled>-- Select Worker --</option>
                  {availableWorkersList.map(w => (
                    <option key={w.worker_id} value={w.worker_id}>
                      {w.name} ({w.login_id})
                    </option>
                  ))}
                </select>
                {availableWorkersList.length === 0 && (
                  <p className="text-[11px] text-rose-500 font-semibold mt-1"> No available workers found!</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Select Available Cart</label>
                <select
                  value={selectedCart}
                  onChange={e => setSelectedCart(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="" disabled>-- Select Cart --</option>
                  {availableCartsList.map(c => (
                    <option key={c.cart_id} value={c.cart_id}>
                      {c.cart_id} (Cap: {c.max_weight_kg}kg, {c.max_volume_cf}cf)
                    </option>
                  ))}
                </select>
                {availableCartsList.length === 0 && (
                  <p className="text-[11px] text-rose-500 font-semibold mt-1"> No available carts found!</p>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setAssignModal({ show: false, order: null })}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-lg text-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={!selectedWorker || !selectedCart}
                className="flex-1 bg-[#2F6B8A] hover:bg-[#1E3A5F] text-white font-bold py-2.5 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
