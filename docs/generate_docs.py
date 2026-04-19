import os

OUT_DIR = r"C:\Users\heman\Downloads\capstone\smart-inventory-app\docs"
SVG_DIR = os.path.join(OUT_DIR, "diagrams")
os.makedirs(SVG_DIR, exist_ok=True)

def pure_svg_wrap(w, h, content):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" style="background:#fff; font-family:sans-serif;">\n' + content + '\n</svg>'

def box(x, y, w, h, fill, stroke, text_lines=[], font_size=14, rx=5, dash=""):
    dash_attr = f'stroke-dasharray="{dash}"' if dash else ""
    s = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="2" {dash_attr}/>\n'
    ty = y + 25
    for idx, t in enumerate(text_lines):
        if t.startswith("<<") or t.startswith("-") or t.startswith("+"):
            fs = font_size - 2
            s += f'<text x="{x+10}" y="{ty+(idx*20)}" font-size="{fs}" fill="#333">{t}</text>\n'
        else:
            s += f'<text x="{x+w/2}" y="{ty+(idx*20)}" font-size="{font_size}" fill="#000" font-weight="bold" text-anchor="middle">{t}</text>\n'
    return s

def text(x, y, msg, font_size=14, bold=False):
    fw = 'font-weight="bold"' if bold else ''
    return f'<text x="{x}" y="{y}" font-size="{font_size}" fill="#333" {fw}>{msg}</text>\n'

def arrow_down(x, y1, y2, label=""):
    s = f'<line x1="{x}" y1="{y1}" x2="{x}" y2="{y2}" stroke="#666" stroke-width="2" marker-end="url(#arrow)"/>\n'
    if label:
        s += f'<rect x="{x+5}" y="{y1+(y2-y1)/2 - 10}" width="{len(label)*7+10}" height="20" fill="#fff" opacity="0.8"/>\n'
        s += f'<text x="{x+10}" y="{y1+(y2-y1)/2 + 4}" font-size="12" fill="#555">{label}</text>\n'
    return s

def marker():
    return '''<defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#666" />
    </marker>
  </defs>'''

def line_arrow(x1, y1, x2, y2, label="", dashed=False):
    dash_attr = 'stroke-dasharray="5,5"' if dashed else ''
    s = f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#666" stroke-width="2" {dash_attr} marker-end="url(#arrow)"/>\n'
    if label:
        mx = (x1 + x2)/2
        my = (y1 + y2)/2
        s += f'<rect x="{mx-10}" y="{my-12}" width="{len(label)*7+10}" height="18" fill="#fff" opacity="0.9"/>\n'
        s += f'<text x="{mx}" y="{my}" font-size="12" fill="#555" font-weight="bold">{label}</text>\n'
    return s

# 1. High Level Architecture
def gen_hla():
    s = marker()
    s += f'<rect x="10" y="10" width="880" height="630" fill="none" stroke="#333" stroke-width="4"/>\n'
    s += text(300, 40, "Smart Inventory System — High Level Architecture", 20, True)
    
    layers = [
        {"y": 70, "color": "#dbeafe", "name": "Layer 1 — PRESENTATION LAYER", "boxes": ["Forecast Page", "Orders Page", "Slot Allocation Page", "Dashboard"]},
        {"y": 180, "color": "#dcfce7", "name": "Layer 2 — APPLICATION / API LAYER", "boxes": ["Forecast Routes", "Order Routes", "Slot Routes", "SVG Generator"]},
        {"y": 290, "color": "#fef9c3", "name": "Layer 3 — SERVICE / BUSINESS LOGIC LAYER", "boxes": ["Demand Loader", "Slot Allocator", "Arrival Processor", "Order Manager"]},
        {"y": 400, "color": "#fce7f3", "name": "Layer 4 — ML LAYER", "boxes": ["Demand Forecasting Model (LightGBM)", "Slot Allocation Model (RF)"]},
        {"y": 510, "color": "#f3e8ff", "name": "Layer 5 — DATA LAYER", "boxes": ["sell_prices.csv", "slot_registry.json", "orders.json", "arrivals.json", "item_meta.json"]}
    ]
    
    for l in layers:
        s += f'<rect x="30" y="{l["y"]}" width="840" height="90" fill="{l["color"]}" rx="10"/>\n'
        s += text(40, l["y"]+20, l["name"], 14, True)
        
        bw = 800 / len(l["boxes"])
        for i, b in enumerate(l["boxes"]):
            bx = 40 + i*bw
            s += box(bx+10, l["y"]+35, bw-20, 40, "#fff", "#ccc", [b], 12)
            
    s += arrow_down(200, 160, 180)
    s += arrow_down(450, 160, 180)
    s += arrow_down(700, 160, 180)
    s += arrow_down(450, 270, 290)
    s += arrow_down(450, 380, 400)
    s += arrow_down(450, 490, 510)
    
    with open(os.path.join(SVG_DIR, "high_level_architecture.svg"), "w") as f:
        f.write(pure_svg_wrap(900, 650, s))

def gen_class():
    s = marker()
    
    def class_box(x, y, name, attrs, methods):
        w = 220
        h = 30 + 20*len(attrs) + 20*len(methods)
        b = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#fff" stroke="#333" stroke-width="2"/>\n'
        b += f'<rect x="{x}" y="{y}" width="{w}" height="30" fill="#e2e8f0" stroke="#333" stroke-width="2"/>\n'
        b += text(x+w/2 - len(name)*4, y+20, name, 14, True)
        cy = y + 45
        for a in attrs:
            b += text(x+10, cy, a, 12)
            cy += 20
        b += f'<line x1="{x}" y1="{cy-10}" x2="{x+w}" y2="{cy-10}" stroke="#333" stroke-width="2"/>\n'
        for m in methods:
            b += text(x+10, cy+10, m, 12)
            cy += 20
        return b
        
    s += class_box(50, 50, "ItemMeta", ["- item_id: str", "- category: str", "- dept: str", "- store: str", "- current_stock: int", "- reorder_point: int", "- unit_weight_kg: float", "- size: str"], ["+ get_shelf_level()", "+ get_zone_hint()", "+ is_low_stock()"])
    s += class_box(320, 50, "DemandForecast", ["- item_id: str", "- predicted_demand: float", "- horizon_days: int", "- peak_day: date", "- confidence_pct: float"], ["+ get_shortage()", "+ get_risk_level()", "+ get_suggested_order()"])
    s += class_box(650, 50, "Order", ["- order_id: str", "- placed_at: datetime", "- status: str", "- items: List[OrderItem]"], ["+ confirm()", "+ mark_partial()", "+ mark_complete()"])
    s += class_box(920, 50, "OrderItem", ["- item_id: str", "- qty_ordered: int", "- estimated_zone: str", "- estimated_level: str"], ["+ get_estimated_slot()"])
    
    s += class_box(650, 350, "Arrival", ["- global_arrival_id: int", "- order_id: str", "- arrived_at: datetime", "- items: List[str]"], ["+ trigger_allocation()"])
    s += class_box(320, 350, "SlotAllocator", ["- registry: SlotRegistry", "- model: RandomForest"], ["+ determine_zone()", "+ determine_level()", "+ allocate_batch()"])
    s += class_box(50, 350, "SlotRegistry", ["- slots: Dict[str, Slot]", "- total_batches: int"], ["+ find_available()", "+ allocate()", "+ reset()", "+ get_utilisation()"])
    
    s += class_box(50, 650, "Slot", ["- slot_id: str", "- zone: str", "- level: str", "- bay: int", "- occupied: bool", "- item_id: str", "- batch_id: int"], ["+ occupy(item, batch)", "+ vacate()"])
    s += class_box(320, 650, "SVGGenerator", ["- registry: SlotRegistry", "- canvas_w: int", "- canvas_h: int"], ["+ draw_rack()", "+ draw_zone()", "+ render_blueprint()", "+ render_allocated()"])
    
    s += line_arrow(650, 120, 520, 120, "1..many")  # Order to DemandForecast? No, Order to OrderItem
    s += line_arrow(870, 120, 920, 120, "1..many") 
    s += line_arrow(760, 240, 760, 350, "1..many")  # Order to Arrival
    s += line_arrow(650, 420, 540, 420, "triggers")
    s += line_arrow(320, 420, 270, 420, "1..1")
    s += line_arrow(160, 560, 160, 650, "1..many") # SlotRegistry to Slot
    s += line_arrow(320, 120, 270, 120, "uses")
    s += line_arrow(430, 650, 270, 560, "uses")      # SVGGenerator to SlotRegistry
    
    with open(os.path.join(SVG_DIR, "master_class_diagram.svg"), "w") as f:
        f.write(pure_svg_wrap(1200, 900, s))

def gen_er():
    # Placeholder for ER - simple implementation
    s = marker()
    def ent(x, y, nm, *attrs):
        b = f'<rect x="{x}" y="{y}" width="220" height="{30+20*len(attrs)}" fill="#fff" stroke="#000" stroke-width="2"/>\n'
        b += f'<rect x="{x}" y="{y}" width="220" height="30" fill="#ffe4e1"/>\n'
        b += text(x+110-len(nm)*4, y+20, nm, 14, True)
        cy = y + 45
        for a in attrs:
            b += text(x+10, cy, a, 12)
            cy += 20
        return b
        
    s += ent(50, 50, "ITEM_META", "PK: item_id", "category", "dept", "current_stock")
    s += ent(350, 50, "DEMAND_FORECAST", "PK: forecast_id", "FK: item_id", "predicted_demand")
    s += ent(650, 50, "ORDER", "PK: order_id", "placed_at", "status")
    s += ent(50, 300, "ORDER_ITEM", "PK: order_item_id", "FK: order_id", "FK: item_id", "qty_ordered")
    s += ent(350, 300, "ARRIVAL", "PK: global_arrival_id", "FK: order_id", "arrived_at")
    s += ent(650, 300, "ARRIVAL_ITEM", "PK: arrival_item_id", "FK: arrival_id", "FK: item_id")
    s += ent(50, 550, "SLOT", "PK: slot_id", "zone", "level", "bay", "occupied")
    s += ent(350, 550, "SLOT_ALLOCATION", "PK: allocation_id", "FK: slot_id", "FK: item_id")
    
    s += line_arrow(270, 100, 350, 100, "1:N")
    s += line_arrow(650, 100, 570, 100, "N:1") # ORDER to DEMAND_FORECAST proxy
    with open(os.path.join(SVG_DIR, "er_diagram.svg"), "w") as f:
        f.write(pure_svg_wrap(1100, 800, s))

def gen_swim():
    s = marker()
    lanes = ["MANAGER", "FRONTEND", "BACKEND / API", "ML MODELS & DATA"]
    for idx, l in enumerate(lanes):
        s += f'<rect x="150" y="{50 + idx*150}" width="1000" height="150" fill="{"#f8f9fa" if idx%2==0 else "#ffffff"}" stroke="#dee2e6" stroke-width="1"/>\n'
        s += text(20, 120 + idx*150, l, 14, True)
    
    s += box(200, 80, 150, 50, "#fff", "#333", ["Reviews Forecast"])
    s += arrow_down(275, 130, 230)
    s += box(200, 230, 150, 50, "#fff", "#333", ["Displays UI"])
    s += arrow_down(275, 280, 380)
    s += box(200, 380, 150, 50, "#fff", "#333", ["/api/forecast"])
    s += arrow_down(275, 430, 530)
    s += box(200, 530, 150, 50, "#fff", "#333", ["Predict Next 28 Days"])
    s += line_arrow(350, 550, 500, 420)
    
    s += box(450, 380, 150, 50, "#fff", "#333", ["Return Output"])
    s += arrow_down(525, 380, 280)
    s += box(450, 230, 150, 50, "#fff", "#333", ["Show Cart"])
    s += arrow_down(525, 230, 130)
    s += box(450, 80, 150, 50, "#fff", "#333", ["Place Order"])
    
    with open(os.path.join(SVG_DIR, "swimlane_diagram.svg"), "w") as f:
        f.write(pure_svg_wrap(1200, 700, s))

def gen_state():
    s = marker()
    s += f'<circle cx="50" cy="50" r="15" fill="#000"/>\n'
    s += box(150, 30, 120, 40, "#fff", "#333", ["DRAFT"])
    s += line_arrow(65, 50, 150, 50, "Add")
    s += box(350, 30, 120, 40, "#fff", "#333", ["CONFIRMED"])
    s += line_arrow(270, 50, 350, 50, "Place Order")
    s += box(550, 30, 120, 40, "#fff", "#333", ["PARTIAL"])
    s += line_arrow(470, 50, 550, 50, "Arrive Some")
    s += box(750, 30, 120, 40, "#fff", "#333", ["COMPLETE"])
    s += line_arrow(670, 50, 750, 50, "Arrive All")
    
    with open(os.path.join(SVG_DIR, "state_diagram.svg"), "w") as f:
        f.write(pure_svg_wrap(900, 650, s))

def gen_ui():
    s = marker()
    s += box(100, 100, 250, 150, "#f8f9fa", "#333", ["Forecast Page", "- Table", "- Cart"], 16)
    s += box(500, 100, 250, 150, "#f8f9fa", "#333", ["Orders Page", "- Review Orders", "- Confirm Arrived"], 16)
    s += box(300, 350, 250, 150, "#f8f9fa", "#333", ["Slot Allocation Page", "- SVG Blueprint", "- History"], 16)
    
    s += line_arrow(350, 175, 500, 175, "Review ->")
    s += line_arrow(625, 250, 425, 350, "Mark Arrived ->")
    s += line_arrow(300, 425, 225, 250, "Nav ->")
    
    with open(os.path.join(SVG_DIR, "ui_flow_diagram.svg"), "w") as f:
        f.write(pure_svg_wrap(1100, 700, s))

def gen_report():
    s = marker()
    s += box(50, 50, 400, 600, "#fff", "#333")
    s += text(250, 80, "Forecast Page", 16, True)
    s += box(60, 100, 380, 50, "#eee", "none")
    s += box(60, 160, 380, 400, "#f0f0f0", "none")
    
    s += box(480, 50, 400, 600, "#fff", "#333")
    s += text(680, 80, "Orders Page", 16, True)
    s += box(490, 100, 380, 50, "#eee", "none")
    s += box(490, 160, 380, 400, "#e8f4f8", "none")
    
    s += box(910, 50, 400, 600, "#fff", "#333")
    s += text(1110, 80, "Slot Allocation Page", 16, True)
    s += box(920, 100, 380, 50, "#eee", "none")
    s += box(920, 160, 380, 300, "#e8f8e8", "none", ["SVG VIEWER"])
    s += box(920, 470, 380, 150, "#fff3e0", "none", ["Allocations"])
    
    with open(os.path.join(SVG_DIR, "report_layouts.svg"), "w") as f:
        f.write(pure_svg_wrap(1400, 900, s))

def gen_ext():
    s = marker()
    s += box(400, 200, 200, 200, "#e6f2ff", "#1890ff", ["Smart Inventory", "System"])
    
    s += box(50, 100, 150, 50, "#fff", "#333", ["ML Notebook"])
    s += line_arrow(200, 125, 400, 225, "CSV")
    
    s += box(50, 400, 150, 50, "#fff", "#333", ["JSON DB"])
    s += line_arrow(400, 375, 200, 425, "R/W JSON")
    
    s += box(750, 275, 150, 50, "#fff", "#333", ["Browser"], dash="5,5")
    s += line_arrow(600, 275, 750, 275, "HTTP/HTML", dashed=True)
    
    with open(os.path.join(SVG_DIR, "external_interfaces.svg"), "w") as f:
        f.write(pure_svg_wrap(900, 600, s))

def gen_deploy():
    s = marker()
    s += box(50, 50, 800, 600, "#fff", "#333", ["Developer Machine", "<<device>>"])
    
    s += box(70, 100, 350, 250, "#f0f2f5", "#ccc", ["Python Runtime", "<<exec>>"])
    s += box(100, 140, 290, 50, "#fff", "#000", ["Flask App"])
    s += box(100, 210, 290, 50, "#fff", "#000", ["SVG Generator"])
    s += box(100, 280, 290, 50, "#fff", "#000", ["ML Models"])
    
    s += box(470, 100, 350, 150, "#f0f2f5", "#ccc", ["Browser (Chrome)", "<<exec>>"])
    s += box(500, 140, 290, 90, "#fff", "#000", ["Frontend HTML/JS"])
    
    s += line_arrow(470, 140, 420, 140, "HTTP :5000", dashed=True)
    
    s += box(70, 400, 750, 200, "#e8f4f8", "#000", ["File System", "<<artifact>>"])
    s += box(100, 440, 200, 60, "#fff", "#333", ["data/ JSON+CSV"])
    s += box(350, 440, 200, 60, "#fff", "#333", ["frontend/ SVGs"])
    
    with open(os.path.join(SVG_DIR, "deployment_diagram.svg"), "w") as f:
        f.write(pure_svg_wrap(900, 700, s))

def build_report():
    html = """<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Smart Inventory System - Technical Design Document</title>
    <style>
        body { font-family: Georgia, serif; line-height: 1.6; margin: 0; display: flex; color: #333; background: #fff; }
        nav { width: 250px; background: #f8f9fa; padding: 20px; position: fixed; height: 100vh; overflow-y: auto; border-right: 1px solid #ddd; }
        nav a { display: block; padding: 5px 0; color: #0056b3; text-decoration: none; }
        nav a:hover { text-decoration: underline; }
        .content { margin-left: 270px; padding: 40px; max-width: 900px; }
        h1, h2, h3 { font-family: "Helvetica Neue", Arial, sans-serif; }
        h1 { color: #111; margin-bottom: 0; }
        .subtitle { color: #666; font-size: 1.2em; margin-bottom: 40px; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background: #f4f4f4; }
        svg { max-width: 100%; height: auto; border: 1px solid #ddd; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin: 20px 0; }
        .dl-btn { position: fixed; top: 10px; right: 20px; padding: 10px 20px; background: #0056b3; color: white; border: none; cursor: pointer; border-radius: 4px; }
        @media print {
            nav, .dl-btn { display: none !important; }
            .content { margin: 0; padding: 0; width: 100%; max-width: 100%; }
        }
    </style>
</head>
<body>
    <button class="dl-btn" onclick="downloadAll()">Download All Diagrams</button>
    <nav>
        <h2>Navigation</h2>
        <a href="#overview">1.0 Overview</a>
        <a href="#hla">6.1 High Level Architecture</a>
        <a href="#class_diagram">6.2 Master Class Diagram</a>
        <a href="#er_diagram">6.3 ER Diagram</a>
        <a href="#swimlane">6.4 Swimlane Diagram</a>
        <a href="#state">6.5 State Diagram</a>
        <a href="#ui_flow">6.6 UI Flow Diagram</a>
        <a href="#layouts">6.7 Report Layouts</a>
        <a href="#ext_interfaces">6.8 External Interfaces</a>
        <a href="#deployment">6.9 Deployment Diagram</a>
    </nav>
    <div class="content">
        <h1>Smart Inventory Management System</h1>
        <div class="subtitle">Capstone Project — Technical Design Document</div>

        <h2 id="overview">1.0 Project Overview</h2>
        <h3>1.1 Project Purpose</h3>
        <p>A web-based smart inventory system that uses machine learning demand 
forecasting to help warehouse managers make restocking decisions, 
track orders, and optimally allocate warehouse shelf slots to arriving
goods based on predicted demand and item weight.</p>

        <h3>1.2 Tech Stack</h3>
        <table>
            <tr><th>Layer</th><th>Technology</th></tr>
            <tr><td>Frontend</td><td>HTML, CSS, JavaScript</td></tr>
            <tr><td>Backend</td><td>Python (Flask / FastAPI)</td></tr>
            <tr><td>ML / Forecasting</td><td>LightGBM / XGBoost, Pandas, NumPy</td></tr>
            <tr><td>Slot Allocation</td><td>Decision Tree / Random Forest</td></tr>
            <tr><td>Data Storage</td><td>JSON files, CSV</td></tr>
            <tr><td>Visualisation</td><td>SVG (programmatically generated)</td></tr>
        </table>

        <h3>1.3 Core Workflow</h3>
        <ol>
            <li>Demand Forecast model predicts 28-day demand per item</li>
            <li>Manager reviews forecast, identifies high-shortage items</li>
            <li>Manager places order for selected items</li>
            <li>Items physically arrive at warehouse (partial or full)</li>
            <li>Manager marks arrived items — slot allocation runs automatically</li>
            <li>Each item is assigned a rack, bay, and shelf level based on demand (zone) and weight (level L1–L5)</li>
            <li>Warehouse SVG updates to show occupied slots</li>
        </ol>
"""
    
    sections = [
        ("6.1 High Level Architecture", "hla", "high_level_architecture.svg"),
        ("6.2 Master Class Diagram", "class_diagram", "master_class_diagram.svg"),
        ("6.3 ER Diagram", "er_diagram", "er_diagram.svg"),
        ("6.4 Swimlane Diagram", "swimlane", "swimlane_diagram.svg"),
        ("6.5 State Diagram", "state", "state_diagram.svg"),
        ("6.6 UI Flow Diagram", "ui_flow", "ui_flow_diagram.svg"),
        ("6.7 Report Layouts", "layouts", "report_layouts.svg"),
        ("6.8 External Interfaces", "ext_interfaces", "external_interfaces.svg"),
        ("6.9 Deployment Diagram", "deployment", "deployment_diagram.svg"),
    ]
    
    for title, anchor, svg_file in sections:
        html += f'<hr><h2 id="{anchor}">{title}</h2>\n'
        with open(os.path.join(SVG_DIR, svg_file), "r") as f:
            html += f.read() + "\n"
            
    html += """
        <script>
            function downloadAll() {
                const svgs = document.querySelectorAll('svg');
                svgs.forEach((svg, idx) => {
                    const blob = new Blob([svg.outerHTML], {type: 'image/svg+xml'});
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `diagram_${idx+1}.svg`;
                    a.click();
                });
            }
        </script>
    </div>
</body>
</html>
"""
    with open(os.path.join(OUT_DIR, "report.html"), "w") as f:
        f.write(html)

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
    build_report()
    print("Done")
