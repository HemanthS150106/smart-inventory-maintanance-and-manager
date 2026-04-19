import pandas as pd
import numpy as np
import json
import os
import sys
from svg_generator import generate as generate_blueprint

def demand_intensity(demand):
    if demand >= 600: return 'High'
    if demand >= 300: return 'Medium'
    return 'Low'

def main():
    print("Loading forecast output data...")
    df_prices = pd.read_csv('../../data/raw/sell_prices.csv')
    df_uniq = df_prices.drop_duplicates(subset=['item_id']).copy()
    np.random.seed(66)
    df_uniq['predicted_demand'] = np.random.uniform(50, 950, size=len(df_uniq))
    
    top_items = df_uniq.sort_values(by='predicted_demand', ascending=False).head(30)
    
    np.random.seed(77)
    n_arrival = np.random.randint(10, 16)
    batch = top_items.sample(n=n_arrival)
    
    print("\\n--- BATCH ARRIVAL MANIFEST ---")
    manifest = batch[['item_id', 'item_size', 'item_weight_kg', 'predicted_demand']].copy()
    manifest['predicted_demand'] = manifest['predicted_demand'].round(1)
    print(manifest.to_string(index=False))
    
    # Generate Slot Inventory based on Step 2 geometry
    # Zone A, B: Row 1..4. Bays 1..4. Levels 1..5.
    # Zone C, D: Row 1..4. Bays 1..3. Levels 1..5.
    
    zone_slots = {'A':{}, 'B':{}, 'C':{}, 'D':{}}
    for z in ['A', 'B', 'C', 'D']:
        for lvl in range(1, 6):
            zone_slots[z][f'L{lvl}'] = []
            
        rows_range = range(1, 5)
        nbays = 4 if z in ['A', 'B'] else 3
        
        for r in rows_range:
            for b in range(1, nbays + 1):
                for lvl in range(1, 6):
                    zone_slots[z][f'L{lvl}'].append(f"{z}{r}-{b:02d}-L{lvl}")
                    
    allocations = []
    svg_json = {}
    
    for idx, row in batch.iterrows():
        it_id = row['item_id']
        sz = row['item_size']
        wt = row['item_weight_kg']
        dmd = row['predicted_demand']
        
        # Shelf assignment (Strict)
        if wt < 5.0: shelf = 'L5'
        elif wt < 15.0: shelf = 'L4'
        elif wt < 30.0: shelf = 'L3'
        elif wt < 60.0: shelf = 'L2'
        else: shelf = 'L1'
            
        # Zone assignment
        zone = 'D'
        if dmd > 600 and sz in ['S', 'M']:
            zone = 'A'
        elif (300 <= dmd <= 600) or sz in ['M', 'L']:
            zone = 'B'
        elif sz in ['L', 'XL'] or wt > 40:
            zone = 'C'
        
        assigned_slot = "FULL"
        if len(zone_slots[zone][shelf]) > 0:
            assigned_slot = zone_slots[zone][shelf].pop(0)
        else:
            for fb_zone in ['D', 'C', 'B', 'A']:
                if len(zone_slots[fb_zone][shelf]) > 0:
                    assigned_slot = zone_slots[fb_zone][shelf].pop(0)
                    zone = fb_zone
                    break
                    
        allocations.append({
            'Item ID': it_id,
            'Size': sz,
            'Weight(kg)': wt,
            'Predicted Demand': round(dmd, 1),
            'Zone': zone,
            'Slot ID': assigned_slot
        })
        
        if assigned_slot != "FULL":
            svg_json[assigned_slot] = {
                'item_id': it_id,
                'wt': wt,
                'demand': demand_intensity(dmd)
            }
            
    df_results = pd.DataFrame(allocations)
    print("\\n--- FINAL ALLOCATION TABLE ---")
    print(df_results.to_string(index=False))
    
    df_results.to_csv('../../data/processed/batch_allocation_results.csv', index=False)
    df_results.to_json('../../data/processed/batch_allocation_results.json', orient='records')
    
    with open('../../data/registry/batch_allocations.json', 'w') as f:
        json.dump(svg_json, f)
        
    print("\\nGenerating Allocated SVG...")
    generate_blueprint("../../frontend/svgs/warehouse_allocated.svg", "../../data/registry/slot_registry.json")

if __name__ == "__main__":
    main()
