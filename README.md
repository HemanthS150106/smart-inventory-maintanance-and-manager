# 🏭 Smart Warehouse Inventory Management System

> AI-driven demand forecasting, dynamic slot allocation, cart grouping, and hybrid route optimization for warehouse picking — built on the M5 Forecasting dataset.

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Folder Structure](#folder-structure)
- [Part 1 — Google Colab Pipeline](#part-1--google-colab-pipeline)
- [Part 2 — Streamlit UI (VS Code / Local)](#part-2--streamlit-ui-vs-code--local)
- [Output Files Explained](#output-files-explained)
- [Troubleshooting](#troubleshooting)
- [Research Paper Results](#research-paper-results)

---

## Project Overview

This system simulates a full intelligent warehouse pipeline:

```
M5 Dataset (Walmart sales)
        ↓
Data Preprocessing + Feature Engineering
        ↓
Model Router → ARIMA / XGBoost / LSTM-TFT / LightGBM
        ↓
Demand Forecasting (28-day predictions)
        ↓
Inventory Decision Engine (RESTOCK / URGENT / MONITOR)
        ↓
Slot Allocation (velocity-based ABC zoning)
        ↓
Cart Allocation (Fuzzy C Clustering)
        ↓
Route Optimization (IACO + A* + DWA)
        ↓
Streamlit Dashboard UI
```

---

## Architecture

| Layer | Component | Algorithm |
|-------|-----------|-----------|
| L0–L2 | Data + Features | Lag/rolling features, Indian festival calendar |
| L3 | Model Router + Forecast | ARIMA, XGBoost, LSTM/TFT, LightGBM |
| L4 | Inventory Engine | Threshold-based restock decisions |
| L5 | Slot Allocation | Velocity ABC zoning (HOT/WARM/COLD) |
| L6 | Cart Allocation | Fuzzy C Means Clustering |
| L7 | Route Optimization | IACO + A* + DWA hybrid |
| L8 | UI Dashboard | Streamlit + Plotly |

---

## Folder Structure

```
smart-warehouse/
│
├── 📓 COLAB NOTEBOOK
│     final_model.ipynb     ← Run this in Google Colab
│
├── 🖥️  STREAMLIT UI
│     app.py                          ← Run this locally in VS Code
│     requirements.txt                ← Python dependencies
│
├── 📁 data/                          ← Put your 5 output CSVs here
│     predictions_top20.csv
│     predictions_full_with_decisions.csv
│     slot_assignments.csv
│     cart_assignments.csv
│     optimized_routes.csv
│
└── 📄 README.md                      ← This file
```

---

## Part 1 — Google Colab Pipeline

### What you need before starting

1. A Google account with Google Drive
2. The M5 Forecasting dataset (3 files):
   - `sales_train_validation.csv`
   - `calendar.csv`
   - `sell_prices.csv`

   Download from: https://www.kaggle.com/competitions/m5-forecasting-accuracy/data

### Step 1 — Upload dataset to Google Drive

Create this exact folder structure in your Google Drive:

```
My Drive/
└── smart_warehouse/
    ├── data/
    │     sales_train_validation.csv   ← upload here
    │     calendar.csv                 ← upload here
    │     sell_prices.csv              ← upload here
    └── outputs/                       ← will be created automatically
```

### Step 2 — Open the notebook in Google Colab

1. Go to https://colab.research.google.com
2. Click **File → Upload notebook**
3. Upload `final_model.ipynb`
4. Make sure runtime is set to: **Runtime → Change runtime type → Python 3**

> ⚠️ Do NOT enable GPU — the pipeline runs on CPU and GPU is not needed.

### Step 4 — Download your output files

After all cells complete, go to Google Drive:

```
My Drive → smart_warehouse → outputs/
```

Download these **5 files** — you need them for the UI:

```
✅ predictions_top20.csv
✅ predictions_full_with_decisions.csv
✅ slot_assignments.csv
✅ cart_assignments.csv
✅ optimized_routes.csv
```

---
## Part 2 — Streamlit UI (VS Code / Local)

### Prerequisites

- Python 3.8 or higher installed
- VS Code installed
- The 5 CSV output files from Colab (see above)

### Step 1 — Check Python version

Open VS Code terminal (`Ctrl + ~`) and run:

```bash
python --version
```

You should see `Python 3.8.x` or higher. If not, download Python from https://python.org

### Step 2 — Create your project folder

Create a folder on your computer called `smart_warehouse_ui` and set it up like this:

```
smart_warehouse_ui/
├── app.py
├── requirements.txt
└── data/
    ├── predictions_top20.csv
    ├── predictions_full_with_decisions.csv
    ├── slot_assignments.csv
    ├── cart_assignments.csv
    └── optimized_routes.csv
```

> ⚠️ The `data/` folder name must be exactly `data` — the app looks for files there.

### Step 3 — Open the folder in VS Code

```
File → Open Folder → select smart_warehouse_ui
```

### Step 4 — Open the terminal in VS Code

```
Terminal → New Terminal    (or press Ctrl + `)
```

You should see something like:
```
PS D:\smart_warehouse_ui>
```

### Step 5 — Install dependencies

Run this command:

```bash
pip install -r requirements.txt
```

If that gives an error, try:

```bash
python -m pip install -r requirements.txt
```

Wait for all 4 packages to install:
- streamlit
- pandas
- numpy
- plotly

### Step 6 — Run the app

```bash
streamlit run app.py
```

If that gives an error, try:

```bash
python -m streamlit run app.py
```

### Step 7 — Open in browser

After running, you will see:

```
  You can now view your Streamlit app in your browser.
  Local URL: http://localhost:8501
```

Open your browser and go to: **http://localhost:8501**

### Step 8 — Navigate the dashboard

The app has 5 pages in the left sidebar:

| Page | What you see |
|------|-------------|
| 📊 Overview | Full pipeline summary, model router breakdown, KPI cards |
| 📈 Demand Forecast | Top 20 bar chart, model comparison table for paper |
| 🏭 Inventory Decisions | Filterable restock decisions, demand distributions |
| 📍 Slot Map | Interactive warehouse heatmap, slot detail lookup |
| 🛒 Cart & Routes | Cart selector, route visualization on warehouse grid |

### Step 9 — Stop the app

Press `Ctrl + C` in the terminal to stop the server.

---

## Output Files Explained

| File | Description | Used in |
|------|-------------|---------|
| `predictions_top20.csv` | Top 20 highest-demand SKUs with weekly forecast | Demand Forecast page |
| `predictions_full_with_decisions.csv` | All 3,049 SKUs with RESTOCK/URGENT/MONITOR decision | Inventory Decisions page |
| `slot_assignments.csv` | Every SKU mapped to a warehouse slot (A1–L10) | Slot Map page |
| `cart_assignments.csv` | Every SKU grouped into a picking cart (CART_001–134) | Cart & Routes page |
| `optimized_routes.csv` | Optimized picking route per cart with improvement % | Cart & Routes page |

### Column reference

**predictions_full_with_decisions.csv**
```
id                          → SKU identifier
item_id                     → product code
dept_id / cat_id            → department / category
predicted_weekly_demand     → forecast for next 7 days
actual_weekly_demand        → true sales (validation)
model_used                  → which model made this prediction
velocity                    → A/B/C/D (fast to slow)
decision                    → URGENT_RESTOCK / RESTOCK / MONITOR
reorder_quantity            → units to order
priority_score              → slot allocation priority
```

**slot_assignments.csv**
```
id / item_id                → SKU identifier
slot_id                     → warehouse slot (e.g. A1, B5, J10)
row / col                   → grid coordinates
zone                        → HOT / WARM / COLD
distance_score              → 1 (entrance) to 12 (farthest)
velocity                    → A/B/C/D
```

**cart_assignments.csv**
```
id / item_id                → SKU identifier
cart_label                  → CART_001 to CART_134
cart_id                     → numeric cart index
membership_score            → fuzzy membership (0–1, higher = more certain)
zone                        → HOT / WARM / COLD
```

**optimized_routes.csv**
```
cart_label                  → CART_001 to CART_134
items_in_cart               → number of items
unique_slots                → number of distinct slots visited
iaco_distance               → optimized route length
naive_distance              → unoptimized route length
improvement_pct             → % improvement over naive
route                       → ENTRANCE → A1 → B3 → ... → ENTRANCE
```

---

## Troubleshooting

### Colab issues

| Problem | Fix |
|---------|-----|
| `FileNotFoundError` | Check DATA_PATH in Cell 3 matches your Drive folder |
| Kernel crashes | You are using the full 30K SKU dataset — the code filters to CA_1 automatically |
| `ModuleNotFoundError` | Re-run Cell 1 to reinstall libraries |
| Drive not mounting | Click the link that appears and authorize access |

### Streamlit issues

| Problem | Fix |
|---------|-----|
| `streamlit not recognized` | Run `python -m streamlit run app.py` instead |
| `pip not found` | Run `python -m pip install -r requirements.txt` |
| `FileNotFoundError: data/...` | Make sure your 5 CSV files are inside a `data/` folder |
| App opens but shows error | Check that all 5 CSV files are present and not empty |
| Port 8501 already in use | Run `streamlit run app.py --server.port 8502` |
| Python version error | Upgrade to Python 3.8+ from https://python.org |

### Windows-specific

```bash
# If python command not found, try:
py --version
py -m pip install -r requirements.txt
py -m streamlit run app.py
```

---

## Research Paper Results

### Table 1 — Forecasting Model Comparison

| Model | SKUs | MAE | RMSE | MAPE |
|-------|------|-----|------|------|
| LightGBM baseline | 3,049 | 1.0427 | 2.0254 | 50.08% |
| XGBoost (CV > 1.2) | 841 | 1.9625 | 3.3574 | 71.62% |
| ARIMA (zero ratio > 40%) | 100 | 0.8485 | 1.1275 | 50.07% |
| LSTM/TFT (strong trend) | 9 | 1.9636 | 2.3960 | 28.48% |
| **Adaptive Router (ours)** | **3,049** | **1.0464** | **2.0324** | **50.69%** |

### Table 2 — Warehouse Operations

| Component | Metric | Value |
|-----------|--------|-------|
| Slot Allocation | SKUs allocated | 3,049 |
| Slot Allocation | Overflow | 0 (100% allocated) |
| Slot Allocation | HOT zone utilisation | 100% |
| Slot Allocation | Avg distance A-velocity | 1.00 |
| Slot Allocation | Avg distance D-velocity | 10.56 |
| Cart Allocation | Zone purity (FCM) | 100% |
| Cart Allocation | Strong membership (>0.7) | 89.4% |
| Cart Allocation | Total carts | 134 |
| Route Optimization | Algorithm | IACO + A* + DWA |
| Route Optimization | Avg improvement | 10.0% |
| Route Optimization | Best improvement | 50.0% |



## Tech Stack

```
Google Colab     → Pipeline execution environment
Python 3.10      → Core language
pandas / numpy   → Data processing
LightGBM         → Gradient boosting baseline
XGBoost          → High-CV demand forecasting
statsmodels      → ARIMA intermittent forecasting
PyTorch          → LSTM temporal deep learning
scikit-learn     → Fuzzy C Means, StandardScaler
Streamlit        → Web dashboard
Plotly           → Interactive charts
```

---

## Dataset

**M5 Forecasting — Accuracy** (Kaggle)
- 30,490 SKUs across 10 Walmart stores
- 3 categories: FOODS, HOUSEHOLD, HOBBIES
- 1,913 days of sales history (Jan 2011 – Jun 2016)
- This project uses CA_1 store (3,049 SKUs) as representative subset

Download: https://www.kaggle.com/competitions/m5-forecasting-accuracy/data

---

*Smart Warehouse Inventory Management System — Capstone Project*
