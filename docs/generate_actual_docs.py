import os

OUT_DIR = r"c:\Users\heman\Downloads\capstone\smart-inventory-app\docs"
SVG_DIR = os.path.join(OUT_DIR, "diagrams")
os.makedirs(SVG_DIR, exist_ok=True)

def pure_svg_wrap(w, h, content):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" style="background:#fff; font-family:sans-serif;">\n' + content + '\n</svg>'

def box(x, y, w, h, fill, stroke, text_lines=[], font_size=14, rx=5, dash="", bold_index=-1):
    dash_attr = f'stroke-dasharray="{dash}"' if dash else ""
    s = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="2" {dash_attr}/>\n'
    ty = y + 25
    for idx, t in enumerate(text_lines):
        if t.startswith("<<") or dash != "":
            fs = font_size - 2
            col = "#64748b" if dash != "" else "#333"
            fw = 'font-weight="bold"' if idx == bold_index else ''
            fst = 'font-style="italic"' if dash != "" and not t.startswith("Planned") else ''
            if t == "Planned":
                # Badge
                s += f'<rect x="{x+w-50}" y="{y-10}" width="60" height="20" rx="4" fill="#64748b"/>\n'
                s += f'<text x="{x+w-20}" y="{y+4}" font-size="10" fill="#fff" text-anchor="middle">Planned</text>\n'
                continue
            s += f'<text x="{x+10}" y="{ty+(idx*20)}" font-size="{fs}" fill="{col}" {fw} {fst}>{t}</text>\n'
        else:
            fw = 'font-weight="bold"' if idx == 0 or idx == bold_index else ''
            s += f'<text x="{x+w/2}" y="{ty+(idx*20)}" font-size="{font_size}" fill="#0f172a" {fw} text-anchor="middle">{t}</text>\n'
    return s

def text(x, y, msg, font_size=14, bold=False, italic=False, color="#333", anchor="start"):
    fw = 'font-weight="bold"' if bold else ''
    fst = 'font-style="italic"' if italic else ''
    return f'<text x="{x}" y="{y}" font-size="{font_size}" fill="{color}" text-anchor="{anchor}" {fw} {fst}>{msg}</text>\n'

def line_arrow(x1, y1, x2, y2, label="", dashed=False, color="#334155"):
    dash_attr = 'stroke-dasharray="5,5"' if dashed else ''
    s = f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="2" {dash_attr} marker-end="url(#arrow)"/>\n'
    if label:
        mx = (x1 + x2)/2
        my = (y1 + y2)/2
        s += f'<rect x="{mx-10}" y="{my-12}" width="{len(label)*7+10}" height="18" fill="#fff" opacity="0.9"/>\n'
        s += f'<text x="{mx}" y="{my}" font-size="12" fill="#475569" font-weight="bold">{label}</text>\n'
    return s

def marker():
    return '''<defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#334155" />
    </marker>
  </defs>'''

# 1. High Level Architecture
def gen_hla():
    s = marker()
    s += f'<rect x="10" y="10" width="980" height="680" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2" rx="20"/>\n'
    s += text(500, 40, "Smart Inventory System - Actual High Level Architecture", 20, True, anchor="middle")
    
    # Legend
    s += f'<rect x="750" y="630" width="15" height="15" fill="#fef3c7" stroke="#333"/>\n'
    s += text(775, 642, "Implemented", 12)
    s += f'<rect x="860" y="630" width="15" height="15" fill="#f1f5f9" stroke="#94a3b8" stroke-dasharray="4,4"/>\n'
    s += text(885, 642, "Planned", 12)

    # SEC 1: Demand Forecasting
    s += f'<rect x="40" y="70" width="450" height="300" fill="#fef3c7" stroke="#b45309" stroke-width="2" rx="10"/>\n'
    s += text(50, 95, "Demand Forecasting (Implemented)", 16, True)
    
    s += box(200, 110, 100, 60, "#d97706", "#78350f", ["", "Database"], 14)
    s += box(160, 200, 180, 50, "#b45309", "#78350f", ["Model Router", "(via pandas rules)"], 14)
    s += box(60, 290, 120, 50, "#fff", "#b45309", ["LGBM + XGBoost", "(smooth/erratic)"], 12)
    s += box(220, 290, 100, 50, "#fff", "#b45309", ["Averaging", "(intermittent)"], 12)
    s += box(340, 290, 100, 50, "#fff", "#b45309", ["Zero Output", "(dead)"], 12)

    s += line_arrow(250, 170, 250, 200, "sales_hist.csv")
    s += line_arrow(200, 250, 120, 290)
    s += line_arrow(250, 250, 270, 290)
    s += line_arrow(300, 250, 390, 290)

    # Forecast Output
    s += box(200, 390, 140, 40, "#78350f", "#451a03", ["", "Forecast Output"], 14)
    s += line_arrow(120, 340, 220, 390)
    s += line_arrow(270, 340, 270, 390)
    s += line_arrow(390, 340, 320, 390)

    # SEC 2: Dynamic Slotting
    s += f'<rect x="40" y="450" width="450" height="200" fill="#dcfce7" stroke="#166534" stroke-width="2" rx="10"/>\n'
    s += text(50, 475, "Dynamic Slotting (Implemented)", 16, True)
    
    s += box(60, 500, 140, 50, "#fff", "#166534", ["item_meta.json", "(Weight & Size)"], 12)
    s += box(250, 500, 180, 60, "#15803d", "#14532d", ["Slot Allocation Logic", "(Rule-based logic)"], 14)
    s += box(60, 580, 140, 50, "#fff", "#166534", ["Warehouse SVG", "svg_generator.py"], 12)

    s += line_arrow(270, 430, 340, 500, "forecasts.csv")
    s += line_arrow(200, 525, 250, 525)
    s += line_arrow(340, 560, 200, 605, "slot_registry.json")

    # SEC 3: Cart Assignment
    s += f'<rect x="520" y="300" width="440" height="130" fill="#f1f5f9" stroke="#94a3b8" stroke-width="2" stroke-dasharray="8,4" rx="10"/>\n'
    s += text(530, 325, "Cart Assignment (Planned)", 16, True, italic=True, color="#64748b")
    s += box(540, 350, 160, 50, "#fff", "#94a3b8", ["Fuzzy C Clustering", "Planned"], 14, dash="4,4")
    s += box(750, 350, 180, 50, "#cbd5e1", "#94a3b8", ["Cart Capacity DB", "Planned"], 14, dash="4,4")
    
    s += line_arrow(430, 530, 540, 375, "Triggers", dashed=True)
    s += line_arrow(700, 375, 750, 375, dashed=True)

    # SEC 4: Hybrid Routing
    s += f'<rect x="520" y="450" width="440" height="200" fill="#f1f5f9" stroke="#94a3b8" stroke-width="2" stroke-dasharray="8,4" rx="10"/>\n'
    s += text(530, 475, "Hybrid Routing (Planned)", 16, True, italic=True, color="#64748b")
    
    s += box(750, 500, 180, 50, "#cbd5e1", "#94a3b8", ["IACO (Global Optimizer)", "Planned"], 12, dash="4,4")
    s += box(540, 500, 160, 50, "#fff", "#94a3b8", ["A* Path Planner", "Planned"], 12, dash="4,4")
    s += box(540, 570, 160, 50, "#fff", "#94a3b8", ["DWA Local Planner", "Planned"], 12, dash="4,4")
    s += box(750, 570, 180, 50, "#cbd5e1", "#94a3b8", ["Optimized Cart Route", "Planned"], 12, dash="4,4")

    s += line_arrow(840, 400, 840, 500, dashed=True)
    s += line_arrow(750, 525, 700, 525, dashed=True)
    s += line_arrow(620, 550, 620, 570, dashed=True)
    s += line_arrow(700, 595, 750, 595, dashed=True)

    with open(os.path.join(SVG_DIR, "high_level_architecture.svg"), "w") as f: f.write(pure_svg_wrap(1000, 700, s))

# 2. Master Class Diagram
def gen_class():
    s = marker()
    
    def class_box(x, y, name, attrs, methods, planned=False):
        w = 260
        h = 30 + 20*len(attrs) + 20*len(methods) + (20 if methods else 0)
        dash = "8,4" if planned else ""
        fill = "#f1f5f9" if planned else "#fff"
        head_fill = "#e2e8f0" if planned else "#dbeafe"
        stroke = "#94a3b8" if planned else "#1e293b"
        tc = "#64748b" if planned else "#0f172a"
        fst = 'font-style="italic"' if planned else ''

        b = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" stroke="{stroke}" stroke-width="2" stroke-dasharray="{dash}"/>\n'
        b += f'<rect x="{x}" y="{y}" width="{w}" height="30" fill="{head_fill}" stroke="{stroke}" stroke-width="2" stroke-dasharray="{dash}"/>\n'
        b += text(x+w/2, y+20, name, 14, True, planned, tc, "middle")
        if planned:
            b += f'<rect x="{x+w-50}" y="{y-10}" width="60" height="20" rx="4" fill="#64748b"/>\n'
            b += f'<text x="{x+w-20}" y="{y+4}" font-size="10" fill="#fff" text-anchor="middle">Planned</text>\n'

        cy = y + 45
        for a in attrs:
            b += text(x+10, cy, a, 12, False, planned, tc)
            cy += 20
        b += f'<line x1="{x}" y1="{cy-10}" x2="{x+w}" y2="{cy-10}" stroke="{stroke}" stroke-width="2" stroke-dasharray="{dash}"/>\n'
        for m in methods:
            b += text(x+10, cy+10, m, 12, False, planned, tc)
            cy += 20
        return b
        
    s += class_box(50, 50, "ServerRoutes (JS Express)", ["- DATA_DIR: path", "- PROCESSED_DIR: path", "- SVG_DIR: path"], ["+ POST /api/orders", "+ GET /api/orders", "+ POST /api/arrive", "+ GET /api/forecast", "+ POST /api/reset-warehouse"])
    
    s += class_box(350, 50, "ItemMeta (JSON)", ["- item_id: str", "- category: str", "- current_stock: int", "- dept: str", "- reorder_point: int", "- size: str", "- unit_weight_kg: float"], [])
    s += class_box(650, 50, "SlotRegistry (JSON)", ["- last_updated: iso_date", "- total_batches: int", "- slots: Dict[slot_id, Slot]"], [])
    s += class_box(950, 50, "DemandForecast (CSV)", ["- item_id: str", "- lgbm_pred: float", "- xgb_pred: float", "- route: str"], [])
    
    s += class_box(350, 450, "OrderRegistry (JSON)", ["- orders: List[Order]"], [])
    s += class_box(650, 450, "Order (JSON node)", ["- order_id: str", "- placed_at: date", "- status: str", "- items: List[Item]"], [])
    s += class_box(950, 450, "ArrivalHistory (JSON)", ["- global_arrival_id: int", "- order_id: str", "- arrived_at: date", "- items: List"], [])

    s += class_box(50, 300, "slot_allocator.py (Python)", ["- df_prices: DataFrame", "- allocations: List"], ["+ demand_intensity()", "+ main() - strict rules", "-> Writes batch_allocations.json"])
    s += class_box(50, 550, "svg_generator.py (Python)", ["- CANVAS_W: int", "- CANVAS_H: int", "- zones: Dict", "- SHELF_SPACES: List"], ["+ build_svg_header()", "+ draw_layout_regions()", "+ draw_rack()", "+ generate()"])

    # Planned modules
    s += class_box(1250, 50, "CartAssigner", ["- clusters: List", "- threshold: float"], ["+ fuzzy_c_means()", "+ build_cart()"], True)
    s += class_box(1250, 300, "IACOPlanner", ["- nodes: List", "- pheromones: Matrix"], ["+ compute_global()"], True)
    s += class_box(1250, 550, "DWAPlanner", ["- local_map: Matrix"], ["+ plan_local()"], True)

    with open(os.path.join(SVG_DIR, "master_class_diagram.svg"), "w") as f: f.write(pure_svg_wrap(1600, 800, s))

# 3. ER Diagram (from ACTUAL JSON shapes)
def gen_er():
    s = marker()
    def ent(x, y, nm, *attrs):
        b = f'<rect x="{x}" y="{y}" width="250" height="{30+20*len(attrs)}" fill="#fff" stroke="#1e293b" stroke-width="2"/>\n'
        b += f'<rect x="{x}" y="{y}" width="250" height="30" fill="#cbd5e1" stroke="#1e293b" stroke-width="2"/>\n'
        b += text(x+125, y+20, nm, 14, True, False, "#0f172a", "middle")
        cy = y + 45
        for a in attrs:
            is_pk = a.startswith("PK:")
            is_fk = a.startswith("FK:")
            label = a
            if is_pk:
                label = f"<u>{a}</u>" 
            elif is_fk:
                label = f"<i>{a}</i>"
            # Since raw svg doesn't easily do partial styling without tspan, I'll rough it:
            fs = 12
            b += f'<text x="{x+10}" y="{cy}" font-size="{fs}" fill="#333">{a}</text>\n'
            cy += 20
        return b
        
    s += ent(50, 50, "item_meta.json", "PK: item_id", "category (String)", "dept (String)", "current_stock (Integer)", "unit_weight_kg (Float)", "size (String)")
    s += ent(400, 50, "slot_registry.json [slots]", "PK: slot_id", "zone (String)", "level (String)", "occupied (Boolean)", "FK: item_id (String)", "weight (Float)", "demand (String)")
    
    s += ent(750, 50, "orders.json [Array]", "PK: order_id", "placed_at (String ISO)", "status (Ordered|Partial|Complete)", "items [Array of Object]")
    s += ent(1050, 50, "orders.json -> items", "FK: item_id", "qty_ordered (Integer)", "arrived (Boolean)")
    
    s += ent(750, 350, "arrivals_history.json [Array]", "PK: global_arrival_id", "FK: order_id", "arrived_at (String ISO)", "items [Array of Object]")
    s += ent(1050, 350, "arrivals_history.json -> items", "FK: item_id", "weight (Float)", "qty (Integer)")

    s += ent(50, 350, "forecasts_output.csv", "PK: id (sku_id)", "lgbm_pred (Float)", "xgb_pred (Float)", "route (String)", "sales (Integer)")

    s += line_arrow(300, 100, 400, 100, "1:N references")
    s += line_arrow(1000, 100, 1050, 100, "contains")
    s += line_arrow(1000, 400, 1050, 400, "contains")
    s += line_arrow(875, 140, 875, 350, "1:N correlates")
    
    with open(os.path.join(SVG_DIR, "er_diagram.svg"), "w") as f: f.write(pure_svg_wrap(1350, 600, s))

# 4. Swimlane Diagram (Actual Request Flow)
def gen_swim():
    s = marker()
    lanes = ["MANAGER (Browser UI)", "FRONTEND (JS Logic)", "BACKEND (Express.js)", "ML & SYSTEM (Python / Disk)"]
    for idx, l in enumerate(lanes):
        s += f'<rect x="180" y="{50 + idx*150}" width="1150" height="150" fill="{"#f8fafc" if idx%2==0 else "#ffffff"}" stroke="#cbd5e1" stroke-width="1"/>\n'
        s += text(20, 120 + idx*150, l, 13, True)
    
    s += box(200, 80, 140, 50, "#fff", "#334155", ["Clicks 'Reset'"], 12)
    s += line_arrow(270, 130, 270, 210, "JS event")
    s += box(200, 210, 140, 50, "#fff", "#334155", ["fetch(/api/reset...)"], 12)
    s += line_arrow(270, 260, 270, 370, "HTTP POST")
    s += box(200, 370, 140, 50, "#fff", "#334155", ["Clears JSON files"], 12)
    s += line_arrow(270, 420, 270, 520, "exec(python)")
    s += box(200, 520, 140, 50, "#fff", "#334155", ["svg_generator.py", "(Overwrites UI SVG)"], 12)

    s += box(450, 80, 140, 50, "#fff", "#334155", ["Clicks 'Order Now'"], 12)
    s += line_arrow(520, 130, 520, 370, "HTTP POST /api/orders")
    s += box(450, 370, 140, 50, "#fff", "#334155", ["Appends to orders.json"], 12)

    s += box(650, 80, 140, 50, "#fff", "#334155", ["Mark Arrived"], 12)
    s += line_arrow(720, 130, 720, 370, "HTTP POST /api/arrive")
    s += box(650, 370, 160, 50, "#fff", "#334155", ["Update order status", "Save pending items"], 12)
    s += line_arrow(730, 420, 730, 520, "exec(python)")
    s += box(650, 520, 160, 50, "#fff", "#334155", ["slot_allocator.py"], 12)
    s += line_arrow(810, 545, 850, 545)
    s += box(850, 520, 160, 50, "#fff", "#334155", ["Writes batch_results", "Re-calls svg_generator.py"], 12)

    with open(os.path.join(SVG_DIR, "swimlane_diagram.svg"), "w") as f: f.write(pure_svg_wrap(1350, 700, s))

# 5. State Diagram (ACTUAL ORDERS)
def gen_state():
    s = marker()
    s += f'<circle cx="50" cy="150" r="15" fill="#000"/>\n'
    s += box(150, 130, 120, 40, "#fff", "#333", ["Ordered"])
    s += line_arrow(65, 150, 150, 150, "POST /api/orders")
    
    s += box(450, 50, 120, 40, "#fff", "#b45309", ["Partial"])
    s += box(450, 250, 120, 40, "#fff", "#166534", ["Complete"])
    
    s += line_arrow(270, 140, 450, 70, "POST /api/arrive (arrived_item_ids < total)")
    s += line_arrow(270, 160, 450, 270, "POST /api/arrive (all items)")
    s += line_arrow(510, 90, 510, 250, "POST /api/arrive (remaining items)")

    s += f'<circle cx="750" cy="270" r="15" fill="#fff" stroke="#000" stroke-width="4"/>\n'
    s += f'<circle cx="750" cy="270" r="8" fill="#000"/>\n'
    s += line_arrow(570, 270, 730, 270, "end of lifecycle")
    
    with open(os.path.join(SVG_DIR, "state_diagram.svg"), "w") as f: f.write(pure_svg_wrap(850, 400, s))

# 6. UI Flow Diagram
def gen_ui():
    s = marker()
    s += box(100, 100, 250, 150, "#f8fafc", "#334155", ["index.html (Dashboard)", "KPI Cards", "Alerts Feed", "Warehouse Snapshot"], 16, bold_index=0)
    s += box(500, 50, 250, 120, "#f8fafc", "#334155", ["forecast.html", "Forecast Data Table", "Cart Actions"], 16, bold_index=0)
    s += box(500, 250, 250, 120, "#f8fafc", "#334155", ["orders.html", "Placed Orders UI", "Mark Arrived Buttons"], 16, bold_index=0)
    s += box(100, 350, 250, 120, "#f8fafc", "#334155", ["slot_allocation.html", "Fullscreen SVG Render"], 16, bold_index=0)
    
    s += line_arrow(350, 130, 500, 110, "href='forecast.html'")
    s += line_arrow(350, 170, 500, 280, "href='orders.html'")
    s += line_arrow(225, 250, 225, 350, "href='slot_allocation.html'")
    s += line_arrow(625, 170, 625, 250, "View Orders Form")

    with open(os.path.join(SVG_DIR, "ui_flow_diagram.svg"), "w") as f: f.write(pure_svg_wrap(850, 550, s))

# 7. Report Layouts
def gen_report():
    s = marker()
    s += box(50, 50, 300, 450, "#fff", "#333", [])
    s += text(200, 80, "index.html", 16, True, anchor="middle")
    s += box(60, 100, 280, 40, "#e2e8f0", "none", ["Nav (Dashboard | Forecast | ...)"], 12)
    s += box(60, 150, 280, 80, "#dbeafe", "none", ["4 KPI Cards Row"], 12)
    s += box(60, 240, 130, 150, "#fef3c7", "none", ["Items Needing", "Attention Panel"], 12)
    s += box(200, 240, 140, 150, "#f3f4f6", "none", ["Recent Activity Feed"], 12)
    s += box(60, 400, 280, 80, "#dcfce7", "none", ["Warehouse Snapshot SVG View"], 12)
    
    s += box(450, 50, 300, 450, "#fff", "#333", [])
    s += text(600, 80, "forecast.html", 16, True, anchor="middle")
    s += box(460, 100, 280, 40, "#e2e8f0", "none", ["Category Filters Row"], 12)
    s += box(460, 150, 280, 300, "#f0fdf4", "none", ["Table: Item | Demand | Stock"], 12)
    s += box(460, 460, 280, 30, "#334155", "none", ["Floating Cart Actions (Place Order)"], 10)
    
    s += box(850, 50, 300, 450, "#fff", "#333", [])
    s += text(1000, 80, "slot_allocation.html", 16, True, anchor="middle")
    s += box(860, 100, 280, 30, "#dbeafe", "none", ["Toolbar (Zoom In / Out / Reset)"], 12)
    s += box(860, 140, 280, 350, "#fff", "#cbd5e1", ["Pan-Zoom Warehouse Canvas"], 14)
    
    with open(os.path.join(SVG_DIR, "report_layouts.svg"), "w") as f: f.write(pure_svg_wrap(1200, 550, s))

# 8. External Interfaces
def gen_ext():
    s = marker()
    s += box(400, 200, 250, 150, "#e0e7ff", "#4338ca", ["EXPRESS BACKEND", "(server.js)"], 16, bold_index=0)
    
    s += box(50, 250, 150, 50, "#fff", "#334155", ["Managers Browser"], 14)
    s += line_arrow(200, 255, 400, 255, "JS fetch() DOM")
    s += line_arrow(400, 280, 200, 280, "JSON responses")
    
    s += box(750, 100, 180, 50, "#fff", "#b45309", ["data/registry/*.json"], 14)
    s += line_arrow(500, 200, 750, 125, "readFileSync")
    s += line_arrow(650, 200, 750, 145, "writeFileSync (orders)")

    s += box(750, 250, 180, 50, "#fff", "#166534", ["data/processed/*.csv"], 14)
    s += line_arrow(650, 275, 750, 275, "read CSV stats")

    s += box(750, 400, 180, 50, "#fff", "#334155", ["backend/services/*.py"], 14)
    s += line_arrow(525, 350, 750, 425, "child_process.exec()")
    
    with open(os.path.join(SVG_DIR, "external_interfaces.svg"), "w") as f: f.write(pure_svg_wrap(1000, 500, s))

# 9. Deployment Diagram
def gen_deploy():
    s = marker()
    s += box(50, 50, 900, 600, "#f8fafc", "#334155", ["Server Instance Node", "<<device>>"], bold_index=0)
    
    s += box(80, 120, 250, 250, "#e2e8f0", "#94a3b8", ["Node.js Server", "<<execution env>>"], bold_index=0)
    s += box(100, 170, 210, 60, "#fff", "#333", ["server.js (port 3001)", "cors, express=^5.2.1"], 12, bold_index=0)
    s += box(100, 250, 210, 40, "#fff", "#333", ["express.static('/frontend')"], 12)
    s += box(100, 310, 210, 40, "#fff", "#333", ["exec() spawns"], 12)

    s += box(400, 120, 500, 250, "#e2e8f0", "#94a3b8", ["Python 3 Runtime", "<<execution env>>"], bold_index=0)
    s += box(420, 160, 220, 50, "#fff", "#333", ["demand_forecasting_local.ipynb"], 12)
    s += box(420, 230, 220, 50, "#fff", "#333", ["slot_allocator.py", "(Pandas, Numpy)"], 12)
    s += box(420, 300, 220, 50, "#fff", "#333", ["svg_generator.py"], 12)
    s += box(670, 160, 180, 120, "#cbd5e1", "#333", ["Models Directory", "lgbm_model (In Memory)", "xgb_model (In Memory)"], 12, bold_index=0)

    s += box(80, 450, 380, 150, "#dbeafe", "#1e3a8a", ["File System: Registry Data", "<<artifact>>"], bold_index=0)
    s += text(100, 500, "- orders.json")
    s += text(100, 520, "- item_meta.json")
    s += text(250, 500, "- slot_registry.json")
    s += text(250, 520, "- arrivals_history.json")

    s += box(520, 450, 380, 150, "#dcfce7", "#166534", ["File System: Processed Output", "<<artifact>>"], bold_index=0)
    s += text(540, 500, "- forecasts.csv")
    s += text(540, 520, "- batch_allocation_results.csv")
    s += text(540, 540, "- frontend/svgs/*.svg")

    with open(os.path.join(SVG_DIR, "deployment_diagram.svg"), "w") as f: f.write(pure_svg_wrap(1000, 700, s))

if __name__ == "__main__":
    gen_hla()
    gen_class()
    gen_er()
    gen_swim()
    gen_state()
    gen_ui()
    gen_report()
    gen_ext()
    gen_deploy()
    print("All SVGs generated to", SVG_DIR)

    diagrams = [
        'high_level_architecture', 'master_class_diagram', 'er_diagram',
        'swimlane_diagram', 'state_diagram', 'ui_flow_diagram',
        'report_layouts', 'external_interfaces', 'deployment_diagram'
    ]
    
    import os
    os.environ['RL_RENDERPM_BACKEND'] = '_renderPM'
    from svglib.svglib import svg2rlg
    from reportlab.graphics import renderPM

    for name in diagrams:
        svg_path = os.path.join(SVG_DIR, f"{name}.svg")
        png_path = os.path.join(SVG_DIR, f"{name}.png")
        try:
            drawing = svg2rlg(svg_path)
            renderPM.drawToFile(drawing, png_path, fmt='PNG')
            print(f"Converted {name}.svg -> {name}.png")
        except Exception as e:
            print(f"Failed to convert {name}.svg: {e}")
