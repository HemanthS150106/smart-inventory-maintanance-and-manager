# Smart Inventory App: Routing Optimization Module

This document serves as a knowledge base for future AI agents working on the `route_planner.js` module or related warehouse graph logic.

## 1. Core Architecture

The Routing Optimization Module is responsible for sequencing picker tasks and generating physical step-by-step coordinates to guide workers through the warehouse aisles.

### Components
1. **Warehouse Graph (`GLOBAL_GRAPH`)**: A static graph of walkable nodes and edges.
2. **Access Node Mapper**: Maps physical shelf coordinates (`slots.json`) to the nearest valid walkable node.
3. **A* Pathfinding**: Finds the shortest grid-aligned path between two nodes in the `GLOBAL_GRAPH`.
4. **2-Opt TSP Solver**: Takes a set of required pickup nodes and optimally sequences them to minimize total travel distance.

---

## 2. Warehouse Layout & Graph Structure

The warehouse is 3200x2500 units and consists of four main zones (A, B, C, D) divided by major aisles.

### Aisles & Walking Rules
- **Main Horizontal Aisle** (`y=1030`): Connects the left and right sides of the warehouse, and connects to the entrance/dispatch gates.
- **Center Vertical Aisle** (`x=1600`): Connects the top and bottom zones.
- **Left/Right Vertical Aisles** (`x=40`, `x=3160`): Run along the outer walls.
- **Walking Aisles**: Horizontal dead-ends (width=48) between shelf racks (height=160).
  - Zone A & B: Centers at `y=364, 780`
  - Zone C & D: Centers at `y=1284, 1700`

### Graph Connectivity
- **Zones A & C (Left side)**: Connect their left ends to the Left Vertical Aisle, and their right ends to the Center Vertical Aisle.
- **Zones B & D (Right side)**: Connect their left ends to the Center Vertical Aisle, and their right ends to the Right Vertical Aisle.
- **Gates**: The `ENTRANCE` (left, x=120) and `DISPATCH` (right, x=3080) gates only connect to the main horizontal aisle.

> [!WARNING]
> Do NOT create illegal diagonal shortcut edges. In the past, walking aisles were connected diagonally directly to the Main Aisle, which caused A* to route workers directly through physical shelves.

---

## 3. Path Splitting & Rendering Bug

### Symptoms
The frontend SVG would draw a route that looked like a massive diagonal laser beam cutting through shelves or connecting the Entrance directly to Dispatch.

### Root Causes
1. **Misaligned Graph Coordinates**: The Y-coordinates for the walking aisles in the backend graph did not match the physical SVG generation (`svg_generator.py`). Nodes were placed in wrong zones, causing visual misalignment.
2. **Missing Intersections**: The Main Aisle and Center Aisle lacked a connecting node (`CENTER_1000` to `MAIN_1600`). This caused A* to fail cross-warehouse routing.
3. **React Continuous Path Issue**: In `WorkerDashboard.jsx`, the UI combined the `aisle_path` arrays of multiple uncompleted tasks into a single polyline without a break, causing a straight diagonal line to be drawn from the end gate of Task 1 to the start gate of Task 2.

### Fixes Applied
1. **Mathematical Alignment**: Synced `route_planner.js` constants with `svg_generator.py` (`RACK_H=160`, `WALKING_AISLE=48`).
2. **Graph Perfection**: Rebuilt `buildAisleGraph()` to construct perfectly orthogonal lines using Left, Right, Center, and Main aisles. Workers can now loop straight through a shelf row.
3. **UI Isolation**: Updated `WorkerDashboard.jsx` to only draw the currently active uncompleted task (`activeTask`).

---

## 4. Next Steps for Agents

If modifying the graph layout:
- Always trace the A* graph output carefully. The frontend React component simply draws whatever point array `route_planner.js` spits out. If the line is diagonal, the `GLOBAL_GRAPH` has a diagonal edge.
- If the routing fails, A* will return `[]`, causing the UI to draw a straight line from the previous location. Ensure all aisles are fully connected at intersections.
