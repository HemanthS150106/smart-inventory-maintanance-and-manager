# Smart Inventory Management System

The Smart Inventory Management System is an end-to-end full-stack application designed to optimize warehouse operations through intelligent automation, space utilization analysis, slot routing, dynamic simulations, and demand forecasting.

## 🚀 Features

- **Demand Forecasting Pipeline**: Leveraging machine learning to predict optimal storage zones and future demand intensity. Includes robust data preprocessing steps (stockout imputation and outlier clipping) to reduce Weighted Average Percentage Error (WAPE).
- **Warehouse Slot Allocation**: High-fidelity, 5-level vertical rack structure mapping (L1-L5). A strict weight-based allocation algorithm ensures safe, optimal, and efficient inventory placement.
- **Dynamic Warehouse Blueprint**: Programmatic generation of pure SVG floor plans that represent a cumulative map of all occupied slots, demand intensity, uprights, and shelf boards.
- **Interactive React Dashboard**: A responsive Vite React application providing real-time data visualization of zone utilization, shelf-level breakdowns, and overall warehouse state.
- **Reliable State Management**: Complete synchronized control flows, such as a "Reset Warehouse" operation that cleanly clears arrival histories, resets counters, and aligns the backend data with UI visualizations.
- **Routing & Simulation**: Advanced path planning, cart allocation, and warehouse layout optimization for efficient picking and stock management.

## 📁 Project Structure

```
smart-inventory-app/
├── backend/    # Node.js backend and API logic
├── frontend/   # React/Vite dashboard and UI components
├── ml/         # Jupyter notebooks and demand forecasting models
├── data/       # Datasets and generated warehouse blueprints (SVGs)
└── docs/       # Architectural diagrams and technical documentation
```

## 🛠️ Tech Stack

- **Frontend**: React, Vite, HTML/Vanilla CSS, Tailwind CSS
- **Backend**: Node.js, Express
- **Machine Learning**: Python, Jupyter, Pandas, Scikit-Learn, LightGBM
- **Documentation & Visualization**: SVG / Markdown

