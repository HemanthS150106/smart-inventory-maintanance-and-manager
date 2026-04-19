import json
import datetime

def generate_blueprint(filename, allocated_slots=None):
    W, H = 1600, 1000
    wh_x, wh_y, wh_w, wh_h = 100, 100, 1400, 800
    
    demand_colors = {'High': '#FF6B6B', 'Medium': '#FFD93D', 'Low': '#6BCB77'}
    
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="100%" height="100%">'
    svg += f'<rect width="{W}" height="{H}" fill="#f0f5fa"/>'
    
    # Outer WH wall
    svg += f'<rect x="{wh_x}" y="{wh_y}" width="{wh_w}" height="{wh_h}" fill="#ffffff" stroke="#222222" stroke-width="6"/>'
    
    # Title
    svg += f'<rect x="0" y="0" width="{W}" height="60" fill="#2c3e50"/>'
    svg += f'<text x="{W/2}" y="38" fill="white" font-size="24" font-family="sans-serif" font-weight="bold" text-anchor="middle">WAREHOUSE FLOOR PLAN — SLOT ALLOCATION SYSTEM</text>'
    
    if allocated_slots:
        ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        svg += f'<text x="{W/2}" y="85" fill="#333" font-size="16" font-family="sans-serif" font-weight="bold" text-anchor="middle">BATCH #1 — {ts} — {len(allocated_slots)} items allocated</text>'

    # Subtly tinted backgrounds for zones
    # Coordinate layout
    # Center Y = 500. Main Aisle: 470 to 530 (H=60)
    # Zone A & B top half (100 to 470)
    # Zone C & D bottom half (530 to 900)
    # Left / Right Split: Center X = 800.
    
    svg += f'<rect x="150" y="110" width="600" height="350" fill="rgba(173, 216, 230, 0.15)"/>' # Zone A
    svg += f'<rect x="800" y="110" width="600" height="350" fill="rgba(144, 238, 144, 0.15)"/>' # Zone B
    svg += f'<rect x="150" y="540" width="600" height="350" fill="rgba(255, 200, 100, 0.15)"/>' # Zone C
    svg += f'<rect x="800" y="540" width="600" height="350" fill="rgba(200, 162, 200, 0.15)"/>' # Zone D

    # Zone Labels
    svg += f'<text x="450" y="240" fill="#2b5982" font-size="28" font-weight="bold" text-anchor="middle" opacity="0.3">ZONE A</text>'
    svg += f'<text x="1100" y="240" fill="#2e7d32" font-size="28" font-weight="bold" text-anchor="middle" opacity="0.3">ZONE B</text>'
    svg += f'<text x="450" y="700" fill="#d84315" font-size="28" font-weight="bold" text-anchor="middle" opacity="0.3">ZONE C</text>'
    svg += f'<text x="1100" y="700" fill="#6a1b9a" font-size="28" font-weight="bold" text-anchor="middle" opacity="0.3">ZONE D</text>'
    
    # Docks & Admin
    svg += f'<rect x="100" y="460" width="80" height="80" fill="#cfd8dc" stroke="#222" stroke-width="2"/>'
    svg += f'<text x="140" y="505" fill="#333" font-size="12" font-weight="bold" text-anchor="middle" transform="rotate(-90 140 505)">RECEIVING</text>'
    
    svg += f'<rect x="1420" y="460" width="80" height="80" fill="#cfd8dc" stroke="#222" stroke-width="2"/>'
    svg += f'<text x="1460" y="505" fill="#333" font-size="12" font-weight="bold" text-anchor="middle" transform="rotate(90 1460 505)">DISPATCH</text>'
    
    svg += f'<rect x="1400" y="100" width="100" height="80" fill="#fff" stroke="#222" stroke-width="2"/>'
    svg += f'<text x="1450" y="145" fill="#333" font-size="10" font-weight="bold" text-anchor="middle">MANAGER</text>'
    
    svg += f'<rect x="180" y="400" width="120" height="60" fill="none" stroke="#666" stroke-width="2" stroke-dasharray="5,5"/>'
    svg += f'<text x="240" y="435" fill="#666" font-size="14" font-weight="bold" text-anchor="middle">STAGING</text>'
    
    # Main Aisle 
    svg += f'<rect x="100" y="470" width="1400" height="60" fill="rgba(0,0,0,0.05)" />'
    svg += f'<text x="800" y="508" fill="#888" font-size="24" font-weight="bold" text-anchor="middle">MAIN AISLE →</text>'

    # Rack row draw function
    def draw_rack_row(start_x, y_floor, num_bays, zone_id, row_idx):
        s = f'<text x="{start_x - 20}" y="{y_floor - 80}" fill="#888" font-size="9" text-anchor="middle" transform="rotate(-90 {start_x - 20} {y_floor - 80})">Row {row_idx}</text>'
        
        for i in range(num_bays):
            bx = start_x + i * 80
            bay_idx = i + 1
            
            for l_num in [1, 2, 3, 4, 5]:
                base_y = y_floor - (l_num - 1) * 40
                space_y = base_y - 32
                space_x = bx + 6
                
                slot_id = f"{zone_id}{row_idx}-{bay_idx:02d}-L{l_num}"
                fill = "#f5f7fa"
                
                txt = f'<text x="{space_x + 37}" y="{space_y + 18}" fill="#555" font-size="6" font-weight="normal" text-anchor="middle">{slot_id}</text>'
                
                # occupied injection
                if allocated_slots and slot_id in allocated_slots:
                    item = allocated_slots[slot_id]
                    fill = demand_colors.get(item['demand'], fill)
                    
                    # physical item block resting ON the shelf (which is at base_y)
                    # height 12, width 40
                    item_h, item_w = 12, 40
                    iy = base_y - item_h
                    ix = space_x + 37 - item_w/2
                    s += f'<rect x="{ix}" y="{iy}" width="{item_w}" height="{item_h}" fill="rgba(0,0,0,0.15)" stroke="#333" stroke-width="0.5" />'
                    
                    txt = f'<text x="{space_x + 37}" y="{space_y + 14}" fill="#000" font-size="6" font-weight="bold" text-anchor="middle">{item["item_id"]}</text>'
                    txt += f'<text x="{space_x + 37}" y="{space_y + 22}" fill="#444" font-size="5" text-anchor="middle">{item["wt"]}kg</text>'
                    
                s += f'<rect x="{space_x}" y="{space_y}" width="74" height="32" fill="{fill}" />'
                s += txt
                
                if l_num > 1:
                    s += f'<rect x="{space_x}" y="{base_y}" width="74" height="8" fill="#b0b8c1" />'
                    
        # Uprights
        for i in range(num_bays + 1):
            ux = start_x + i * 80
            s += f'<rect x="{ux}" y="{y_floor - 160}" width="6" height="160" fill="#1a3a5c" />'
        
        return s

    # RACK PLACEMENT GRID
    # Zone A (4 bays)
    svg += draw_rack_row(170, 260, 4, 'A', 1)
    svg += draw_rack_row(170, 470, 4, 'A', 2)
    svg += draw_rack_row(510, 260, 4, 'A', 3)
    svg += draw_rack_row(510, 470, 4, 'A', 4)

    # Zone B (4 bays)
    svg += draw_rack_row(830, 260, 4, 'B', 1)
    svg += draw_rack_row(830, 470, 4, 'B', 2)
    svg += draw_rack_row(1170, 260, 4, 'B', 3)
    svg += draw_rack_row(1170, 470, 4, 'B', 4)

    # Zone C (3 bays) - 3 bays = width 246
    svg += draw_rack_row(250, 690, 3, 'C', 1)
    svg += draw_rack_row(250, 900, 3, 'C', 2)
    svg += draw_rack_row(510, 690, 3, 'C', 3)
    svg += draw_rack_row(510, 900, 3, 'C', 4)
    
    # Zone D (3 bays)
    svg += draw_rack_row(870, 690, 3, 'D', 1)
    svg += draw_rack_row(870, 900, 3, 'D', 2)
    svg += draw_rack_row(1130, 690, 3, 'D', 3)
    svg += draw_rack_row(1130, 900, 3, 'D', 4)

    # LEGEND
    lx, ly = 300, 930
    svg += f'<rect x="{lx}" y="{ly}" width="800" height="60" fill="#fff" stroke="#222" stroke-width="1"/>'
    svg += f'<text x="{lx + 20}" y="{ly + 20}" fill="#333" font-size="14" font-weight="bold">LEGEND &amp; SHELF GUIDE</text>'
    
    # Sample single rack for legend
    l_rack_x, l_rack_y = lx + 200, ly + 50
    # draw miniature
    svg += f'<rect x="{l_rack_x}" y="{l_rack_y - 40}" width="4" height="40" fill="#1a3a5c" />'
    svg += f'<rect x="{l_rack_x+30}" y="{l_rack_y - 40}" width="4" height="40" fill="#1a3a5c" />'
    for lvl in range(1, 6):
        ty = l_rack_y - (lvl-1)*8
        svg += f'<rect x="{l_rack_x+4}" y="{ty-2}" width="26" height="2" fill="#b0b8c1" />'
    
    svg += f'<text x="{l_rack_x+40}" y="{l_rack_y - 32}" fill="#555" font-size="8">↑ L5 — Lightest (0-5kg)</text>'
    svg += f'<text x="{l_rack_x+40}" y="{l_rack_y - 24}" fill="#555" font-size="8">  L4 — Light (5-15kg)</text>'
    svg += f'<text x="{l_rack_x+40}" y="{l_rack_y - 16}" fill="#555" font-size="8">  L3 — Medium (15-30kg)</text>'
    svg += f'<text x="{l_rack_x+40}" y="{l_rack_y - 8}" fill="#555" font-size="8">  L2 — Heavy (30-60kg)</text>'
    svg += f'<text x="{l_rack_x+40}" y="{l_rack_y }" fill="#555" font-size="8">↓ L1 — Heaviest (60+kg)</text>'

    dx = l_rack_x + 160
    for d, c in demand_colors.items():
        svg += f'<rect x="{dx}" y="{ly+20}" width="15" height="15" fill="{c}"/>'
        svg += f'<text x="{dx+20}" y="{ly+32}" font-size="12">{d} Demand</text>'
        dx += 110
        
    svg += f'<rect x="{dx}" y="{ly+20}" width="15" height="15" fill="#f5f7fa" stroke="#ccc"/>'
    svg += f'<text x="{dx+20}" y="{ly+32}" font-size="12">Empty Slot</text>'

    svg += '</svg>'
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(svg)
    print(f"Generated {filename}")

if __name__ == '__main__':
    generate_blueprint('smart-inventory-app/../../../../data/processed/warehouse_blueprint.svg')
