import pandas as pd
import lightgbm as lgb
import pickle

print("Loading dataset...")

sales = pd.read_csv("data/sales_train_validation.csv")

# use subset for training speed
sales = sales.iloc[:2000]

day_cols = [c for c in sales.columns if c.startswith("d_")]

print("Reshaping dataset...")

sales_long = sales.melt(
    id_vars=["id","item_id","dept_id","cat_id","store_id","state_id"],
    value_vars=day_cols,
    var_name="day",
    value_name="sales"
)

sales_long["day_num"] = sales_long["day"].str.replace("d_","").astype(int)

print("Creating features...")

sales_long["lag_7"] = sales_long.groupby("id")["sales"].shift(7)
sales_long["lag_14"] = sales_long.groupby("id")["sales"].shift(14)

sales_long["rolling_mean_7"] = (
    sales_long.groupby("id")["sales"]
    .shift(1)
    .rolling(7)
    .mean()
)

sales_long = sales_long.dropna()

X = sales_long[[
    "day_num",
    "lag_7",
    "lag_14",
    "rolling_mean_7"
]]

y = sales_long["sales"]

print("Training LightGBM model...")

model = lgb.LGBMRegressor(
    n_estimators=300,
    learning_rate=0.05
)

model.fit(X,y)

pickle.dump(model, open("models/demand_model.pkl","wb"))

print("Model saved.")