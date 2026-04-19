# Machine Learning Models & Notebooks

This directory houses all ML-related materials for the Smart Inventory App.

## Directory Structure
- **notebooks/**: Contains Jupyter notebooks used to train and modify demand forecasting.
  - `demand_forecasting (1).ipynb` & `demand_forecasting_local.ipynb`: Notebooks for preparing historical data, forecasting 28-day demand metrics, and evaluating stock requirements using tree-based methods like LightGBM.
- **models/**: Expected to store compiled model artifacts (`.pkl`, `.joblib`).
- **utils/**: Contains standalone Python scripts used in the ML pipelines and batch simulation updates. Note: some scripts were originally standalone Jupyter preparation scripts.

## Data Integration
The ML scripts use dataset CSVs housed in `../data/raw/` (for structural inputs like calendar and sales histories) and write predictions to `../data/processed/` where the backend/frontend can fetch them.
