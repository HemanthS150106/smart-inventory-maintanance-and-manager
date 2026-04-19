import json
from step2_generate_blueprint import generate_blueprint_svg

# Load JSON
try:
    with open('batch_allocations.json', 'r') as f:
        allocated_slots = json.load(f)
    print(f"Loaded {len(allocated_slots)} allocated slots.")
    generate_blueprint_svg(filename="warehouse_allocated.svg", allocated_slots=allocated_slots)
except FileNotFoundError:
    print("Error: batch_allocations.json not found")
