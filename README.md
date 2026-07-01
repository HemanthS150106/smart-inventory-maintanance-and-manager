# Smart Inventory Management & Warehousing System

An advanced full-stack warehouse optimization and predictive inventory management platform. This system leverages machine learning for demand forecasting, handles dynamic slot allocation based on physical constraints (weight and size), clusters picklists using Fuzzy C-Means with zone-offset encoding, and plans optimal picking routes using Dijkstra's algorithm.

---

## 🚀 Features & Intelligent Engines

### 1. Demand Forecasting Pipeline
* **Model Routing (Decision Engine)**: Analyzes SKU demand profiles via Average Demand Interval (ADI) and Coefficient of Variation ($CV^2$) to classify items into *Smooth, Erratic, Intermittent, Lumpy,* or *Dead* categories.
* **Tweedie Loss Ensemble**: Targets zero-inflated daily retail sales by ensembling **LightGBM (60% weight)** and **XGBoost (40% weight)** models optimized with a Tweedie regression loss.
* **Autoregressive Recursive Forecaster**: Dynamically rolls prediction windows 28 days forward, calculating lag and rolling average features step-by-step.
* **Censored Demand Detection**: Features a stockout detection algorithm to identify periods of supply exhaustion rather than zero demand.

### 2. Physical Slot Allocation System
* **Safety Rack Hierarchy (L1 - L5)**: Automatically assigns incoming inventory to shelf tiers based on weight (heavier items strictly on bottom L1/L2 levels; lighter items on top L5 levels).
* **Demand-Based Zoning**: Segregates the warehouse into four horizontal zones (A, B, C, D) based on size, weight, and predicted demand velocity.
* **Capacity Overflow Routing**: Scans fallback zones in sequence if a preferred zone/rack is full.

### 3. Spatial Cart Clustering
* **Zone-Offset Fuzzy C-Means (FCM)**: Groups pending items into picking carts using a soft-clustering approach.
* **Cross-Zone Wall Solution**: Implements a synthetic 3D dimension coordinate offset that prevents grouping items from different zones onto the same cart, aligning assignments with physical barriers.

### 4. Path-Aware picking Router
* **Dijkstra Pathfinding**: Computes pairwise distances between all slots, waypoints, and receiving/dispatch docks.
* **Nearest-Neighbor TSP Solver**: Orders slot pickups into a single sequence that minimizes total walking distance and penalizes crossing main cross aisles.

---

## 📁 Project Structure

```
smart-inventory-app/
├── backend/            # Express.js API gateway and orchestrator
│   ├── routes/         # Express routers (carts, tasks, workers, auth)
│   ├── services/       # Picking routers (JS) & ML integration spawners
│   ├── utils/          # JSON data store helpers
│   ├── .env.example    # Reference env file for backend
│   └── server.js       # Main server entrypoint
├── frontend/           # React/Vite dashboard & UI components
│   ├── svgs/           # Dynamic warehouse blueprint SVGs
│   ├── src/            # App pages (Forecasts, Slots, Carts, Tasks)
│   └── package.json
├── ml/                 # Python models and pipelines
│   ├── notebooks/      # Training Jupyter notebooks
│   └── utils/          # ML preprocessing, model definitions, & batch allocations
├── data/               # SQLite registries, local JSON state databases
├── docs/               # Architecture documents and technical reports
├── .gitignore          # Ignored logs, node_modules, and .env files
└── package.json        # Root script runner (dev concurrently)
```

---

## 🛠️ Tech Stack & Requirements

*   **Frontend**: React (Vite), Vanilla CSS (Flexbox/Grid), HSL colors, Interactive SVG maps.
*   **Backend**: Node.js, Express.js, JWT, bcryptjs.
*   **Machine Learning / Python**: Python 3.10+, LightGBM, XGBoost, Pandas, Numpy, Scipy, Scikit-Learn.
*   **Database**: Local JSON stores (for simulation simplicity) and SQLite.

---

## ⚙️ Installation & Setup

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (v18+) and [Python 3](https://www.python.org/) installed.

### 1. Install Dependencies
Run from the root directory to install the root runner packages, then install backend, frontend, and Python requirements:

```bash
# Root dependencies
npm install

# Backend dependencies
cd backend
npm install
cd ..

# Frontend dependencies
cd frontend
npm install
cd ..

# Python ML requirements
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Create a `.env` file in the `backend/` directory. You can copy the template from the root `.env.example`:

```bash
cp .env.example backend/.env
```

Open `backend/.env` and configure your settings:
```env
PORT=3001
JWT_SECRET=f3a76b928e1c4dfa052b61cd612fbca7629ef19c8d19e9b05c87cfd7e1898ba1
NODE_ENV=development
```

---

## 🏃 Running the Application

You can run both the frontend React app and backend Express server concurrently with a single command from the project root:

```bash
npm run dev
```

*   **Vite React Frontend**: Runs at [http://localhost:5173](http://localhost:5173)
*   **Express API Backend**: Runs at [http://localhost:3001](http://localhost:3001)

### Running Separately

*   **Backend only**:
    ```bash
    cd backend
    npm start
    ```
*   **Frontend only**:
    ```bash
    cd frontend
    npm run dev
    ```

---

## 🧪 Model Training & Simulation

To train the demand forecasting models or simulate arrivals:

1.  Open the Jupyter notebooks in `ml/notebooks/` to explore model training.
2.  Trigger manual batch allocations using:
    ```bash
    cd ml/utils
    python batch_simulator.py --allocate
    ```
3.  Reset the entire warehouse state via the UI or by sending a `POST` request to `/api/reset-warehouse`.
