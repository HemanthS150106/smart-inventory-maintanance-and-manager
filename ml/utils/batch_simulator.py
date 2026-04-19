import json
import sys
import os
import datetime

# Fix import to point to correct services path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.join(BASE_DIR, 'backend', 'services'))
from svg_generator import generate
def get_demand_intensity(item_id, meta):
    # Retrieve demand from some context, or just default to medium
    # Real demand is in forecasts.csv, but for logic we can just use category 
    if 'FOODS' in item_id: return 800
    if 'HOBBIES' in item_id: return 400
    return 100

def main():
    if '--allocate' not in sys.argv:
        print("Use --allocate to manually trigger allocation based on pending_arrival.json")
        return
        
    reg_path = os.path.join(BASE_DIR, 'data', 'registry', 'slot_registry.json')
    history_path = os.path.join(BASE_DIR, 'data', 'registry', 'arrivals_history.json')
    pending_path = os.path.join(BASE_DIR, 'data', 'registry', 'pending_arrival.json')
    meta_path = os.path.join(BASE_DIR, 'frontend', 'public', 'item_meta.json')
    
    if not os.path.exists(reg_path):
        generate(out_path=os.path.join(BASE_DIR, 'frontend', 'svgs', 'warehouse_blueprint.svg'), reg_path=reg_path)
        
    with open(reg_path, 'r') as f:
        registry_doc = json.load(f)
        
    if "slots" not in registry_doc:
        print("OLD SCHEMA DETECTED. Please reset.")
        return
        
    registry = registry_doc["slots"]
    
    history = []
    if os.path.exists(history_path):
        with open(history_path, 'r') as f:
            history = json.load(f)
            
    with open(pending_path, 'r') as f:
        pending = json.load(f)
        
    meta = {}
    if os.path.exists(meta_path):
        with open(meta_path, 'r') as f:
            meta = json.load(f)
            
    order_id = pending.get('order_id', 'UNKNOWN')
    items_to_allocate = pending.get('items', [])
    
    # Sort items by weight descending to allocate heavy stuff first.
    items_to_allocate.sort(key=lambda x: x.get('weight', 0), reverse=True)
    
    if not history:
        global_arrival_id = 1
    else:
        global_arrival_id = max(entry.get('global_arrival_id', entry.get('batch_id', 0)) for entry in history) + 1
        
    batch_id = global_arrival_id # keep batch_id for internal logic but also save global_arrival_id
    batch_allocs = []
    
    for item in items_to_allocate:
        it_id = item['item_id']
        wt = item['weight']
        dmd = get_demand_intensity(it_id, meta)
        
        meta_item = meta.get(it_id, {})
        sz = meta_item.get('size', 'M')
        
        if wt < 5.0: shelf = 'L5'
        elif wt < 15.0: shelf = 'L4'
        elif wt < 30.0: shelf = 'L3'
        elif wt < 60.0: shelf = 'L2'
        else: shelf = 'L1'
            
        target_zone = 'D'
        if dmd > 600 and sz in ['S', 'M']: target_zone = 'A'
        elif (300 <= dmd <= 600) or sz in ['M', 'L']: target_zone = 'B'
        elif sz in ['L', 'XL'] or wt > 40: target_zone = 'C'
        
        def find_slot(z, sh):
            possible = [s for s in registry.values() if s.get('zone')==z and s.get('level')==sh and not s.get('occupied')]
            possible.sort(key=lambda x: (x.get('pair', 0), x['slot_id']))
            if possible: return possible[0]['slot_id']
            return None
            
        assigned_slot = find_slot(target_zone, shelf)
        if not assigned_slot:
            for fb_zone in ['D', 'C', 'B', 'A']:
                assigned_slot = find_slot(fb_zone, shelf)
                if assigned_slot:
                    target_zone = fb_zone
                    break
                    
        if assigned_slot:
            registry[assigned_slot]['occupied'] = True
            registry[assigned_slot]['item_id'] = it_id
            registry[assigned_slot]['weight'] = wt
            registry[assigned_slot]['demand'] = round(dmd, 1)
            registry[assigned_slot]['size'] = sz
            registry[assigned_slot]['batch_id'] = batch_id
            
            batch_allocs.append({
                'Item ID': it_id,
                'Size': sz,
                'Weight(kg)': wt,
                'Predicted Demand': round(dmd, 1),
                'Zone': target_zone,
                'Slot ID': assigned_slot
            })
            
    ts = datetime.datetime.now().strftime("%d %b %Y, %I:%M %p")
    new_arrival = {
        'global_arrival_id': global_arrival_id,
        'batch_id': batch_id,
        'order_id': order_id,
        'timestamp': ts,
        'slots_allocated': batch_allocs
    }
    history.append(new_arrival)
    
    with open(history_path, 'w') as f:
        json.dump(history, f, indent=2)
        
    registry_doc['total_batches'] = batch_id
    registry_doc['last_updated'] = ts
    with open(reg_path, 'w') as f:
        json.dump(registry_doc, f, indent=2)
        
    generate(out_path=os.path.join(BASE_DIR, 'frontend', 'svgs', 'warehouse_allocated.svg'), reg_path=reg_path)
    print(f"Arrival {batch_id} (Order {order_id}) complete. Allocated {len(batch_allocs)} items.")

if __name__ == "__main__":
    main()
