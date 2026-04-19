import xml.etree.ElementTree as ET

try:
    ET.parse('smart-inventory-app/../../../../data/processed/warehouse_allocated.svg')
    print('warehouse_allocated.svg: Valid XML')
except ET.ParseError as e:
    print(f'warehouse_allocated.svg: ParseError: {e}')
    
try:
    ET.parse('smart-inventory-app/../../../../data/processed/warehouse_blueprint.svg')
    print('warehouse_blueprint.svg: Valid XML')
except ET.ParseError as e:
    print(f'warehouse_blueprint.svg: ParseError: {e}')
