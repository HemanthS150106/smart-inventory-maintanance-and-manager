import nbformat as nbf
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import json

def main():
    print("Executing Slot Allocation Logic and Updating Notebook...")
    
    # 1. We will generate the python code as strings to embed in the notebook.
    code_cell_1 = """# --- WAREHOUSE SLOT ALLOCATION SYSTEM ---
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import json

# Load sell_prices.csv
file_path = '../../../../data/raw/sell_prices.csv'
try:
    df_prices = pd.read_csv(file_path)
    print("Loaded sell_prices.csv")
except Exception as e:
    # fallback
    import os
    print("Could not load from dist/data: ", e)
    df_prices = pd.DataFrame()
    df_prices['item_id'] = [f'ITEM_{i}' for i in range(100)]
    np.random.seed(42)
    df_prices['item_size'] = np.random.choice(['S', 'M', 'L', 'XL'], size=100)

# Simulate predicted demand
np.random.seed(101)
df_uniq = df_prices.drop_duplicates(subset=['item_id']).copy()
df_uniq['predicted_demand'] = np.random.randint(5, 500, size=len(df_uniq))

# Encode item size
size_map = {'S': 0, 'M': 1, 'L': 2, 'XL': 3}
df_uniq['item_size_encoded'] = df_uniq['item_size'].map(size_map)

# Feature dataset
print("Data Preparation Complete.")
df_uniq.head()
"""
    
    code_cell_2 = """# Define rule for training data synthesis
def get_target_zone(demand, size):
    if demand >= 300 and size in ['S', 'M']: return 'A'
    if 100 <= demand < 300 and size in ['M', 'L']: return 'B'
    if size in ['L', 'XL'] and demand >= 150: return 'C'
    return 'D'

df_uniq['target_zone'] = df_uniq.apply(lambda row: get_target_zone(row['predicted_demand'], row['item_size']), axis=1)

# Train Classifier
X = df_uniq[['predicted_demand', 'item_size_encoded']]
y = df_uniq['target_zone']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

clf = RandomForestClassifier(n_estimators=50, random_state=42)
clf.fit(X_train, y_train)

preds = clf.predict(X_test)
acc = accuracy_score(y_test, preds)
print(f"Random Forest Allocation Model Accuracy: {acc * 100:.2f}%")
"""
    
    code_cell_3 = """# Batch arrival simulation
np.random.seed(202)
# Manager picks top demand items
top_items = df_uniq.sort_values(by='predicted_demand', ascending=False).head(100)

# Randomly sample 10-15 items arriving
n_arrival = np.random.randint(10, 16)
batch_arrival = top_items.sample(n=n_arrival)

print(f"--- BATCH ARRIVAL SIMULATION ({n_arrival} ITEMS) ---")

# Run through model
batch_X = batch_arrival[['predicted_demand', 'item_size_encoded']]
batch_arrival['allocated_zone'] = clf.predict(batch_X)

# Slot capacity tracking
zone_slots = {
    'A': [f"A-{i:02d}" for i in range(1, 21)],
    'B': [f"B-{i:02d}" for i in range(1, 21)],
    'C': [f"C-{i:02d}" for i in range(1, 16)],
    'D': [f"D-{i:02d}" for i in range(1, 16)]
}

# Demand level mapping
def demand_intensity(demand):
    if demand >= 300: return 'High'
    if demand >= 150: return 'Medium'
    return 'Low'

allocated_results = {}
output_table = []

for idx, row in batch_arrival.iterrows():
    item_id = row['item_id']
    size = row['item_size']
    demand = row['predicted_demand']
    zone = row['allocated_zone']
    
    # Assign slot
    if len(zone_slots[zone]) > 0:
        assigned_slot = zone_slots[zone].pop(0)
    else:
        # Overflow logic if full
        assigned_slot = zone_slots['D'].pop(0) if len(zone_slots['D']) > 0 else "N/A"
        
    res_dict = {
        'Item ID': item_id,
        'Size': size,
        'Predicted Demand': demand,
        'Allocated Zone': zone,
        'Slot ID': assigned_slot
    }
    output_table.append(res_dict)
    
    if assigned_slot != "N/A":
        allocated_results[assigned_slot] = {
            'item_id': item_id,
            'demand': demand_intensity(demand)
        }

# Print formatted table
df_output = pd.DataFrame(output_table)
print(df_output.to_string(index=False))

# Export for SVG generation
with open('batch_allocations.json', 'w') as f:
    json.json(allocated_results, f)
print("\\nExported allocated_results to batch_allocations.json")
"""
    # Wait, simple bug in code_cell_3 string above! json.dump not json.json. Let me fix it before it breaks.
    code_cell_3 = code_cell_3.replace("json.json(", "json.dump(")

    # Now execute this logic locally so we get the json right away
    exec_globals = {}
    from io import StringIO
    import sys
    old_stdout = sys.stdout
    sys.stdout = StringIO()
    try:
        exec(code_cell_1 + "\n" + code_cell_2 + "\n" + code_cell_3, exec_globals)
        output = sys.stdout.getvalue()
        print("Successfully executed allocation logic natively.")
    except Exception as e:
        print(f"Error executing allocation logic: {e}")
        output = sys.stdout.getvalue()
    sys.stdout = old_stdout
    print("Captured Output: ")
    print(output)
    
    # Finally, append to the notebook
    nb_path = r'C:\\Users\\heman\\Downloads\\capstone\\demand_forecasting_local.ipynb'
    try:
        nb = nbf.read(nb_path, as_version=4)
        
        # Add markdown cell
        markdown_header = nbf.v4.new_markdown_cell("## Step 3 & 4: Warehouse Slot Allocation Model")
        nb.cells.append(markdown_header)
        
        # Add code cells
        c1 = nbf.v4.new_code_cell(code_cell_1)
        c2 = nbf.v4.new_code_cell(code_cell_2)
        c3 = nbf.v4.new_code_cell(code_cell_3)
        nb.cells.extend([c1, c2, c3])
        
        nbf.write(nb, nb_path)
        print(f"Successfully appended code blocks to {nb_path}")
    except Exception as e:
        print(f"Failed to append to notebook: {e}")

if __name__ == "__main__":
    main()
