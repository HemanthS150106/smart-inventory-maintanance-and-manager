# Slot Allocation Logic Summary

## Overview
The Slot Allocation pipeline determines the optimal physical placement within the warehouse for arriving items. The core logic executes entirely within `slot_allocator.py` dynamically determining Zone and Rack levels immediately following item arrival scanning.

## Inputs
The backend passes a manifest of incoming items dictating exactly what needs sorting:
- `item_size`: The categorical volumetric grouping of the item (`S`, `M`, `L`, `XL`).
- `item_weight_kg`: The literal mass parsed via the JSON schemas (`item_meta.json`).
- `predicted_demand`: The numeric expected sales quantity pulled from `forecast_output.csv`.
- Current slot vacancies managed structurally by `slot_registry.json`.

## Shelf Level Determination Logic
The script first rigidly evaluates the mass of the item. To ensure ergonomic and safety distributions, heavy objects remain towards the ground via an explicit `if/else` stack:
- `wt < 5.0 kg`  -> **L5** (top rack) 
- `wt < 15.0 kg` -> **L4**
- `wt < 30.0 kg` -> **L3**
- `wt < 60.0 kg` -> **L2**
- else -> **L1** (bottom rack)

## Zone Determination Logic
With the Y-Axis depth established, the model parses demand and raw sizing to establish horizontal layout Zones:
- **Zone A** (High Demand + Small/Med format): `if dmd > 600 and sz in ['S', 'M']`
- **Zone B** (Medium Demand OR Large Volume Format): `elif (300 <= dmd <= 600) or sz in ['M', 'L']`
- **Zone C** (Exceptionally Heavy OR Extreme Volumes): `elif sz in ['L', 'XL'] or wt > 40`
- **Zone D** (Default Flow): Remaining items drop down.

## ML Model Role
Slot Allocation in the current codebase relies strictly on a **rules-based engine**. There is no secondary machine learning model or clustering layer actively predicting placement dynamically—it uses static python logic trees reacting to the forecasting engine's `predicted_demand` output. 

## Slot Assignment Process
1. Upon designating the target `zone` and `shelf`, the allocator pops the next available unique slot string from the `zone_slots` dictionary (e.g. `A1-03-L4`).
2. If `zone_slots[zone][shelf]` is entirely full, the allocator falls back on a strictly prioritized list traversing sequentially backwards through Zones `['D', 'C', 'B', 'A']` attempting to locate an empty location for that shelf tier.
3. The newly mapped attributes are stored, generating a `batch_allocation_results.csv`, subsequently writing to `data/registry/batch_allocations.json` for UI consumption.

## SVG Update Process
Following allocation success, the Express.js server runs the `subprocess.exec()` equivalent against `svg_generator.py`.
- The generator binds to `slot_registry.json` and evaluates the true allocation states, parsing `<rect>` tags dynamically.
- Empty positions compile to gray, occupied bins compile colors based on demand constraints (`High == #FF6B6B`, `Medium == #FFD93D` etc).

## Limitations
- **Velocity Tracking Absent**: Explicit inventory cycling velocity equations are missing, defaulting purely to numeric demand aggregates.
- **Rules Based Override**: The ML assignment mechanisms were deferred for strict rigid boundaries (e.g., rigid weight `15.0` thresholds).
