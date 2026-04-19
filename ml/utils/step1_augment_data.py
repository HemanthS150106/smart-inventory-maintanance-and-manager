import pandas as pd
import numpy as np
import os

file_path = r'smart-inventory-app\dist\data\sell_prices.csv'

if not os.path.exists(file_path):
    print(f"Error: {file_path} not found.")
else:
    print(f"Loading {file_path}...")
    df = pd.read_csv(file_path)
    
    print("Modifying dataset for true 5-level weight assignments...")
    np.random.seed(55)
    
    # We add weight based on item_size but matching 5 levels mapping
    def get_weight(size):
        if size == 'S': return round(np.random.uniform(0.5, 5.0), 2)    # L5
        if size == 'XL': return round(np.random.uniform(60.0, 150.0), 2) # L1
        
        # M and L needs to be split across L4, L3, L2 bounds
        if size == 'M':
            # 5-15kg (L4) or 15-30kg (L3)
            return round(np.random.uniform(5.0, 30.0), 2)
        if size == 'L':
            # 15-30kg (L3) or 30-60kg (L2)
            return round(np.random.uniform(15.0, 60.0), 2)
            
        return 1.0 # fallback
        
    df['item_weight_kg'] = df['item_size'].apply(get_weight)
    
    df.to_csv(file_path, index=False)
    print("Saved modified data with real-item_weight_kg bounds!")
