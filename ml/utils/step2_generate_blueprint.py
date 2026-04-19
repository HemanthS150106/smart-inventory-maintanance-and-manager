import textwrap

def generate_blueprint_svg(filename="warehouse_blueprint.svg", allocated_slots=None):
    # allocated_slots is a dict: {'A-01': {'demand': 'High', 'item_id': 'HOBBIES_1...'}, ...}
    
    # SVG Constants
    scale = 10
    W, H = 100 * scale, 80 * scale
    
    # Colors
    color_bg = "#f0f0f0"
    color_wall = "#333333"
    color_aisle = "#e0e0e0"
    color_dock = "#cfd8dc"
    color_office_bg = "#ffffff"
    color_legend_bg = "#ffffff"
    
    zone_colors = {
        'A': "#b3e5fc", # Light Blue
        'B': "#c8e6c9", # Light Green
        'C': "#ffe0b2", # Light Orange
        'D': "#e1bee7"  # Light Purple
    }
    
    demand_colors = {
        'Low': "#81c784",    # Green
        'Medium': "#fff176", # Yellow
        'High': "#e57373"    # Red
    }
    
    # SVG Header
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H+100}" width="{W}" height="{H+100}">'
    svg += f'<rect width="{W}" height="{H+100}" fill="{color_bg}"/>'
    
    # Title Bar
    svg += f'<rect x="0" y="0" width="{W}" height="40" fill="#2c3e50"/>'
    svg += f'<text x="{W/2}" y="25" fill="white" font-size="18" font-family="sans-serif" font-weight="bold" text-anchor="middle">WAREHOUSE FLOOR PLAN — SLOT ALLOCATION SYSTEM</text>'
    
    if allocated_slots is not None:
        import datetime
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        n_items = len(allocated_slots)
        svg += f'<text x="{W/2}" y="45" fill="black" font-size="14" font-family="sans-serif" font-weight="bold" text-anchor="middle">BATCH ARRIVAL — {timestamp} — {n_items} items allocated</text>'
    
    dy = 60 # offset for main canvas
    
    # Background for warehouse floor
    svg += f'<rect x="0" y="{dy}" width="{W}" height="{H}" fill="{color_aisle}" cursor="default"/>'
    
    # Docks (x=0..10, and x=90..100)
    svg += f'<rect x="0" y="{dy}" width="{10*scale}" height="{H}" fill="{color_dock}" stroke="{color_wall}" stroke-width="3"/>'
    svg += f'<text x="{5*scale}" y="{dy + H/2}" font-size="16" font-family="sans-serif" font-weight="bold" text-anchor="middle" transform="rotate(-90 {5*scale} {dy + H/2})">RECEIVING DOCK (ENTRY)</text>'
    
    svg += f'<rect x="{90*scale}" y="{dy}" width="{10*scale}" height="{H}" fill="{color_dock}" stroke="{color_wall}" stroke-width="3"/>'
    svg += f'<text x="{95*scale}" y="{dy + H/2}" font-size="16" font-family="sans-serif" font-weight="bold" text-anchor="middle" transform="rotate(90 {95*scale} {dy + H/2})">DISPATCH DOCK (EXIT)</text>'
    
    # Central Aisle (y=37..43) => 6 units
    svg += f'<rect x="{10*scale}" y="{dy + 37*scale}" width="{80*scale}" height="{6*scale}" fill="{color_aisle}" />'
    svg += f'<text x="{50*scale}" y="{dy + 40.5*scale}" font-size="18" font-family="sans-serif" font-weight="bold" fill="#777" text-anchor="middle">MAIN AISLE</text>'
    
    # Vertical Cross Aisles x=42..46 and x=54..58 (Wait, I will use x=10..14 and x=86..90 as vertical aisles, let warehouse be open)
    # Actually, let's just make the background color_aisle and draw rects over it.
    
    # Zones definitions
    # Zone A: Top-Left (x=14 to 46, y=2 to 37) => Width=32, Height=35
    # Zone B: Top-Right (x=54 to 86, y=2 to 37)
    # Zone C: Bottom-Left (x=14 to 46, y=43 to 78)
    # Zone D: Bottom-Right (x=54 to 86, y=43 to 78)
    
    def draw_zone(name, start_x, start_y, cols, rows, title):
        w_total = 32 * scale
        h_total = 35 * scale
        cw = w_total / cols
        ch = h_total / rows
        
        # Zone Header
        svg_str = f'<text x="{start_x + w_total/2}" y="{start_y - 8}" font-size="14" font-family="sans-serif" font-weight="bold" text-anchor="middle">{title}</text>'
        
        slot_idx = 1
        for r in range(rows):
            for c in range(cols):
                sx = start_x + c * cw
                sy = start_y + r * ch
                slot_id = f"{name}-{slot_idx:02d}"
                
                fill_color = zone_colors[name]
                label_str = f'<text x="{sx + cw/2}" y="{sy + ch/2 + 4}" font-size="12" font-family="sans-serif" font-weight="bold" text-anchor="middle">{slot_id}</text>'
                
                if allocated_slots and slot_id in allocated_slots:
                    item_info = allocated_slots[slot_id]
                    fill_color = demand_colors[item_info["demand"]]
                    # Show item ID
                    label_str = (
                        f'<text x="{sx + cw/2}" y="{sy + ch/2 - 4}" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="#000">{item_info["item_id"]}</text>\\n'
                        f'<text x="{sx + cw/2}" y="{sy + ch/2 + 8}" font-size="9" font-family="sans-serif" text-anchor="middle" fill="#222">({slot_id})</text>'
                    )
                    
                svg_str += f'<rect x="{sx}" y="{sy}" width="{cw-2}" height="{ch-2}" fill="{fill_color}" stroke="{color_wall}" stroke-width="1" rx="2" ry="2"/>'
                svg_str += label_str
                
                slot_idx += 1
        return svg_str
    
    # Add an offset to y to leave space for headers
    z_y_top = dy + 4 * scale
    z_y_bot = dy + 45 * scale
    
    svg += draw_zone('A', 14 * scale, z_y_top, 4, 5, "ZONE A (High-Demand Fast Movers)")
    svg += draw_zone('B', 54 * scale, z_y_top, 4, 5, "ZONE B (Medium-Demand)")
    svg += draw_zone('C', 14 * scale, z_y_bot, 3, 5, "ZONE C (Large/Bulk Items)")
    svg += draw_zone('D', 54 * scale, z_y_bot, 3, 5, "ZONE D (Overflow/Low-Demand)")
    
    # Manager Office in corner (Bottom Left Dock area)
    mo_w, mo_h = 10 * scale, 12 * scale
    svg += f'<rect x="0" y="{dy + H - mo_h}" width="{mo_w}" height="{mo_h}" fill="{color_office_bg}" stroke="{color_wall}" stroke-width="2"/>'
    svg += f'<text x="{mo_w/2}" y="{dy + H - mo_h/2}" font-size="12" font-family="sans-serif" font-weight="bold" text-anchor="middle">OFFICE</text>'
    
    # Legend
    leg_x, leg_y = 70 * scale, dy + H - 20 * scale
    
    if allocated_slots is None:
        svg += f'<rect x="{leg_x}" y="{leg_y - 20}" width="{28*scale}" height="{18*scale}" fill="{color_legend_bg}" stroke="{color_wall}" stroke-width="1"/>'
        svg += f'<text x="{leg_x + 14*scale}" y="{leg_y - 5}" font-size="12" font-family="sans-serif" font-weight="bold" text-anchor="middle">LEGEND</text>'
        
        yo = 10
        for zone, color in zone_colors.items():
            svg += f'<rect x="{leg_x + 10}" y="{leg_y + yo - 8}" width="15" height="15" fill="{color}" stroke="#333"/>'
            svg += f'<text x="{leg_x + 35}" y="{leg_y + yo + 4}" font-size="12" font-family="sans-serif">Zone {zone}</text>'
            yo += 20
    else:
        svg += f'<rect x="{leg_x}" y="{leg_y - 20}" width="{28*scale}" height="{18*scale}" fill="{color_legend_bg}" stroke="{color_wall}" stroke-width="1"/>'
        svg += f'<text x="{leg_x + 14*scale}" y="{leg_y - 5}" font-size="12" font-family="sans-serif" font-weight="bold" text-anchor="middle">DEMAND INTENSITY</text>'
        
        yo = 10
        for demand, color in demand_colors.items():
            svg += f'<rect x="{leg_x + 10}" y="{leg_y + yo - 8}" width="15" height="15" fill="{color}" stroke="#333"/>'
            svg += f'<text x="{leg_x + 35}" y="{leg_y + yo + 4}" font-size="12" font-family="sans-serif">{demand} Demand</text>'
            yo += 20

    svg += '</svg>'
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(svg)
    print(f"Generated {filename}")

if __name__ == "__main__":
    generate_blueprint_svg()
