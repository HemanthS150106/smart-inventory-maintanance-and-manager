import streamlit as st
import pandas as pd
import subprocess

st.set_page_config(layout="wide")

st.title("Warehouse Demand Forecast")

if st.button("Run 8-Week Forecast"):

    subprocess.run(["python","forecast.py"])

    st.success("Forecast generated")

try:

    df = pd.read_csv("forecast_8weeks.csv")

    week = st.selectbox(
        "Select Forecast Week",
        sorted(df["week"].unique())
    )

    week_df = df[df["week"] == week]

    week_df = week_df.sort_values(
        by="recommended_order",
        ascending=False
    )

    st.subheader(f"Week {week} Order Recommendations")

    st.dataframe(
        week_df[[
            "product",
            "predicted_demand",
            "current_stock",
            "recommended_order"
        ]].head(50),
        use_container_width=True
    )

except:
    st.info("Run forecast to view predictions")