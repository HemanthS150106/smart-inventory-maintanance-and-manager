import json
import os
import math

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REGISTRY_PATH = os.path.join(BASE_DIR, 'data', 'registry', 'slot_registry.json')
BLUEPRINT_OUT = os.path.join(BASE_DIR, 'frontend', 'public', 'svgs', 'warehouse_blueprint.svg')
ALLOCATED_OUT = os.path.join(BASE_DIR, 'frontend', 'public', 'svgs', 'warehouse_allocated.svg')
BLUEPRINT_SRC = os.path.join(BASE_DIR, 'frontend', 'svgs', 'warehouse_blueprint.svg')
ALLOCATED_SRC = os.path.join(BASE_DIR, 'frontend', 'svgs', 'warehouse_allocated.svg')
ALLOCATED_PUB = os.path.join(BASE_DIR, 'frontend', 'public', 'warehouse_allocated.svg')

RACK_W, RACK_H = 80, 160
RACK_GAP       = 16
WALKING_AISLE  = 48
PAIR_GAP       = 70

SHELF_BOARDS = [0, 32, 64, 96, 128]
SHELF_SPACES = [
    ('L5', 8,  24),
    ('L4', 40, 24),
    ('L3', 72, 24),
    ('L2', 104, 24),
    ('L1', 136, 24),
]

ZONE_COLORS = {
    'A': '#dbeafe',
    'B': '#dcfce7',
    'C': '#fef3c7',
    'D': '#f3e8ff',
}

CART_STATUS_COLORS = {
    'not_allocated': '#f8f9fa',
    'slot_only':     '#fbbf24',
    'cart_allocated':'#22c55e',
}

def draw_rack(elements, registry_slots, x, y, zone,
              pair_num, row_label, num_bays,
              show_level_labels=True, all_slots_list=None):
    '''
    Draw one rack at position (x, y).
    A rack has num_bays bays side by side.
    Each bay has 5 shelf levels.
    Generates slot IDs and draws shelf spaces.
    '''
    rack_total_w = num_bays * (RACK_W + RACK_GAP) - RACK_GAP

    # Draw rack background (very light grey)
    elements.append(
        f'<rect x="{x}" y="{y}" width="{rack_total_w}" '
        f'height="{RACK_H}" fill="#f1f5f9" '
        f'stroke="#cbd5e1" stroke-width="1" rx="2"/>'
    )

    for bay in range(num_bays):
        bx = x + bay * (RACK_W + RACK_GAP)

        # Left and right upright columns
        elements.append(
            f'<rect x="{bx}" y="{y}" width="7" '
            f'height="{RACK_H}" fill="#1e3a5f"/>'
        )
        elements.append(
            f'<rect x="{bx + RACK_W - 7}" y="{y}" width="7" '
            f'height="{RACK_H}" fill="#1e3a5f"/>'
        )

        # Shelf boards
        for board_y_off in SHELF_BOARDS:
            elements.append(
                f'<rect x="{bx + 7}" y="{y + board_y_off}" '
                f'width="{RACK_W - 14}" height="6" '
                f'fill="#94a3b8"/>'
            )

        # Shelf spaces
        for level_name, space_y_off, space_h in SHELF_SPACES:
            slot_id = (f'{zone}{pair_num}{row_label}'
                       f'-{bay+1:02d}-{level_name}')

            sx = bx + 7
            sy = y + space_y_off
            sw = RACK_W - 14
            sh = space_h

            # Get cart_status from registry
            slot_data = registry_slots.get(slot_id, {})
            cart_status = slot_data.get('cart_status', 'not_allocated')
            occupied    = slot_data.get('occupied', False)
            item_id     = slot_data.get('item_id', '')
            batch_id    = slot_data.get('batch_id', '')

            fill = CART_STATUS_COLORS.get(cart_status, '#f8f9fa')

            # Create a unique clipPath for this slot to prevent text overflow
            clip_id = f'clip-{slot_id.replace("-", "")}'
            elements.append(
                f'<defs><clipPath id="{clip_id}">'
                f'<rect x="{sx}" y="{sy}" width="{sw}" height="{sh}"/>'
                f'</clipPath></defs>'
            )

            elements.append(
                f'<rect id="rect-{slot_id}" x="{sx}" y="{sy}" width="{sw}" '
                f'height="{sh}" fill="{fill}" '
                f'stroke="#e2e8f0" stroke-width="0.5" '
                f'data-slot-id="{slot_id}" '
                f'data-batch-id="{batch_id}" '
                f'data-zone="{zone}" '
                f'data-level="{level_name}" '
                f'data-cart-status="{cart_status}"/>'
            )

            if occupied and item_id:
                # Show truncated item ID (item is in this slot)
                parts = str(item_id).split('_')
                # Show max 10 chars to fit in shelf space
                label = '_'.join(parts[:2]) if len(parts) >= 2 else str(item_id)[:10]
                label = label[:12]  # hard cap

                elements.append(
                    f'<text id="text-id-{slot_id}" x="{sx + sw/2}" y="{sy + sh/2 + 2}" '
                    f'text-anchor="middle" dominant-baseline="middle" '
                    f'font-size="5" fill="#1e293b" font-weight="bold" '
                    f'clip-path="url(#{clip_id})">'
                    f'{label}</text>'
                )
            else:
                # Show slot ID only when empty — even smaller font
                short_id = slot_id.split('-')
                # Show just zone+pair+bay e.g. "A1-03"
                display_id = f'{short_id[0][-3:]}-{short_id[1]}' \
                             if len(short_id) >= 2 else slot_id[:8]

                elements.append(
                    f'<text id="text-empty-{slot_id}" x="{sx + sw/2}" y="{sy + sh/2 + 2}" '
                    f'text-anchor="middle" dominant-baseline="middle" '
                    f'font-size="4.5" fill="#94a3b8" '
                    f'clip-path="url(#{clip_id})">'
                    f'{display_id}</text>'
                )

            # Track slot for registry
            if all_slots_list is not None:
                cx_coord = sx + sw / 2
                cy_coord = sy + sh / 2
                all_slots_list.append({
                    'slot_id':    slot_id,
                    'zone':       zone,
                    'level':      level_name,
                    'bay':        bay + 1,
                    'pair':       pair_num,
                    'row':        row_label,
                    'x':          cx_coord,
                    'y':          cy_coord,
                    'occupied':   occupied,
                    'item_id':    item_id or None,
                    'batch_id':   batch_id or None,
                    'cart_status': cart_status
                })

        # Level labels on leftmost bay only
        if show_level_labels and bay == 0:
            for i, (lvl, sp_y, _) in enumerate(SHELF_SPACES):
                elements.append(
                    f'<text x="{bx - 4}" y="{y + sp_y + 15}" '
                    f'text-anchor="end" font-size="6" '
                    f'fill="#94a3b8">{lvl}</text>'
                )

def generate_svg():
    # Load existing registry to preserve occupancy data
    try:
        with open(REGISTRY_PATH) as f:
            existing_registry = json.load(f)
        registry_slots = existing_registry.get('slots', {})
    except Exception:
        existing_registry = {}
        registry_slots = {}

    elements = []
    all_slots = []

    # ── CANVAS & WALLS ──────────────────────────────────────
    elements.append(
        '<rect x="40" y="40" width="3120" height="1920" '
        'fill="white" stroke="#2c3e50" stroke-width="8"/>'
    )

    # ── STAGING & OFFICE ────────────────────────────────────
    elements.append(
        '<rect x="60" y="60" width="200" height="110" '
        'fill="#fef9c3" stroke="#f59e0b" stroke-width="2" rx="4"/>'
        '<text x="160" y="122" text-anchor="middle" '
        'font-size="11" fill="#92400e" font-weight="bold">'
        'STAGING</text>'
    )
    elements.append(
        '<rect x="2960" y="60" width="180" height="110" '
        'fill="#dcfce7" stroke="#16a34a" stroke-width="2" rx="4"/>'
        '<text x="3050" y="122" text-anchor="middle" '
        'font-size="11" fill="#166534" font-weight="bold">'
        'MANAGER OFFICE</text>'
    )

    # ── DOCKS ───────────────────────────────────────────────
    elements.append(
        '<rect x="40" y="880" width="80" height="160" '
        'fill="#bfdbfe" stroke="#3b82f6" stroke-width="2"/>'
        '<text x="80" y="970" text-anchor="middle" '
        'font-size="11" fill="#1e40af" font-weight="bold" '
        'transform="rotate(-90,80,970)">RECEIVING</text>'
    )
    elements.append(
        '<rect x="3080" y="880" width="80" height="160" '
        'fill="#bfdbfe" stroke="#3b82f6" stroke-width="2"/>'
        '<text x="3120" y="970" text-anchor="middle" '
        'font-size="11" fill="#1e40af" font-weight="bold" '
        'transform="rotate(90,3120,970)">DISPATCH</text>'
    )

    # ── MAIN HORIZONTAL AISLE ───────────────────────────────
    elements.append(
        '<rect x="40" y="980" width="3120" height="100" '
        'fill="#e2e8f0"/>'
        '<text x="1600" y="1037" text-anchor="middle" '
        'font-size="18" fill="#475569" font-weight="bold">'
        '◄ MAIN AISLE ►</text>'
    )

    # ── VERTICAL AISLES ─────────────────────────────────────
    elements.append(
        '<rect x="1540" y="40" width="120" height="1920" '
        'fill="#e2e8f0"/>'   # center vertical aisle
    )

    # ── ZONE BACKGROUNDS ────────────────────────────────────
    zones_bg = [
        ('A', 60,   190, 1460, 770,  '#dbeafe', '#1e40af',
         750,  185, 'ZONE A — High Demand'),
        ('B', 1680, 190, 1460, 770,  '#dcfce7', '#166534',
         2410, 185, 'ZONE B — Medium Demand'),
        ('C', 60,   1100,1460, 850,  '#fef3c7', '#92400e',
         750,  1094,'ZONE C — Heavy / Large'),
        ('D', 1680, 1100,1460, 850,  '#f3e8ff', '#6b21a8',
         2410, 1094,'ZONE D — Overflow'),
    ]
    for (zone, zx, zy, zw, zh, zfill, zcol,
         lx, ly, ltext) in zones_bg:
        elements.append(
            f'<rect x="{zx}" y="{zy}" width="{zw}" height="{zh}" '
            f'fill="{zfill}" opacity="0.35" rx="6"/>'
        )
        elements.append(
            f'<text x="{lx}" y="{ly}" text-anchor="middle" '
            f'font-size="20" fill="{zcol}" font-weight="bold">'
            f'{ltext}</text>'
        )

    # ── RACK PLACEMENT ──────────────────────────────────────
    BAYS_PER_RACK = 6  # bays per rack unit in a row

    def place_zone_racks(zone, x_start, y_start,
                          num_pairs, x_max):
        '''
        Place rack pairs in a zone.
        Each pair has top row + bottom row (walking aisle between).
        Returns list of placed slot data.
        '''
        y = y_start
        for pair_num in range(1, num_pairs + 1):
            # How many rack units fit horizontally?
            rack_unit_w = BAYS_PER_RACK * (RACK_W + RACK_GAP) - RACK_GAP
            available_w = x_max - x_start - 20
            num_rack_units = max(1,
                int(available_w / (rack_unit_w + 30)))

            # Top row of pair
            rx = x_start + 20
            for r in range(num_rack_units):
                draw_rack(
                    elements, registry_slots,
                    rx, y, zone, pair_num, 'A',
                    BAYS_PER_RACK,
                    show_level_labels=(r == 0),
                    all_slots_list=all_slots
                )
                rx += rack_unit_w + 30

            # Walking aisle space (implicit — just leave gap)
            y_bottom_row = y + RACK_H + WALKING_AISLE

            # Bottom row of pair
            rx = x_start + 20
            for r in range(num_rack_units):
                draw_rack(
                    elements, registry_slots,
                    rx, y_bottom_row, zone, pair_num, 'B',
                    BAYS_PER_RACK,
                    show_level_labels=False,
                    all_slots_list=all_slots
                )
                rx += rack_unit_w + 30

            y = y_bottom_row + RACK_H + PAIR_GAP

    # Zone A: top-left quadrant
    place_zone_racks('A', x_start=80,   y_start=210,
                      num_pairs=4, x_max=1530)

    # Zone B: top-right quadrant
    place_zone_racks('B', x_start=1680, y_start=210,
                      num_pairs=4, x_max=3140)

    # Zone C: bottom-left quadrant
    place_zone_racks('C', x_start=80,   y_start=1110,
                      num_pairs=3, x_max=1530)

    # Zone D: bottom-right quadrant
    place_zone_racks('D', x_start=1680, y_start=1110,
                      num_pairs=3, x_max=3140)

    # ── LEGEND ──────────────────────────────────────────────
    legend_items = [
        ('#f8f9fa', 'Not Allocated'),
        ('#fbbf24', 'Slot Only (awaiting cart)'),
        ('#22c55e', 'Cart Allocated'),
    ]
    lx, ly = 200, 1970
    elements.append(
        f'<text x="{lx}" y="{ly - 14}" '
        f'font-size="13" fill="#334155" font-weight="bold">'
        f'LEGEND:</text>'
    )
    for i, (color, label) in enumerate(legend_items):
        ex = lx + i * 280
        elements.append(
            f'<rect x="{ex}" y="{ly - 10}" width="18" height="18" '
            f'fill="{color}" stroke="#94a3b8" stroke-width="1"/>'
            f'<text x="{ex + 24}" y="{ly + 4}" '
            f'font-size="12" fill="#475569">{label}</text>'
        )

    # ── ASSEMBLE SVG ────────────────────────────────────────
    svg = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<svg viewBox="0 0 3200 2000" '
        'xmlns="http://www.w3.org/2000/svg" '
        'width="3200" height="2000">'
        '<title>Warehouse Floor Plan</title>'
    )
    svg += '\n'.join(elements)
    svg += '</svg>'

    # Write SVG files
    for path_to_write in [BLUEPRINT_OUT, BLUEPRINT_SRC]:
        os.makedirs(os.path.dirname(path_to_write), exist_ok=True)
        with open(path_to_write, 'w', encoding='utf-8') as f:
            f.write(svg)
        print(f'Blueprint written: {path_to_write}')

    # Also write allocated SVG (same content — occupancy shown via registry colors already)
    for path_to_write in [ALLOCATED_OUT, ALLOCATED_SRC, ALLOCATED_PUB]:
        os.makedirs(os.path.dirname(path_to_write), exist_ok=True)
        with open(path_to_write, 'w', encoding='utf-8') as f:
            f.write(svg)
        print(f'Allocated written: {path_to_write}')

    # ── WRITE REGISTRY ──────────────────────────────────────
    # Merge new slot list with existing occupancy data
    new_registry = {'last_updated': None,
                    'total_batches': existing_registry.get(
                        'total_batches', 0),
                    'slots': {}}

    for slot in all_slots:
        sid = slot['slot_id']
        existing = registry_slots.get(sid, {})
        new_registry['slots'][sid] = {
            'slot_id':     sid,
            'zone':        slot['zone'],
            'level':       slot['level'],
            'bay':         slot['bay'],
            'pair':        slot['pair'],
            'row':         slot['row'],
            'x':           slot['x'],
            'y':           slot['y'],
            'occupied':    existing.get('occupied',    False),
            'item_id':     existing.get('item_id',     None),
            'batch_id':    existing.get('batch_id',    None),
            'cart_status': existing.get('cart_status', 'not_allocated'),
            'weight':      existing.get('weight',      None),
            'demand':      existing.get('demand',      None),
        }

    with open(REGISTRY_PATH, 'w') as f:
        json.dump(new_registry, f, indent=2)
    print(f'Registry written: {len(new_registry["slots"])} slots')

def generate(out_path=None, reg_path=None):
    global REGISTRY_PATH
    if reg_path:
        REGISTRY_PATH = reg_path
    generate_svg()

if __name__ == '__main__':
    generate_svg()
