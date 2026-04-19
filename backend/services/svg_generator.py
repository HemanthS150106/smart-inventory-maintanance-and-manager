import json

# ==========================================
# WAREHOUSE CONSTANTS
# ==========================================
CANVAS_W, CANVAS_H = 2000, 1200
WALL_X, WALL_Y = 80, 80
WALL_W, WALL_H = 1840, 1000

RACK_W = 70        
RACK_H = 120       
RACK_GAP = 25      
WALKING_AISLE = 70 
PAIR_GAP = 60      
ROW_LABEL_OFFSET = -10  

SHELF_BOARDS_Y = [0, 24, 48, 72, 96]  
SHELF_SPACES = [
    ('L5', 5,   19),   
    ('L4', 29,  19),
    ('L3', 53,  19),
    ('L2', 77,  19),
    ('L1', 101, 19),
]

demand_colors = {'High': '#FF6B6B', 'Medium': '#FFD93D', 'Low': '#6BCB77'}

zones = {
    'A': {
        'label': 'ZONE A — High Demand / Light Items',
        'color': '#e8f0fe',
        'label_color': '#1a56db',
        'pairs': [
            {'x': 120, 'y': 200, 'num_racks': 5},
        ],
    },
    'B': {
        'label': 'ZONE B — Medium Demand',
        'color': '#e8f8e8',
        'label_color': '#1e7e34',
        'pairs': [
            {'x': 750, 'y': 200, 'num_racks': 5},
            {'x': 1380, 'y': 200, 'num_racks': 4},
        ],
    },
    'C': {
        'label': 'ZONE C — Heavy / Large Items',
        'color': '#fff3e0',
        'label_color': '#e65100',
        'pairs': [
            {'x': 120, 'y': 700, 'num_racks': 5},
        ],
    },
    'D': {
        'label': 'ZONE D — Overflow / Low Demand',
        'color': '#f3e8ff',
        'label_color': '#6f42c1',
        'pairs': [
            {'x': 750, 'y': 700, 'num_racks': 5},
            {'x': 1380, 'y': 700, 'num_racks': 4},
        ],
    },
}

def build_svg_header():
    s = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CANVAS_W} {CANVAS_H}" width="100%" height="100%">\n'
    # Base background
    s += f'<rect width="{CANVAS_W}" height="{CANVAS_H}" fill="#f0f2f5"/>\n'
    # Outer Wall
    s += f'<rect x="{WALL_X}" y="{WALL_Y}" width="{WALL_W}" height="{WALL_H}" fill="#ffffff" stroke="#2c3e50" stroke-width="8"/>\n'
    return s

def draw_layout_regions():
    s = ""
    # Receiving Dock
    s += f'<rect x="80" y="480" width="60" height="120" fill="#e8f4f8" stroke="#2980b9" stroke-width="2"/>\n'
    s += f'<text x="110" y="540" fill="#2980b9" font-size="11" font-weight="bold" text-anchor="middle" transform="rotate(-90 110 540)">RECEIVING</text>\n'
    
    # Dispatch Dock
    s += f'<rect x="1920" y="480" width="60" height="120" fill="#e8f4f8" stroke="#2980b9" stroke-width="2"/>\n'
    s += f'<text x="1950" y="540" fill="#2980b9" font-size="11" font-weight="bold" text-anchor="middle" transform="rotate(90 1950 540)">DISPATCH</text>\n'
    
    # Staging
    s += f'<rect x="100" y="100" width="160" height="100" fill="#ffeeba" stroke="#f0ad4e" stroke-width="2"/>\n'
    s += f'<text x="180" y="155" fill="#f0ad4e" font-size="10" font-weight="bold" text-anchor="middle">STAGING AREA</text>\n'
    
    # Manager
    s += f'<rect x="1700" y="100" width="200" height="100" fill="#d4edda" stroke="#28a745" stroke-width="2"/>\n'
    s += f'<text x="1800" y="155" fill="#28a745" font-size="10" font-weight="bold" text-anchor="middle">MANAGER OFFICE</text>\n'
    
    # Horizontal Main Aisle
    s += f'<rect x="80" y="585" width="1840" height="90" fill="#dde3ea"/>\n'
    s += f'<text x="1000" y="635" fill="#555" font-size="16" font-weight="bold" text-anchor="middle">◄ MAIN CROSS AISLE ►</text>\n'
    
    # Vertical Aisles
    s += f'<rect x="670" y="80" width="60" height="1000" fill="#dde3ea"/>\n'
    s += f'<rect x="1300" y="80" width="60" height="1000" fill="#dde3ea"/>\n'
    
    # Background Zone rects
    s += f'<rect x="100" y="150" width="560" height="435" fill="#e8f0fe" opacity="0.6"/>\n'
    s += f'<rect x="730" y="150" width="1180" height="435" fill="#e8f8e8" opacity="0.6"/>\n'
    s += f'<rect x="100" y="675" width="560" height="405" fill="#fff3e0" opacity="0.6"/>\n'
    s += f'<rect x="730" y="675" width="1180" height="405" fill="#f3e8ff" opacity="0.6"/>\n'
    
    # Zone Labels (placed outside the racks)
    s += f'<text x="380" y="180" fill="#1a56db" font-size="18" font-weight="bold" text-anchor="middle">{zones["A"]["label"]}</text>\n'
    s += f'<text x="1320" y="180" fill="#1e7e34" font-size="18" font-weight="bold" text-anchor="middle">{zones["B"]["label"]}</text>\n'
    s += f'<text x="380" y="1065" fill="#e65100" font-size="18" font-weight="bold" text-anchor="middle">{zones["C"]["label"]}</text>\n'
    s += f'<text x="1320" y="1065" fill="#6f42c1" font-size="18" font-weight="bold" text-anchor="middle">{zones["D"]["label"]}</text>\n'
    
    return s

BATCH_COLORS = ['#e63946', '#2a9d8f', '#e9c46a', '#457b9d', '#9c6644', '#606c38', '#d62828', '#f4a261', '#219ebc', '#023047']

def draw_rack(x, y, zone, slot_prefix, pair_num, row_str, bay_num, show_level_labels, registry_data):
    s = ""
    # Uprights
    s += f'<rect x="{x}" y="{y}" width="8" height="{RACK_H}" fill="#1a3a5c"/>\n'
    s += f'<rect x="{x + RACK_W - 8}" y="{y}" width="8" height="{RACK_H}" fill="#1a3a5c"/>\n'
    
    # Shelf boards
    for board_y_offset in SHELF_BOARDS_Y:
        s += f'<rect x="{x+8}" y="{y + board_y_offset}" width="{RACK_W-16}" height="7" fill="#8a9bb0"/>\n'
        
    registry_chunk = []

    # Shelf spaces
    for lvl_name, y_offset, height in SHELF_SPACES:
        space_y = y + y_offset
        space_x = x + 8
        space_w = RACK_W - 16
        
        slot_id = f"{slot_prefix}-{bay_num:02d}-{lvl_name}"
        
        slot_info = registry_data.get(slot_id, {})
        
        registry_chunk.append({
            'slot_id': slot_id,
            'zone': zone,
            'pair': pair_num,
            'row': row_str,
            'bay': bay_num,
            'level': lvl_name,
            'x': space_x,
            'y': space_y,
            'occupied': False,
            'item_id': None,
            'batch_id': None
        })
        
        if slot_info.get('occupied'):
            item = slot_info
            demand_status = "Low"
            dval = item.get("demand", 0)
            if dval >= 600: demand_status = "High"
            elif dval >= 300: demand_status = "Medium"
            fill = demand_colors.get(demand_status, "#f8f9fa")
            
            batch_id = item.get('batch_id', 1)
            b_color = BATCH_COLORS[(batch_id - 1) % len(BATCH_COLORS)]
            stroke = f'stroke="{b_color}" stroke-width="2.5"'
            
            s += f'<rect id="rect-{slot_id}" x="{space_x}" y="{space_y}" width="{space_w}" height="{height}" fill="{fill}" {stroke} data-batch-id="{batch_id}" data-item-id="{item.get("item_id","")}" data-zone="{zone}" data-level="{lvl_name}" data-demand="{dval}" />\n'
            # Item ID
            s += f'<text id="text-id-{slot_id}" x="{x + RACK_W/2}" y="{space_y + 8}" fill="#000" font-size="4" font-weight="bold" font-family="sans-serif" text-anchor="middle">{item.get("item_id","")}</text>\n'
            s += f'<text id="text-wt-{slot_id}" x="{x + RACK_W/2}" y="{space_y + 14}" fill="#444" font-size="3.5" font-family="sans-serif" text-anchor="middle">{item.get("weight","")}kg</text>\n'
        else:
            s += f'<rect id="rect-{slot_id}" x="{space_x}" y="{space_y}" width="{space_w}" height="{height}" fill="#f8f9fa"/>\n'
            # Empty ID
            s += f'<text id="text-empty-{slot_id}" x="{x + RACK_W/2}" y="{space_y + 11}" fill="#666" font-size="4" font-family="sans-serif" text-anchor="middle">{slot_id}</text>\n'
            
    if show_level_labels:
        for lvl_name, y_offset, height in SHELF_SPACES:
            s += f'<text x="{x + ROW_LABEL_OFFSET}" y="{y + y_offset + 12}" fill="#888" font-size="5" font-weight="bold" font-family="sans-serif" text-anchor="end">{lvl_name}</text>\n'
            
    return s, registry_chunk

def generate(out_path="../../frontend/svgs/warehouse_blueprint.svg", reg_path="../../data/registry/slot_registry.json", allocated_slots=None):
    import os
    import datetime
    
    svg = build_svg_header()
    svg += draw_layout_regions()
    
    registry_data = {}
    is_alloc = "allocated" in out_path
    
    # ALWAYS load existing from disk if available to render all items natively
    if os.path.exists(reg_path):
        try:
            with open(reg_path, 'r') as f:
                full_reg = json.load(f)
                registry_data = full_reg.get('slots', {}) # Map
        except Exception:
            registry_data = {}
            
    new_slots = {}
    
    for zone, zdata in zones.items():
        for pair_idx, pair in enumerate(zdata['pairs']):
            p_num = pair_idx + 1
            start_x = pair['x']
            num_racks = pair['num_racks']
            
            # Row A
            row_y_A = pair['y']
            for bay in range(1, num_racks + 1):
                rx = start_x + (bay - 1) * (RACK_W + RACK_GAP)
                s, rchunk = draw_rack(rx, row_y_A, zone, f"{zone}{p_num}A", p_num, 'A', bay, bay==1, registry_data)
                svg += s
                for c in rchunk: new_slots[c['slot_id']] = c
                
            # Row B
            row_y_B = row_y_A + RACK_H + WALKING_AISLE
            for bay in range(1, num_racks + 1):
                rx = start_x + (bay - 1) * (RACK_W + RACK_GAP)
                s, rchunk = draw_rack(rx, row_y_B, zone, f"{zone}{p_num}B", p_num, 'B', bay, bay==1, registry_data)
                svg += s
                for c in rchunk: new_slots[c['slot_id']] = c
                
    svg += "</svg>"
    
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(svg)
        
    # Generate registry file ONLY if we are generating the default template and it doesn't already exist or it lacks structure
    if not is_alloc:
        # Just create the file with the default un-occupied items format:
        doc = {
            "last_updated": datetime.datetime.now().isoformat(),
            "total_batches": 0,
            "slots": {}
        }
        for k, v in new_slots.items():
            doc["slots"][k] = v
        with open(reg_path, 'w') as f:
            json.dump(doc, f, indent=2)

if __name__ == '__main__':
    generate()
    print("Generated generic blueprint and registry.")
