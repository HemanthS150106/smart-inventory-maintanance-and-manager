# Demand Forecasting Logic Summary

## Overview
The Demand Forecasting pipeline solves the problem of predicting future warehouse inventory needs by projecting out future expected sales over a set horizon. It utilizes historical event data such as past daily purchase quantities along with item demographics to produce robust day-by-day estimates.

## Input Data
The system ingests the primary multi-variate time series dataset (`sales_hist.csv` or similar aggregates) alongside calendar offsets.
- **Categorical Setup**: Item properties strings are globally hashed/encoded into integers.
- **Lag Features**: The model heavily relies on temporal aggregations like `lag_7` (demand from 7 days ago). Rows missing `lag_7` are strictly dropped.
- The ultimate dataset includes columns such as `sales`, `route`, `cat_id`, `dept_id`, and assorted temporal offsets.

## Model Selection
The core backend utilizes a **Model Router (Decision Engine)** architecture via Pandas logic:
- The system segments SKUs by calculating historical variation and categorizing each into one of several `route` strings: `"smooth"`, `"erratic"`, `"intermittent"`, `"lumpy"`, or `"dead"`.
- **"smooth"** & **"erratic"** SKUs are processed through a tandem LightGBM + XGBoost architecture (`lgbm_xgb_ensemble`).
- **"intermittent"** & **"lumpy"** SKUs bypass the massive ensemble entirely—they fall back on simple historical moving averages based on their sporadic nature.
- **"dead"** SKUs output `0.0`.

## Training Process
For the LightGBM pathway:
- The data is partitioned, reserving validation records explicitly filtered to `route.isin(["smooth", "erratic"])`.
- The LGBM runs via `lgb.train` with `dtrain_lgbm` and bounding evaluation metrics on `dval_lgbm`.

## Forecast Output
The final matrix writes to `forecast_output.csv` capturing fields like:
- `model`: Defines the exact prediction engine used (e.g., `"lgbm_xgb_ensemble"`).
- `lgbm_pred` and `xgb_pred`: The individual model predictions.
- `route`: The designated variability pipeline constraint.
- The pipeline physically merges final predictions by computing: `LGBM_WEIGHT * lgbm_pred + XGB_WEIGHT * xgb_pred` where `LGBM_WEIGHT` defaults to `0.60`.

## Connection to Slot Allocation
The calculated `predicted_demand` column directly feeds the Node.js backend UI as the primary driver for "High Risk Items," allowing managers to track shortages in real-time if `shortage > 50%` of forecast. Further down, `slot_allocator.py` queries this demand intensity metric (`High`/`Medium`/`Low`) to designate warehouse Zones.

## Limitations
- **Memory Consumption**: Rolling stats and LightGBM bounds are dropped for `intermittent` or `lumpy` SKUs to aggressively restrict RAM usage.
- **No Temporal Cross-Validation**: Validation sets are hard cutoffs rather than continuous sliding horizons.
