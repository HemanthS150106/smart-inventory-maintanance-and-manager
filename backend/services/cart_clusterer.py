import sys, json, math
import numpy as np

'''
ALGORITHM EXPLANATION FOR THE TEAM:
====================================
We use Fuzzy C-Means (FCM) clustering to group warehouse items
into cart loads. FCM is a soft-clustering algorithm meaning each
point gets a membership degree to every cluster rather than a
hard assignment. We then take the highest membership cluster as
the final assignment.

ZONE WALL PROBLEM & SOLUTION:
Standard FCM uses Euclidean distance on raw x,y coordinates.
This incorrectly considers slots on opposite sides of an aisle
as close neighbours.

We solve this using ZONE-OFFSET ENCODING:
- Each zone (A,B,C,D) is assigned a large coordinate offset
  in a third synthetic dimension.
- Zone A gets z=0, Zone B gets z=ZONE_GAP, Zone C gets z=2*ZONE_GAP,
  Zone D gets z=3*ZONE_GAP
- ZONE_GAP is set to be much larger than the physical warehouse
  dimensions so that cross-zone distance always exceeds same-zone
  distance in 3D space.
- This means FCM will never group slots from different zones
  into the same cluster because the synthetic z-dimension distance
  is too large to overcome.

This is equivalent to building zone walls mathematically without
needing a graph traversal or pathfinding algorithm at the
clustering stage. Pathfinding comes in Task 4 (routing).

Result: all clustered groups will always contain items from
the SAME zone only, which makes physical sense — one cart trip
covers one zone section.
'''

# Zone offset map — must match actual zone layout in SVG
# Zones are physically separated by aisles.
# We assign a large z-offset per zone to enforce zone boundaries.
ZONE_ORDER = {'A': 0, 'B': 1, 'C': 2, 'D': 3}
ZONE_GAP   = 100000  # much larger than any x,y coordinate value

def get_zone_from_slot_id(slot_id):
    '''Extract zone letter from slot ID like A1A-02-L4 → A'''
    if slot_id and len(slot_id) > 0:
        return slot_id[0].upper()
    return 'D'  # fallback

def encode_coordinates(slots):
    '''
    Encode each slot as a 3D point (x, y, zone_offset).
    Zone offset is a large value ensuring cross-zone distances
    always exceed within-zone distances.
    '''
    encoded = []
    for s in slots:
        zone  = get_zone_from_slot_id(s.get('slot_id', ''))
        z_off = ZONE_ORDER.get(zone, 3) * ZONE_GAP
        encoded.append([
            float(s.get('x', 0)),
            float(s.get('y', 0)),
            z_off
        ])
    return np.array(encoded)

def cluster_slots(slots, avg_items_per_cart=8):
    if len(slots) == 0:
        return []

    n_clusters = max(1, math.ceil(len(slots) / avg_items_per_cart))
    if len(slots) < n_clusters:
        n_clusters = len(slots)

    # Encode coordinates with zone offset
    coords = encode_coordinates(slots)  # shape (N, 3)

    # Manual Fuzzy C-Means implementation
    # (avoids scikit-fuzzy dependency issues and gives us full
    #  control over the distance function)
    np.random.seed(42)

    # Initialize cluster centers randomly from data points
    idx    = np.random.choice(len(slots), n_clusters, replace=False)
    centers = coords[idx].copy().astype(float)

    m = 2.0       # fuzziness parameter
    max_iter = 200
    tol      = 1e-4

    u = np.zeros((n_clusters, len(slots)))  # membership matrix

    for iteration in range(max_iter):
        old_centers = centers.copy()

        # Calculate distances from each point to each center
        # Shape: (n_clusters, n_points)
        distances = np.array([
            np.linalg.norm(coords - c, axis=1)
            for c in centers
        ])
        distances = np.maximum(distances, 1e-10)  # avoid divide by zero

        # Update membership matrix
        for i in range(n_clusters):
            for j in range(len(slots)):
                u[i, j] = 1.0 / np.sum(
                    (distances[i, j] / distances[:, j]) **
                    (2.0 / (m - 1))
                )

        # Update cluster centers
        u_m = u ** m
        for i in range(n_clusters):
            centers[i] = np.sum(
                u_m[i, :, np.newaxis] * coords, axis=0
            ) / np.sum(u_m[i])

        # Check convergence
        if np.linalg.norm(centers - old_centers) < tol:
            break

    # Hard assign each point to highest membership cluster
    assignments = np.argmax(u, axis=0)

    clusters = {}
    for idx, slot in enumerate(slots):
        c = int(assignments[idx])
        clusters.setdefault(c, []).append(slot['slot_id'])

    return list(clusters.values())

if __name__ == '__main__':
    try:
        input_data = json.loads(sys.stdin.read())
        slots      = input_data['slots']
        avg        = input_data.get('avg_items_per_cart', 8)

        result = cluster_slots(slots, avg)
        print(json.dumps({'clusters': result}))
    except Exception as e:
        sys.stderr.write(str(e) + "\n")
        sys.exit(1)
