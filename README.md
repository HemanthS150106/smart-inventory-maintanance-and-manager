# Smart Warehouse Demand Forecasting System

This project implements a **demand forecasting and inventory recommendation system** for a warehouse using the **M5 retail dataset**.
The system predicts product demand and generates **recommended order quantities** that a warehouse manager can use for replenishment planning.

---

# Installation

Run the following command **only once** after cloning the repository:

```
pip install -r requirements.txt
```

This installs all required dependencies.

---

# Running the System

After installation, the system runs in **three steps**.

## 1. Train the Forecasting Model

```
python models/train_model.py
```

This trains the **LightGBM demand forecasting model** using the historical sales dataset.

---

## 2. Generate Demand Forecast

```
python models/forecast.py
```

This step:

* Predicts product demand
* Generates order recommendations
* Produces forecast files used by the UI

---

## 3. Launch the Warehouse Manager UI

```
streamlit run models/app.py
```

The UI displays:

* Products that require restocking
* Predicted demand
* Current stock
* Recommended order quantity

This interface is designed for **warehouse managers to quickly view replenishment decisions**.

---

# Project Structure

```
data/
    Retail dataset files

models/
    train_model.py
    forecast.py
    app.py
    demand_model.pkl

requirements.txt
README.md
```

---

# Forecasting Approach

The system uses a **Global Demand Forecasting Model (LightGBM)** with lag-based features to predict weekly product demand.
Forecasts are combined with a simple **inventory replenishment policy** to generate recommended order quantities.

---

# Output

The system generates:

* Demand predictions
* Inventory reorder recommendations
* Warehouse decision interface
