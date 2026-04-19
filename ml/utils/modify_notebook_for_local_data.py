import json

with open('demand_forecasting (1).ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

for cell in nb['cells']:
    if cell['cell_type'] == 'code':
        source = ''.join(cell['source'])
        
        # 1. Modify Load Sales (skip melt, custom CSV reading)
        if 'sales = pd.read_csv(SALES_PATH, dtype=sales_dtypes)' in source:
            new_source = '''print("Loading sales data...")
sales = pd.read_csv("../../../../data/raw/sales_history.csv")
sales = sales.rename(columns={"sku_id": "id", "units_sold": "sales"})

# Convert date to datetime
sales['date'] = pd.to_datetime(sales['date'])

# Extract Categoricals from sku_id (e.g. HOBBIES_1_085_CA_1_validation)
sales['cat_id'] = sales['id'].str.split('_').str[0]
sales['dept_id'] = sales['id'].str.split('_').str[0] + "_" + sales['id'].str.split('_').str[1]
sales['item_id'] = sales['id'].str.split('_').str[0:3].str.join('_')
sales['state_id'] = sales['store_id'].str.split('_').str[0]

# Extract basic time features directly
sales['day_of_week'] = sales['date'].dt.dayofweek.astype(np.int8)
sales["day_of_month"] = sales["date"].dt.day.astype(np.int8)
sales["week_of_year"] = sales["date"].dt.isocalendar().week.astype(np.int8)
sales["month"] = sales["date"].dt.month.astype(np.int8)
sales["quarter"] = sales["date"].dt.quarter.astype(np.int8)
sales["is_weekend"] = (sales["day_of_week"] >= 5).astype(np.int8)
sales["is_month_end"] = sales["date"].dt.is_month_end.astype(np.int8)

# Convert strings to category types to save memory
cat_cols = ['id', 'item_id', 'dept_id', 'cat_id', 'store_id', 'state_id']
for c in cat_cols:
    sales[c] = sales[c].astype('category')

sales["sales"] = sales["sales"].astype(np.float32)

mem_report(sales, "sales long")
df = sales.copy()
gc.collect()
'''
            cell['source'] = [line + '\n' for line in new_source.split('\n')]
            
        # 2. Skip loading Calendar & Prices entirely
        if 'cal = pd.read_csv(CALENDAR_PATH, parse_dates=["date"])' in source:
            cell['source'] = ['print("Skipped loading calendar & prices")\n']
            
        # 3. Skip Merging Calendar/Prices and adjust Preprocessing (stockout)
        if 'df = sales.merge(cal, on="d", how="left")' in source:
            new_source = '''print("Formatting DataFrame...")
df = df.sort_values(["id", "date"]).reset_index(drop=True)

print("Applying Advanced Preprocessing...")
# ----- EXTRA PREPROCESSING ADDED -----
# 1. Stockout Imputation: Replace artificial zeros during stockouts with NaNs, then forward fill.
def flag_stockouts(grp):
    mask = (grp["sales"] == 0)
    run_len = mask.groupby((mask != mask.shift()).cumsum()).transform("sum")
    grp["stockout_flag"] = ((run_len > 7) & mask).astype(np.int8)
    return grp

df = df.groupby("id", observed=True, group_keys=False).apply(flag_stockouts)
df.loc[df['stockout_flag'] == 1, 'sales'] = np.nan
df['sales'] = df.groupby('id', observed=True)['sales'].ffill().bfill().fillna(0)

# 2. Outlier Treatment: Cap extreme sales spikes at the 99th percentile for each SKU.
def clip_outliers(grp):
    q99 = grp['sales'].quantile(0.99)
    if q99 > 0:
        grp['sales'] = grp['sales'].clip(upper=q99)
    return grp

df = df.groupby('id', observed=True, group_keys=False).apply(clip_outliers)
# --------------------------------------

# Trim leading zeros (before first actual sale)
first_sale = (
    df[df["sales"] > 0]
    .groupby("id", observed=True)["date"]
    .min()
    .rename("first_sale")
)
df = df.merge(first_sale, on="id", how="left")
df = df[df["date"] >= df["first_sale"]].drop(columns=["first_sale"])

mem_report(df, "merged")
gc.collect()'''
            cell['source'] = [line + '\n' for line in new_source.split('\n')]

        # 4. Remove Missing Calendar/Prices from Feature Engineering
        if 'df["weekend_snap"] = (df_l["is_weekend"] * df_l["snap_flag"]).astype(np.int8)' in source:
            new_source = '''print("Engineering basic features...")
lgbm_mask = df["route"].isin(["smooth", "erratic"])
df_l = df[lgbm_mask].copy()

for lag in [7, 14, 21, 28]:
    df_l[f"lag_{lag}"] = (
        df_l.groupby("id", observed=True)["sales"]
            .shift(lag).astype(np.float32)
    )

for w in [7, 14, 28, 56]:
    df_l[f"roll_mean_{w}"] = (
        df_l.groupby("id", observed=True)["sales"]
            .transform(lambda x: x.shift(1).rolling(w, min_periods=1).mean())
            .astype(np.float32)
    )
    df_l[f"roll_std_{w}"] = (
        df_l.groupby("id", observed=True)["sales"]
            .transform(lambda x: x.shift(1).rolling(w, min_periods=1).std())
            .fillna(0).astype(np.float32)
    )

feat_new = [c for c in df_l.columns if c not in df.columns]
df = df.merge(df_l[["id", "date"] + feat_new], on=["id", "date"], how="left")
del df_l
gc.collect()

val_start = df["date"].max() - pd.Timedelta(days=VAL_WINDOW - 1)
train = df[df["date"] < val_start].copy()
val   = df[df["date"] >= val_start].copy()
print(f"Train: {train.shape}  |  Val: {val.shape}")

FEATURE_COLS = [
    "day_of_week", "day_of_month", "week_of_year", "month", "quarter",
    "is_weekend", "is_month_end",
    "lag_7", "lag_14", "lag_21", "lag_28",
    "roll_mean_7", "roll_mean_14", "roll_mean_28", "roll_mean_56",
    "roll_std_7", "roll_std_14", "roll_std_28", "roll_std_56",
    "item_code", "dept_code", "store_code",
]'''
            cell['source'] = [line + '\n' for line in new_source.split('\n')]
            
        # 5. Fix Inference Loop kwargs for xgb / lgbm removing price and snap
        if '"snap_flag":     snap,' in source:
            source = source.replace('"snap_flag":     snap,', '')
            source = source.replace('"event_flag":    evt,', '')
            source = source.replace('"sell_price":    price,', '')
            source = source.replace('"price_change":  0.0,', '')
            source = source.replace('"price_rel":     1.0,', '')
            source = source.replace('"weekend_snap":  int(fdate.dayofweek >= 5) * snap,', '')
            source = source.replace('snap  = int(grp["snap_flag"].iloc[-1])', '')
            source = source.replace('evt   = int(grp["event_flag"].iloc[-1])', '')
            source = source.replace('price = float(grp["sell_price"].iloc[-1])', '')
            cell['source'] = [line + '\n' for line in source.split('\n')]
            
with open('demand_forecasting_local.ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

print('Notebook mapped to local dataset constraints successfully.')
