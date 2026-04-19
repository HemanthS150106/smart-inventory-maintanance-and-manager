import json

with open('demand_forecasting_local.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

for c in nb['cells']:
    if c['cell_type'] == 'code':
        new_source = []
        for l in c['source']:
            if any(x in l for x in ['sell_price', 'price_lag_1', 'price_change', 'price_rel', 'weekend_snap', 'snap_flag', 'event_flag']):
                continue
            new_source.append(l)
        c['source'] = new_source

with open('demand_forecasting_local.ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

print("Features stripped successfully")
