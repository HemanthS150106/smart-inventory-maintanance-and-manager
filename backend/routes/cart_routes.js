import express from 'express';
import { readJSON, writeJSON } from '../utils/jsonStore.js';

const router = express.Router();

router.get('/', (req, res) => {
  const data = readJSON('carts.json', { carts: [] });
  res.json({ success: true, carts: data.carts });
});

router.post('/', (req, res) => {
  const { max_weight_kg, max_volume_cf } = req.body;
  const data = readJSON('carts.json', { carts: [] });
  const cartId = `CART-${String(data.carts.length + 1).padStart(3,'0')}`;
  data.carts.push({
    cart_id: cartId,
    max_weight_kg: Number(max_weight_kg),
    max_volume_cf: Number(max_volume_cf),
    status: 'available',
    assigned_worker_id: null
  });
  writeJSON('carts.json', data);
  res.json({ success: true, cart_id: cartId });
});

router.delete('/:id', (req, res) => {
  const data = readJSON('carts.json', { carts: [] });
  const cart = data.carts.find(c => c.cart_id === req.params.id);
  if (!cart) return res.status(404).json({ error: 'Not found' });
  if (cart.status !== 'available') {
    return res.status(400).json({ error: 'Cart is in use' });
  }
  data.carts = data.carts.filter(c => c.cart_id !== req.params.id);
  writeJSON('carts.json', data);
  res.json({ success: true });
});

export default router;
