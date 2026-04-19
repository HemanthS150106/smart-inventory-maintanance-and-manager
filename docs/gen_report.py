import os

out_path = r"c:\Users\heman\Downloads\capstone\smart-inventory-app\docs\report.html"

diagrams = [
    ('high_level_architecture', 'High Level Architecture', 'Shows the complete system pipeline from Demand Forecasting down to Slot Allocation (implemented) and Cart Routing (planned).'),
    ('master_class_diagram', 'Master Class Diagram', 'Internal software structural model detailing Express API routes, Python data generators, and JSON object layouts.'),
    ('er_diagram', 'Entity Relationship Diagram', 'Database schema tracking Orders, Arrivals, Item Meta, and Slot mappings natively mapped to the real JSON datasets.'),
    ('swimlane_diagram', 'Swimlane Diagram', 'Step-by-step cross-functional flow mapping user web interactions through Node.js Express APIs into standalone Python worker processes.'),
    ('state_diagram', 'State Diagram', 'Order lifecycle tracking item fulfillments, demonstrating Order -> Partial -> Complete progression limits.'),
    ('ui_flow_diagram', 'UI Flow Diagram', 'Navigational site-map linking Dashboard KPIs, Forecast logs, and Warehouse Canvas screens.'),
    ('report_layouts', 'Report Layouts', 'Structured UI wireframes matching the actual HTML frontend sections across index, forecast, and slot screens.'),
    ('external_interfaces', 'External Interfaces', 'System-level integration pathways showing local storage JSONs and REST API boundaries utilized by standard browser clients.'),
    ('deployment_diagram', 'Deployment Diagram', 'Execution layout showcasing the Node.js application wrapping multiple Python execution spaces and memory-resident LGBM/XGBoost structures.')
]

html = """<!DOCTYPE html>
<html>
<head>
<title>Smart Inventory System Report</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px 40px; color: #333; }
h1 { border-bottom: 2px solid #ccc; padding-bottom: 10px; }
section { margin-top: 40px; }
</style>
</head>
<body>
<h1>Smart Inventory Technical Architecture Report</h1>
"""

for idx, (name, title, desc) in enumerate(diagrams):
    html += f"""<section id="section-{idx+1}">
  <h2>{idx+1} — {title}</h2>
  <p>{desc}</p>
  <img src="diagrams/{name}.png"
       alt="{title}"
       style="width:100%; max-width:1100px; border:1px solid #e2e8f0;
              border-radius:8px; margin-top:12px;">
  <br>
  <a href="diagrams/{name}.svg" download
     style="font-size:13px; color:#1a56db; font-weight:600;">Download SVG</a>
</section>\n"""

html += "</body></html>"

with open(out_path, "w") as f:
    f.write(html)

print("Generated clean report.html")
