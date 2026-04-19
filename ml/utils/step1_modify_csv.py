import pandas as pd
import numpy as np
import os

file_path = r'C:\Users\heman\Downloads\capstone\smart-inventory-app\dist\data\sell_prices.csv'

if not os.path.exists(file_path):
    print(f"Error: {file_path} not found.")
else:
    print(f"Loading {file_path}...")
    df = pd.read_csv(file_path)
    
    # Add new column 'item_size'
    print("Modifying dataset...")
    np.random.seed(42)  # seeded for reproducibility
    sizes = ['S', 'M', 'L', 'XL']
    
    # Assign randomly
    df['item_size'] = np.random.choice(sizes, size=len(df))
    
    # Save back
    df.to_csv(file_path, index=False)
    print("Saved modified data.")
