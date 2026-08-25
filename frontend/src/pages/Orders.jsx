import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../auth/AuthProvider.jsx';
import { useNavigate } from 'react-router-dom';

function getLevel(wt) {
    if (wt < 5.0) return 'L5';
    if (wt < 15.0) return 'L4';
    if (wt < 30.0) return 'L3';
    if (wt < 60.0) return 'L2';
    return 'L1';
}

export default function Orders() {
    const navigate = useNavigate();
    const auth = useContext(AuthContext);
    const [activeTab, setActiveTab] = useState('review'); // review, active
    const [cart, setCart] = useState([]);
    
    const [orders, setOrders] = useState([]);
    const [arrivalsData, setArrivalsData] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modal state
    const [arrivalModalOpen, setArrivalModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [arrivedItems, setArrivedItems] = useState(new Set()); // set of item_ids for the modal
    const [arrivalSearch, setArrivalSearch] = useState('');

    const closeArrivalModal = () => {
        setArrivalModalOpen(false);
        setArrivalSearch('');
        setSelectedOrder(null);
    };

    const filteredOrderItems = (selectedOrder?.items || []).filter(item => {
        if (!arrivalSearch.trim()) return true;
        const q = arrivalSearch.toLowerCase();
        return (
            item.item_id?.toLowerCase().includes(q) ||
            item.category?.toLowerCase().includes(q) ||
            item.size?.toLowerCase().includes(q) ||
            item.display_name?.toLowerCase().includes(q)
        );
    });

    useEffect(() => {
        try {
            const stored = localStorage.getItem('inventoryCart');
            if (stored) setCart(JSON.parse(stored));
        } catch(e) {}
        fetchActiveOrders();
    }, []);

    const fetchActiveOrders = async () => {
        setLoadingOrders(true);
        try {
            const [resOrders, resArr] = await Promise.all([
                fetch('/api/orders?t=' + Date.now()),
                fetch('/data/registry/arrivals_history.json?t=' + Date.now())
            ]);
            if (resOrders.ok) {
                const data = await resOrders.json();
                setOrders(data.orders || data);
            }
            if (resArr.ok) {
                const arrData = await resArr.json();
                setArrivalsData(arrData);
            }
        } catch(e) {}
        setLoadingOrders(false);
    };

    const handleQtyChange = (itemId, newQty) => {
        const val = Math.max(1, parseInt(newQty) || 1);
        const newCart = cart.map(c => c.item_id === itemId ? { ...c, qty: val } : c);
        setCart(newCart);
        localStorage.setItem('inventoryCart', JSON.stringify(newCart));
    };

    const removeCartItem = (itemId) => {
        const newCart = cart.filter(c => c.item_id !== itemId);
        setCart(newCart);
        localStorage.setItem('inventoryCart', JSON.stringify(newCart));
    }

    const confirmOrder = async () => {
        if (cart.length === 0) return;
        setIsSubmitting(true);
        try {
            const itemsToOrder = cart.map(c => ({
                item_id: c.item_id,
                display_name: c.display_name,
                qty_ordered: c.qty,
                estimated_level: getLevel(c.weight),
                weight: c.weight,
                arrived: false
            }));

            const payload = {
                order_id: 'ORD-' + Math.floor(1000 + Math.random() * 9000),
                placed_at: new Date().toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }),
                status: 'Ordered',
                items: itemsToOrder
            };

            const res = await (auth && auth.authFetch ? auth.authFetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }) : fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }));

            if (res.ok) {
                setCart([]);
                localStorage.removeItem('inventoryCart');
                setActiveTab('active');
                fetchActiveOrders();
            } else {
                let text = ''
                try { text = await res.text() } catch(e) {}
                alert(`Failed to place order. ${res.status} ${res.statusText} ${text}`)
            }
        } catch (e) {
            alert('Server unreachable');
        }
        setIsSubmitting(false);
    };

    const openArrivalModal = (order) => {
        setSelectedOrder(order);
        setArrivedItems(new Set(order.items.filter(i => i.arrived).map(i => i.item_id)));
        setArrivalModalOpen(true);
    };

    const toggleArrived = (itemId) => {
        const newSet = new Set(arrivedItems);
        if (newSet.has(itemId)) newSet.delete(itemId);
        else newSet.add(itemId);
        setArrivedItems(newSet);
    };

    const confirmArrival = async () => {
        if (arrivedItems.size === 0) return alert('Select at least one arrived item.');
        setIsSubmitting(true);
        try {
            const payload = {
                order_id: selectedOrder.order_id,
                arrived_item_ids: Array.from(arrivedItems)
            };
            const res = await (auth && auth.authFetch ? auth.authFetch('/api/arrive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }) : fetch('/api/arrive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }));
            if (res.ok) {
                closeArrivalModal();
                navigate('/warehouse');
            } else {
                let text = ''
                try { text = await res.text() } catch(e) {}
                alert(`Failed to mark arrived. ${res.status} ${res.statusText} ${text}`)
            }
        } catch(e) {
            alert('Server unreachable');
        }
        setIsSubmitting(false);
    };

    return (
        <div className="space-y-6 pb-20 max-w-5xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900">Orders Management</h1>
            </header>

            <div className="flex border-b border-slate-200 gap-8 mb-6">
                <button 
                    onClick={() => setActiveTab('review')}
                    className={`pb-3 font-bold text-lg transition ${activeTab === 'review' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    Order Review {cart.length > 0 && <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">{cart.length}</span>}
                </button>
                <button 
                    onClick={() => { setActiveTab('active'); fetchActiveOrders(); }}
                    className={`pb-3 font-bold text-lg transition ${activeTab === 'active' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    Active Orders
                </button>
            </div>

            {activeTab === 'review' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    {cart.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">
                            <span className="text-4xl block mb-2"></span>
                            <div className="font-bold text-lg">Your order cart is empty.</div>
                            <div className="text-sm">Go to the Demand Forecast page to review and add items.</div>
                        </div>
                    ) : (
                        <>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 border-b font-bold tracking-wide uppercase text-[11px]">
                                <tr>
                                    <th className="p-4">Item</th>
                                    <th className="p-4">Shortage</th>
                                    <th className="p-4">Qty to Order</th>
                                    <th className="p-4">Est. Placement</th>
                                    <th className="p-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {cart.map(c => (
                                    <tr key={c.item_id}>
                                        <td className="p-4">
                                            <div className="font-bold text-slate-800">{c.display_name}</div>
                                            <div className="text-xs text-slate-400">{c.item_id}</div>
                                        </td>
                                        <td className="p-4 text-[#B7791F] font-bold">{c.shortage} u</td>
                                        <td className="p-4">
                                            <input 
                                                type="number" 
                                                value={c.qty}
                                                onChange={(e) => handleQtyChange(c.item_id, e.target.value)}
                                                className="border rounded w-24 p-1.5 font-bold text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            />
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-[#1E3A5F]">Zone Auto · {getLevel(c.weight)}</div>
                                            <div className="text-xs text-slate-500">(weight: {c.weight}kg)</div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button onClick={() => removeCartItem(c.item_id)} className="text-slate-400 hover:text-[#C94A4A]">✖</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="p-4 bg-slate-50 border-t flex justify-end">
                            <button 
                                onClick={confirmOrder}
                                disabled={isSubmitting}
                                className="bg-blue-600 text-white font-bold px-8 py-3 rounded hover:bg-blue-700 shadow flex items-center justify-center min-w-[200px]"
                            >
                                {isSubmitting ? 'Confirming...' : 'Confirm Order'}
                            </button>
                        </div>
                        </>
                    )}
                </div>
            )}

            {activeTab === 'active' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    {orders.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">No active orders found.</div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 border-b font-bold uppercase text-[11px] tracking-wide">
                                <tr>
                                    <th className="p-4">Order ID</th>
                                    <th className="p-4">Placed At</th>
                                    <th className="p-4">Items</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {[...orders].reverse().map(o => {
                                    const orderArrivals = arrivalsData.filter(a => a.order_id === o.order_id);
                                    
                                    return (
                                    <React.Fragment key={o.order_id}>
                                    <tr className="hover:bg-slate-50">
                                        <td className="p-4 font-bold font-mono text-slate-700">{o.order_id}</td>
                                        <td className="p-4 text-slate-500">{o.placed_at}</td>
                                        <td className="p-4 font-semibold">{o.items.length} items</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                o.status === 'Ordered' ? 'bg-amber-100 text-amber-800' :
                                                o.status === 'Complete' ? 'bg-green-100 text-green-800' :
                                                'bg-blue-100 text-blue-800'
                                            }`}>
                                                {o.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            {o.status !== 'Complete' ? (
                                                <button onClick={() => openArrivalModal(o)} className="text-blue-600 font-bold hover:underline">Mark Arrived →</button>
                                            ) : (
                                                <span className="text-slate-400 font-bold italic">All Slotted</span>
                                            )}
                                        </td>
                                    </tr>
                                    {orderArrivals.map((arr, idx) => (
                                        <tr key={`${o.order_id}-arr-${idx}`} className="bg-slate-50/30">
                                            <td colSpan="5" className="pl-12 py-2 border-l-2 border-l-blue-400 border-b border-b-slate-100">
                                                <div className="flex gap-4 items-center text-xs text-slate-600 font-mono">
                                                    <span className="text-slate-400">└─</span>
                                                    <span className="font-bold text-slate-700">Arrival #{arr.global_arrival_id || arr.batch_id}</span>
                                                    <span>—</span>
                                                    <span>{arr.slots_allocated.length} item{arr.slots_allocated.length !== 1 ? 's' : ''}</span>
                                                    <span>—</span>
                                                    <span className="text-slate-500">{arr.timestamp}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    </React.Fragment>
                                )})}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ARRIVAL MODAL */}
            {arrivalModalOpen && selectedOrder && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b font-bold text-lg flex justify-between items-center bg-slate-50 rounded-t-xl">
                            <div>MARK ITEMS AS ARRIVED — <span className="font-mono text-blue-600">{selectedOrder.order_id}</span></div>
                            <button onClick={closeArrivalModal} className="text-slate-400 font-bold text-xl hover:text-slate-700">×</button>
                        </div>
                        
                        {/* Search Bar */}
                        <div style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid #e2e8f0',
                            background: '#f8fafc'
                        }}>
                            <div style={{ position: 'relative' }}>
                                <span style={{
                                    position: 'absolute', left: '12px',
                                    top: '50%', transform: 'translateY(-50%)',
                                    fontSize: '16px', pointerEvents: 'none'
                                }}>
                                    
                                </span>
                                <input
                                    type="text"
                                    placeholder="Search by item ID, category, size..."
                                    value={arrivalSearch}
                                    onChange={e => setArrivalSearch(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px 10px 38px',
                                        border: '1.5px solid #e2e8f0',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        boxSizing: 'border-box',
                                        outline: 'none',
                                        background: 'white'
                                    }}
                                    onFocus={e => e.target.style.borderColor = '#3b82f6'}
                                    onBlur={e  => e.target.style.borderColor = '#e2e8f0'}
                                    autoFocus
                                />
                                {arrivalSearch && (
                                    <button
                                        onClick={() => setArrivalSearch('')}
                                        style={{
                                            position: 'absolute', right: '10px',
                                            top: '50%', transform: 'translateY(-50%)',
                                            background: 'none', border: 'none',
                                            cursor: 'pointer', fontSize: '16px',
                                            color: '#94a3b8', padding: '4px'
                                        }}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                            {arrivalSearch && (
                                <p style={{
                                    margin: '8px 0 0', fontSize: '12px', color: '#64748b'
                                }}>
                                    {filteredOrderItems.length} of {selectedOrder?.items?.length || 0} items shown
                                </p>
                            )}
                        </div>

                        <div className="p-5 overflow-y-auto flex-1">
                            <p className="text-sm text-slate-500 font-bold mb-4">Select which items have physically arrived to the warehouse dock:</p>
                            <div className="space-y-3">
                                {filteredOrderItems.length === 0 ? (
                                    <div style={{
                                        padding: '32px', textAlign: 'center', color: '#94a3b8'
                                    }}>
                                        <p>No items match "{arrivalSearch}"</p>
                                    </div>
                                ) : (
                                    filteredOrderItems.map(item => {
                                        const arrived = arrivedItems.has(item.item_id);
                                        const disabled = item.arrived; // previously marked
                                        return (
                                            <label key={item.item_id} className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition ${arrived?'bg-blue-50 border-blue-200':'hover:bg-slate-50'} ${disabled?'opacity-50 cursor-not-allowed':''}`}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={arrived}
                                                    onChange={() => !disabled && toggleArrived(item.item_id)}
                                                    disabled={disabled}
                                                    className="w-5 h-5 mt-0.5 rounded border-slate-300 text-blue-600"
                                                />
                                                <div className="flex-1">
                                                    <div className="font-bold text-slate-800">{item.item_id}</div>
                                                    <div className="text-xs text-slate-500">{item.qty_ordered} units expected</div>
                                                    {disabled && <div className="text-[10px] uppercase font-bold text-green-600 mt-1">ALREADY SLOTTED</div>}
                                                </div>
                                            </label>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                        <div className="p-5 border-t bg-slate-50 flex justify-end gap-3 rounded-b-xl">
                            <button onClick={closeArrivalModal} className="px-4 py-2 text-slate-600 font-bold rounded hover:bg-slate-200">Cancel</button>
                            <button 
                                onClick={confirmArrival}
                                disabled={isSubmitting || arrivedItems.size === 0}
                                className="bg-blue-600 text-white font-bold px-6 py-2 rounded shadow hover:bg-blue-700 disabled:opacity-50 flex justify-center w-64"
                            >
                                {isSubmitting ? 'Allocating Slots...' : 'Confirm Arrival → Allocate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
