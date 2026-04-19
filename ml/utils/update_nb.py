import json
import re

with open('demand_forecasting (1).ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

for cell in nb['cells']:
    if cell['cell_type'] == 'code':
        source = ''.join(cell['source'])
        
        # Modify Paths
        if '/kaggle/input/datasets' in source:
            source = source.replace('/kaggle/input/datasets/pes2ug23cs065/hybrid-demand-forecasting/sales_train_validation.csv', '../../../../data/raw/sales_history.csv')
            source = source.replace('/kaggle/input/datasets/pes2ug23cs065/hybrid-demand-forecasting/calendar.csv', '../../../../data/raw/calendar.csv')
            source = source.replace('/kaggle/input/datasets/pes2ug23cs065/hybrid-demand-forecasting/sell_prices.csv', 'data/sell_prices.csv')
            source = source.replace('/kaggle/working', '.')
            
            # Split back to lines to keep notebook format
            lines = [line + '\n' for line in source.split('\n')]
            if lines: lines[-1] = lines[-1].strip('\n')
            cell['source'] = lines

        # Modify Preprocessing
        if 'def flag_stockouts(grp):' in source and 'stockout_flag' in source and 'np.nan' not in source:
            target_str = 'df = df.groupby("id", observed=True, group_keys=False).apply(flag_stockouts)\n'
            impute_code = """
# ----- EXTRA PREPROCESSING ADDED -----
# 1. Stockout Imputation: Replace artificial zeros during stockouts with NaNs, then forward fill.
# This prevents the model from learning a downward bias during stockout periods, capturing true unconstrained demand.
df.loc[df['stockout_flag'] == 1, 'sales'] = np.nan
df['sales'] = df.groupby('id', observed=True)['sales'].ffill().bfill().fillna(0)

# 2. Outlier Treatment: Cap extreme sales spikes at the 99th percentile for each SKU.
# This stabilizes the mean and variance, making lag/rolling features much more robust.
def clip_outliers(grp):
    q99 = grp['sales'].quantile(0.99)
    if q99 > 0:
        grp['sales'] = grp['sales'].clip(upper=q99)
    return grp
df = df.groupby('id', observed=True, group_keys=False).apply(clip_outliers)
# --------------------------------------
"""
            if target_str in source:
                source = source.replace(target_str, target_str + '\n' + impute_code)
                lines = [line + ('\n' if i < len(source.split('\n')) - 1 else '') for i, line in enumerate(source.split('\n'))]
                cell['source'] = lines

with open('demand_forecasting (1).ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

print('Notebook updated successfully.')
