import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import os

# ── Page config ───────────────────────────────────────────────────
st.set_page_config(
    page_title="Smart Warehouse System",
    page_icon="🏭",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ── Custom CSS ────────────────────────────────────────────────────
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

    html, body, [class*="css"] {
        font-family: 'DM Sans', sans-serif;
    }

    .main {
        background-color: #0f1117;
    }

    .block-container {
        padding-top: 1.5rem;
        padding-bottom: 2rem;
    }

    /* Sidebar */
    section[data-testid="stSidebar"] {
        background-color: #1a1d27;
        border-right: 1px solid #2a2d3a;
    }

    /* Metric cards */
    div[data-testid="metric-container"] {
        background-color: #1a1d27;
        border: 1px solid #2a2d3a;
        border-radius: 12px;
        padding: 16px 20px;
    }

    div[data-testid="metric-container"] label {
        color: #8b8fa8 !important;
        font-size: 0.75rem !important;
        text-transform: uppercase;
        letter-spacing: 0.08em;
    }

    div[data-testid="metric-container"] div[data-testid="stMetricValue"] {
        color: #e8eaf0 !important;
        font-family: 'Space Mono', monospace !important;
        font-size: 1.6rem !important;
    }

    /* Headers */
    h1 { color: #e8eaf0 !important; font-family: 'Space Mono', monospace !important; }
    h2 { color: #c8cad8 !important; font-family: 'DM Sans', sans-serif !important; font-weight: 600 !important; }
    h3 { color: #a8aab8 !important; font-family: 'DM Sans', sans-serif !important; font-weight: 500 !important; }

    /* Tabs */
    button[data-baseweb="tab"] {
        font-family: 'DM Sans', sans-serif !important;
        font-weight: 500 !important;
        color: #8b8fa8 !important;
    }

    button[data-baseweb="tab"][aria-selected="true"] {
        color: #7c8dff !important;
        border-bottom-color: #7c8dff !important;
    }

    /* Dataframe */
    .dataframe { font-size: 0.82rem !important; }

    /* Info boxes */
    .info-card {
        background: #1a1d27;
        border: 1px solid #2a2d3a;
        border-left: 3px solid #7c8dff;
        border-radius: 8px;
        padding: 14px 18px;
        margin-bottom: 12px;
        font-size: 0.88rem;
        color: #c8cad8;
    }

    .urgent-card {
        background: #1f1518;
        border: 1px solid #3a2025;
        border-left: 3px solid #ff6b6b;
        border-radius: 8px;
        padding: 14px 18px;
        margin-bottom: 12px;
        font-size: 0.88rem;
        color: #e8caca;
    }

    .success-card {
        background: #151f18;
        border: 1px solid #203a25;
        border-left: 3px solid #51cf66;
        border-radius: 8px;
        padding: 14px 18px;
        margin-bottom: 12px;
        font-size: 0.88rem;
        color: #c8e8ca;
    }

    /* Title banner */
    .title-banner {
        background: linear-gradient(135deg, #1a1d27 0%, #1e2235 100%);
        border: 1px solid #2a2d3a;
        border-radius: 16px;
        padding: 24px 32px;
        margin-bottom: 24px;
        display: flex;
        align-items: center;
        gap: 16px;
    }

    .title-text {
        font-family: 'Space Mono', monospace;
        font-size: 1.6rem;
        font-weight: 700;
        color: #e8eaf0;
        margin: 0;
    }

    .subtitle-text {
        font-size: 0.88rem;
        color: #8b8fa8;
        margin: 4px 0 0 0;
    }

    /* Badge */
    .badge {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 20px;
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
    }
    .badge-hot    { background: #2d1515; color: #ff6b6b; border: 1px solid #ff6b6b44; }
    .badge-warm   { background: #2d2215; color: #ffa94d; border: 1px solid #ffa94d44; }
    .badge-cold   { background: #151a2d; color: #74c0fc; border: 1px solid #74c0fc44; }
    .badge-urgent { background: #2d1515; color: #ff6b6b; border: 1px solid #ff6b6b44; }
    .badge-a      { background: #1a2d15; color: #51cf66; border: 1px solid #51cf6644; }
    .badge-b      { background: #2d2a15; color: #ffd43b; border: 1px solid #ffd43b44; }
    .badge-c      { background: #152d2a; color: #66d9e8; border: 1px solid #66d9e844; }
    .badge-d      { background: #251525; color: #cc5de8; border: 1px solid #cc5de844; }
</style>
""", unsafe_allow_html=True)

# ── Data loading ──────────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

@st.cache_data
def load_data():
    predictions  = pd.read_csv(os.path.join(DATA_DIR, 'predictions_top20.csv'))
    decisions    = pd.read_csv(os.path.join(DATA_DIR, 'predictions_full_with_decisions.csv'))
    slots        = pd.read_csv(os.path.join(DATA_DIR, 'slot_assignments.csv'))
    carts        = pd.read_csv(os.path.join(DATA_DIR, 'cart_assignments.csv'))
    routes       = pd.read_csv(os.path.join(DATA_DIR, 'optimized_routes.csv'))
    return predictions, decisions, slots, carts, routes

try:
    predictions, decisions, slots, carts, routes = load_data()
    data_loaded = True
except Exception as e:
    data_loaded = False
    load_error  = str(e)

# ── Sidebar ───────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("""
    <div style='padding:16px 0 8px 0'>
        <div style='font-family:Space Mono,monospace;font-size:1.1rem;
                    color:#e8eaf0;font-weight:700;'>🏭 SmartWH</div>
        <div style='font-size:0.75rem;color:#8b8fa8;margin-top:4px;'>
            CA_1 Store · M5 Dataset
        </div>
    </div>
    <hr style='border-color:#2a2d3a;margin:8px 0 16px 0'>
    """, unsafe_allow_html=True)

    page = st.radio(
        "Navigation",
        ["📊 Overview",
         "📈 Demand Forecast",
         "🏭 Inventory Decisions",
         "📍 Slot Map",
         "🛒 Cart & Routes"],
        label_visibility="collapsed"
    )

    if data_loaded:
        st.markdown("<hr style='border-color:#2a2d3a;margin:16px 0'>",
                    unsafe_allow_html=True)
        st.markdown("""
        <div style='font-size:0.72rem;color:#8b8fa8;
                    text-transform:uppercase;letter-spacing:0.08em;
                    margin-bottom:10px;'>Quick Stats</div>
        """, unsafe_allow_html=True)

        total_skus    = len(decisions)
        urgent_count  = (decisions['decision'] == 'URGENT_RESTOCK').sum()
        restock_count = (decisions['decision'] == 'RESTOCK').sum()
        total_units   = int(decisions['reorder_quantity'].sum())

        st.metric("Total SKUs",    f"{total_skus:,}")
        st.metric("Urgent Restock", f"{urgent_count:,}")
        st.metric("Restock",        f"{restock_count:,}")
        st.metric("Units to Order", f"{total_units:,}")

    st.markdown("""
    <hr style='border-color:#2a2d3a;margin:16px 0'>
    <div style='font-size:0.72rem;color:#4a4d5a;text-align:center;'>
        Smart Warehouse System v1.0<br>
        M5 Forecasting · CA_1 Store
    </div>
    """, unsafe_allow_html=True)

# ── Error state ───────────────────────────────────────────────────
if not data_loaded:
    st.error("⚠️ Could not load data files.")
    st.code(f"Error: {load_error}")
    st.markdown("""
    **Make sure your `data/` folder contains:**
    ```
    data/
    ├── predictions_top20.csv
    ├── predictions_full_with_decisions.csv
    ├── slot_assignments.csv
    ├── cart_assignments.csv
    └── optimized_routes.csv
    ```
    """)
    st.stop()

# ════════════════════════════════════════════════════════════════
# PAGE 1 — OVERVIEW
# ════════════════════════════════════════════════════════════════
if page == "📊 Overview":

    st.markdown("""
    <div class='title-banner'>
        <div>
            <p class='title-text'>🏭 Smart Warehouse System</p>
            <p class='subtitle-text'>
                AI-Driven Demand Forecasting · Dynamic Slot Allocation ·
                Hybrid Route Optimization · CA_1 Store
            </p>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # ── KPI row ───────────────────────────────────────────────────
    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Total SKUs",       "3,049",   "CA_1 store")
    c2.metric("Forecast Horizon", "28 days", "validation")
    c3.metric("LightGBM MAE",     "1.04",    "baseline")
    c4.metric("ARIMA RMSE ↓",     "17.6%",   "vs baseline")
    c5.metric("LSTM RMSE ↓",      "17.8%",   "vs baseline")

    st.markdown("<br>", unsafe_allow_html=True)

    # ── Model router breakdown ────────────────────────────────────
    col1, col2 = st.columns([1, 1])

    with col1:
        st.markdown("### 🤖 Model Router Assignment")
        router_data = pd.DataFrame({
            'Model'  : ['ARIMA', 'XGBoost', 'LSTM/TFT'],
            'SKUs'   : [2199, 841, 9],
            'Reason' : ['Zero ratio > 40%',
                        'CV > 1.2 or default',
                        'Strong trend + high mean'],
            'Color'  : ['#ff6b6b', '#51cf66', '#7c8dff']
        })

        fig_router = go.Figure(go.Bar(
            x=router_data['SKUs'],
            y=router_data['Model'],
            orientation='h',
            marker_color=router_data['Color'],
            text=[f"{v:,} SKUs" for v in router_data['SKUs']],
            textposition='outside',
            textfont=dict(color='#c8cad8', size=12),
        ))
        fig_router.update_layout(
            paper_bgcolor='#1a1d27',
            plot_bgcolor='#1a1d27',
            height=220,
            margin=dict(l=10, r=60, t=10, b=10),
            xaxis=dict(showgrid=False, showticklabels=False,
                       color='#4a4d5a'),
            yaxis=dict(color='#c8cad8', tickfont=dict(size=13)),
            font=dict(family='DM Sans'),
        )
        st.plotly_chart(fig_router, use_container_width=True)

    with col2:
        st.markdown("### 📦 Velocity Distribution")
        vel_counts = decisions['velocity'].value_counts()\
                                          .reindex(['A','B','C','D'])
        vel_colors = ['#ff6b6b','#ffa94d','#51cf66','#74c0fc']
        vel_labels = {
            'A': 'A — Fast (≥100/wk)',
            'B': 'B — Medium (20-99/wk)',
            'C': 'C — Slow (5-19/wk)',
            'D': 'D — Dead (<5/wk)'
        }

        fig_vel = go.Figure(go.Pie(
            labels=[vel_labels[v] for v in vel_counts.index],
            values=vel_counts.values,
            hole=0.55,
            marker_colors=vel_colors,
            textinfo='percent',
            textfont=dict(size=12, color='white'),
        ))
        fig_vel.update_layout(
            paper_bgcolor='#1a1d27',
            height=220,
            margin=dict(l=10, r=10, t=10, b=10),
            legend=dict(font=dict(color='#c8cad8', size=11),
                        bgcolor='rgba(0,0,0,0)'),
            font=dict(family='DM Sans'),
        )
        st.plotly_chart(fig_vel, use_container_width=True)

    # ── Pipeline flow ─────────────────────────────────────────────
    st.markdown("### 🔄 Pipeline Overview")
    pipeline_cols = st.columns(5)
    steps = [
        ("L0–L2", "Data &\nFeatures",   "#7c8dff", "3,049 SKUs\n5.5 yr history"),
        ("L3",    "Model Router\n+ Forecast", "#51cf66", "ARIMA/XGB\nLSTM/LGB"),
        ("L4",    "Inventory\nDecision", "#ffa94d", "2,678 SKUs\nto restock"),
        ("L5",    "Slot\nAllocation",    "#ff6b6b", "120 slots\n0 overflow"),
        ("L6–L7", "Cart &\nRouting",     "#cc5de8", "134 carts\nIACO+A*+DWA"),
    ]
    for col, (layer, title, color, detail) in zip(pipeline_cols, steps):
        col.markdown(f"""
        <div style='background:#1a1d27;border:1px solid #2a2d3a;
                    border-top:3px solid {color};border-radius:10px;
                    padding:14px;text-align:center;'>
            <div style='font-family:Space Mono,monospace;
                        font-size:0.7rem;color:{color};
                        margin-bottom:6px;'>{layer}</div>
            <div style='font-size:0.88rem;color:#e8eaf0;
                        font-weight:600;white-space:pre-line;
                        line-height:1.4;'>{title}</div>
            <div style='font-size:0.72rem;color:#8b8fa8;
                        margin-top:6px;white-space:pre-line;
                        line-height:1.5;'>{detail}</div>
        </div>
        """, unsafe_allow_html=True)


# ════════════════════════════════════════════════════════════════
# PAGE 2 — DEMAND FORECAST
# ════════════════════════════════════════════════════════════════
elif page == "📈 Demand Forecast":

    st.markdown("## 📈 Demand Forecast")
    st.markdown(
        "<p style='color:#8b8fa8;font-size:0.88rem;margin-top:-8px;'>"
        "28-day ahead weekly demand predictions — Top 20 highest-demand SKUs</p>",
        unsafe_allow_html=True
    )

    # ── Top 20 bar chart ──────────────────────────────────────────
    top20 = predictions.copy()
    top20 = top20.sort_values('predicted_weekly_demand', ascending=False)

    fig_top20 = go.Figure()
    fig_top20.add_trace(go.Bar(
        name='Predicted',
        x=top20['item_id'],
        y=top20['predicted_weekly_demand'],
        marker_color='#7c8dff',
        opacity=0.9,
    ))
    fig_top20.add_trace(go.Bar(
        name='Actual',
        x=top20['item_id'],
        y=top20['actual_weekly_demand'],
        marker_color='#51cf66',
        opacity=0.7,
    ))
    fig_top20.update_layout(
        paper_bgcolor='#1a1d27',
        plot_bgcolor='#1a1d27',
        height=380,
        barmode='group',
        legend=dict(font=dict(color='#c8cad8'),
                    bgcolor='rgba(0,0,0,0)'),
        xaxis=dict(tickangle=-40, color='#8b8fa8',
                   tickfont=dict(size=10),
                   gridcolor='#2a2d3a'),
        yaxis=dict(color='#8b8fa8', gridcolor='#2a2d3a',
                   title='Weekly units'),
        margin=dict(l=10, r=10, t=10, b=80),
        font=dict(family='DM Sans', color='#c8cad8'),
    )
    st.plotly_chart(fig_top20, use_container_width=True)

    # ── Metrics row ───────────────────────────────────────────────
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Top SKU demand",
              f"{top20['predicted_weekly_demand'].max():,.0f} units/wk",
              top20.iloc[0]['item_id'])
    m2.metric("Total top-20 demand",
              f"{top20['predicted_weekly_demand'].sum():,.0f} units")
    m3.metric("Best MAPE",
              f"{top20['mape_weekly'].min():.2f}%",
              "lowest error")
    m4.metric("Avg MAPE (top 20)",
              f"{top20['mape_weekly'].mean():.2f}%")

    st.markdown("<br>", unsafe_allow_html=True)

    # ── Model performance table ───────────────────────────────────
    st.markdown("### 📋 Model Comparison Table (Paper Results)")
    model_table = pd.DataFrame({
        'Model'         : ['LightGBM baseline',
                           'XGBoost (CV>1.2)',
                           'ARIMA (zero>40%)',
                           'LSTM/TFT (trend+mean)',
                           'Adaptive Router (ours)'],
        'SKUs'          : [3049, 841, 100, 9, 3049],
        'MAE'           : [1.0427, 1.9625, 0.8485, 1.9636, 1.0464],
        'RMSE'          : [2.0254, 3.3574, 1.1275, 2.3960, 2.0324],
        'MAPE (%)'      : [50.08, 71.62, 50.07, 28.48, 50.69],
        'Router Trigger': ['None (baseline)',
                           'CV > 1.2',
                           'Zero ratio > 40%',
                           'Trend R² > 0.3',
                           'Combined'],
    })
    st.dataframe(
        model_table.style
        .highlight_min(subset=['MAE','RMSE'], color='#1a3a1a')
        .format({'MAE': '{:.4f}', 'RMSE': '{:.4f}',
                 'MAPE (%)': '{:.2f}%', 'SKUs': '{:,}'}),
        use_container_width=True, hide_index=True
    )

    st.markdown("""
    <div class='success-card'>
        <b>Key Finding:</b> ARIMA reduces RMSE by 17.6% on sparse/intermittent SKUs.
        LSTM reduces RMSE by 17.8% on high-trend SKUs.
        Routed models consistently outperform the global baseline on segment-specific RMSE.
    </div>
    """, unsafe_allow_html=True)

    # ── Full predictions table ────────────────────────────────────
    st.markdown("### 🔍 Full Top-20 Prediction Detail")
    display_cols = ['item_id','dept_id','cat_id','model_used',
                    'predicted_weekly_demand','actual_weekly_demand',
                    'mape_weekly']
    st.dataframe(
        top20[display_cols]
        .rename(columns={
            'predicted_weekly_demand': 'Predicted (wk)',
            'actual_weekly_demand'   : 'Actual (wk)',
            'mape_weekly'            : 'MAPE (%)',
            'model_used'             : 'Model',
        })
        .style.format({
            'Predicted (wk)': '{:.1f}',
            'Actual (wk)'   : '{:.0f}',
            'MAPE (%)'      : '{:.2f}',
        }),
        use_container_width=True,
        hide_index=True
    )


# ════════════════════════════════════════════════════════════════
# PAGE 3 — INVENTORY DECISIONS
# ════════════════════════════════════════════════════════════════
elif page == "🏭 Inventory Decisions":

    st.markdown("## 🏭 Inventory Decision Engine")
    st.markdown(
        "<p style='color:#8b8fa8;font-size:0.88rem;margin-top:-8px;'>"
        "Restock decisions based on predicted demand vs thresholds</p>",
        unsafe_allow_html=True
    )

    # ── KPI row ───────────────────────────────────────────────────
    dec_counts = decisions['decision'].value_counts()
    k1, k2, k3, k4 = st.columns(4)
    k1.metric("Urgent Restock",
              f"{dec_counts.get('URGENT_RESTOCK', 0):,}",
              "demand ≥ 50/wk")
    k2.metric("Restock",
              f"{dec_counts.get('RESTOCK', 0):,}",
              "demand 5–49/wk")
    k3.metric("Monitor",
              f"{dec_counts.get('MONITOR', 0):,}",
              "demand < 5/wk")
    k4.metric("Total Reorder",
              f"{int(decisions['reorder_quantity'].sum()):,} units",
              "this week")

    st.markdown("<br>", unsafe_allow_html=True)
    col1, col2 = st.columns([1, 1])

    with col1:
        st.markdown("### Decision Breakdown")
        dec_colors = {
            'URGENT_RESTOCK': '#ff6b6b',
            'RESTOCK'       : '#ffa94d',
            'MONITOR'       : '#74c0fc',
            'NO_ACTION'     : '#4a4d5a',
        }
        fig_dec = go.Figure(go.Bar(
            x=list(dec_counts.index),
            y=list(dec_counts.values),
            marker_color=[dec_colors.get(d, '#7c8dff')
                          for d in dec_counts.index],
            text=list(dec_counts.values),
            textposition='outside',
            textfont=dict(color='#c8cad8', size=12),
        ))
        fig_dec.update_layout(
            paper_bgcolor='#1a1d27',
            plot_bgcolor='#1a1d27',
            height=280,
            margin=dict(l=10, r=10, t=10, b=10),
            xaxis=dict(color='#8b8fa8', gridcolor='#2a2d3a'),
            yaxis=dict(color='#8b8fa8', gridcolor='#2a2d3a'),
            font=dict(family='DM Sans', color='#c8cad8'),
        )
        st.plotly_chart(fig_dec, use_container_width=True)

    with col2:
        st.markdown("### Demand Distribution by Decision")
        fig_box = go.Figure()
        for dec, color in dec_colors.items():
            subset = decisions[decisions['decision'] == dec]
            if len(subset) == 0:
                continue
            fig_box.add_trace(go.Box(
                y=subset['predicted_weekly_demand'].clip(upper=200),
                name=dec,
                marker_color=color,
                line_color=color,
                fillcolor=color + '33',
            ))
        fig_box.update_layout(
            paper_bgcolor='#1a1d27',
            plot_bgcolor='#1a1d27',
            height=280,
            margin=dict(l=10, r=10, t=10, b=10),
            xaxis=dict(color='#8b8fa8'),
            yaxis=dict(color='#8b8fa8', gridcolor='#2a2d3a',
                       title='Weekly demand (clipped 200)'),
            legend=dict(font=dict(color='#c8cad8'),
                        bgcolor='rgba(0,0,0,0)'),
            font=dict(family='DM Sans', color='#c8cad8'),
            showlegend=False,
        )
        st.plotly_chart(fig_box, use_container_width=True)

    # ── Filters + table ───────────────────────────────────────────
    st.markdown("### 🔍 Browse Inventory Decisions")
    f1, f2, f3 = st.columns(3)

    with f1:
        dec_filter = st.selectbox(
            "Decision",
            ["All"] + decisions['decision'].unique().tolist()
        )
    with f2:
        vel_filter = st.selectbox(
            "Velocity",
            ["All", "A", "B", "C", "D"]
        )
    with f3:
        cat_filter = st.selectbox(
            "Category",
            ["All"] + sorted(decisions['cat_id'].unique().tolist())
        )

    filtered = decisions.copy()
    if dec_filter != "All":
        filtered = filtered[filtered['decision'] == dec_filter]
    if vel_filter != "All":
        filtered = filtered[filtered['velocity'] == vel_filter]
    if cat_filter != "All":
        filtered = filtered[filtered['cat_id'] == cat_filter]

    st.markdown(
        f"<p style='color:#8b8fa8;font-size:0.82rem;'>"
        f"Showing {len(filtered):,} of {len(decisions):,} SKUs</p>",
        unsafe_allow_html=True
    )

    show_cols = ['item_id','dept_id','cat_id','velocity',
                 'predicted_weekly_demand','reorder_quantity',
                 'decision','model_used']
    st.dataframe(
        filtered[show_cols]
        .sort_values('predicted_weekly_demand', ascending=False)
        .head(100)
        .rename(columns={
            'predicted_weekly_demand': 'Pred. Demand/wk',
            'reorder_quantity'       : 'Reorder Qty',
            'model_used'             : 'Model',
        })
        .style.format({
            'Pred. Demand/wk': '{:.1f}',
            'Reorder Qty'    : '{:.0f}',
        }),
        use_container_width=True,
        hide_index=True,
        height=340
    )


# ════════════════════════════════════════════════════════════════
# PAGE 4 — SLOT MAP
# ════════════════════════════════════════════════════════════════
elif page == "📍 Slot Map":

    st.markdown("## 📍 Warehouse Slot Map")
    st.markdown(
        "<p style='color:#8b8fa8;font-size:0.88rem;margin-top:-8px;'>"
        "Velocity-based slot allocation · 12 rows × 10 columns · "
        "Entrance at top-left (A1)</p>",
        unsafe_allow_html=True
    )

    ROWS_LIST = ['A','B','C','D','E','F','G','H','I','J','K','L']
    COLS_LIST = list(range(1, 11))

    # ── Heatmap ───────────────────────────────────────────────────
    col1, col2 = st.columns([2, 1])

    with col1:
        st.markdown("### Demand Heatmap")
        view_opt = st.radio(
            "Colour by",
            ["Total weekly demand", "Velocity zone",
             "Number of SKUs per slot"],
            horizontal=True
        )

        demand_grid = np.zeros((len(ROWS_LIST), len(COLS_LIST)))
        zone_grid   = np.zeros((len(ROWS_LIST), len(COLS_LIST)))
        count_grid  = np.zeros((len(ROWS_LIST), len(COLS_LIST)))

        zone_num = {'HOT': 3, 'WARM': 2, 'COLD': 1}

        for _, row in slots.iterrows():
            r = ROWS_LIST.index(row['row'])
            c = row['col'] - 1
            demand_grid[r][c] += row['predicted_weekly_demand']
            zone_grid[r][c]    = zone_num.get(row['zone'], 0)
            count_grid[r][c]  += 1

        if view_opt == "Total weekly demand":
            z_data = demand_grid
            cmap   = 'YlOrRd'
            zlabel = 'Weekly demand'
        elif view_opt == "Velocity zone":
            z_data = zone_grid
            cmap   = 'RdYlBu'
            zlabel = 'Zone (3=HOT, 1=COLD)'
        else:
            z_data = count_grid
            cmap   = 'Blues'
            zlabel = 'SKU count'

        # Hover text
        hover_text = []
        for r_idx, row_label in enumerate(ROWS_LIST):
            row_hover = []
            for c_idx, col_num in enumerate(COLS_LIST):
                slot_id   = f"{row_label}{col_num}"
                slot_skus = slots[slots['slot_id'] == slot_id]
                zone      = slot_skus['zone'].iloc[0] \
                            if len(slot_skus) > 0 else 'N/A'
                n_skus    = len(slot_skus)
                demand    = slot_skus['predicted_weekly_demand'].sum()
                row_hover.append(
                    f"Slot: {slot_id}<br>"
                    f"Zone: {zone}<br>"
                    f"SKUs: {n_skus}<br>"
                    f"Demand: {demand:.0f}/wk"
                )
            hover_text.append(row_hover)

        fig_heat = go.Figure(go.Heatmap(
            z=z_data,
            x=[f'C{c}' for c in COLS_LIST],
            y=ROWS_LIST,
            colorscale=cmap,
            text=hover_text,
            hoverinfo='text',
            colorbar=dict(
                title=zlabel,
                titlefont=dict(color='#c8cad8'),
                tickfont=dict(color='#c8cad8'),
            ),
        ))

        # Zone boundary lines
        fig_heat.add_shape(type='line', x0=-0.5, x1=9.5,
                           y0=0.5, y1=0.5,
                           line=dict(color='white', width=2, dash='dot'))
        fig_heat.add_shape(type='line', x0=-0.5, x1=9.5,
                           y0=5.5, y1=5.5,
                           line=dict(color='white', width=2, dash='dot'))

        # Entrance annotation
        fig_heat.add_annotation(
            x=0, y=-0.7, text='▶ ENTRANCE',
            showarrow=False,
            font=dict(color='#51cf66', size=12, family='Space Mono'),
            xref='x', yref='y'
        )

        # Zone labels
        for label, y_pos, color in [
            ('HOT',  0,   '#ff6b6b'),
            ('WARM', 3,   '#ffa94d'),
            ('COLD', 8.5, '#74c0fc'),
        ]:
            fig_heat.add_annotation(
                x=10.2, y=y_pos, text=label,
                showarrow=False, xref='x', yref='y',
                font=dict(color=color, size=11,
                          family='Space Mono'),
            )

        fig_heat.update_layout(
            paper_bgcolor='#1a1d27',
            plot_bgcolor='#1a1d27',
            height=460,
            margin=dict(l=30, r=80, t=20, b=40),
            xaxis=dict(color='#8b8fa8', side='top'),
            yaxis=dict(color='#8b8fa8', autorange='reversed'),
            font=dict(family='DM Sans', color='#c8cad8'),
        )
        st.plotly_chart(fig_heat, use_container_width=True)

    with col2:
        st.markdown("### Zone Stats")

        for zone, color, bg in [
            ('HOT',  '#ff6b6b', '#2d1515'),
            ('WARM', '#ffa94d', '#2d2215'),
            ('COLD', '#74c0fc', '#151a2d'),
        ]:
            zone_data = slots[slots['zone'] == zone]
            n_skus    = len(zone_data)
            avg_dist  = zone_data['distance_score'].mean()
            tot_dem   = zone_data['predicted_weekly_demand'].sum()

            st.markdown(f"""
            <div style='background:{bg};border:1px solid {color}33;
                        border-left:3px solid {color};
                        border-radius:8px;padding:12px 16px;
                        margin-bottom:10px;'>
                <div style='font-family:Space Mono,monospace;
                            font-size:0.85rem;color:{color};
                            font-weight:700;'>{zone} ZONE</div>
                <div style='font-size:0.8rem;color:#c8cad8;
                            margin-top:6px;line-height:1.8;'>
                    SKUs: <b>{n_skus:,}</b><br>
                    Avg dist: <b>{avg_dist:.2f}</b><br>
                    Weekly demand: <b>{tot_dem:,.0f}</b>
                </div>
            </div>
            """, unsafe_allow_html=True)

        st.markdown("### Slot Detail")
        slot_id_input = st.text_input(
            "Enter slot ID (e.g. A1, B3)",
            value="A1"
        ).upper()

        if slot_id_input:
            slot_items = slots[slots['slot_id'] == slot_id_input]
            if len(slot_items) > 0:
                zone = slot_items['zone'].iloc[0]
                st.markdown(f"""
                <div class='info-card'>
                    <b>Slot {slot_id_input}</b> —
                    {zone} zone<br>
                    {len(slot_items)} SKUs assigned
                </div>
                """, unsafe_allow_html=True)
                st.dataframe(
                    slot_items[['item_id','velocity',
                                'predicted_weekly_demand',
                                'decision']]
                    .rename(columns={
                        'predicted_weekly_demand': 'Demand/wk',
                    })
                    .style.format({'Demand/wk': '{:.1f}'}),
                    use_container_width=True,
                    hide_index=True
                )
            else:
                st.warning(f"Slot {slot_id_input} not found.")


# ════════════════════════════════════════════════════════════════
# PAGE 5 — CART & ROUTES
# ════════════════════════════════════════════════════════════════
elif page == "🛒 Cart & Routes":

    st.markdown("## 🛒 Cart Allocation & Route Optimization")
    st.markdown(
        "<p style='color:#8b8fa8;font-size:0.88rem;margin-top:-8px;'>"
        "Fuzzy C Clustering groups nearby slots into picking carts · "
        "IACO + A* + DWA optimizes picking routes</p>",
        unsafe_allow_html=True
    )

    # ── KPI row ───────────────────────────────────────────────────
    k1, k2, k3, k4 = st.columns(4)
    k1.metric("Total Carts",       f"{carts['cart_label'].nunique()}")
    k2.metric("Items to Pick",     f"{len(carts):,}")
    k3.metric("Zone Purity",       "100%", "FCM clustering")
    k4.metric("Avg Membership",    "0.904", "fuzzy score")

    st.markdown("<br>", unsafe_allow_html=True)
    col1, col2 = st.columns([1, 1])

    with col1:
        st.markdown("### Cart Size Distribution")
        cart_sizes = carts.groupby('cart_label').size().reset_index()
        cart_sizes.columns = ['cart_label', 'size']

        fig_cart = go.Figure(go.Histogram(
            x=cart_sizes['size'],
            nbinsx=25,
            marker_color='#7c8dff',
            marker_line_color='#1a1d27',
            marker_line_width=1,
        ))
        fig_cart.add_vline(
            x=20, line_dash='dash',
            line_color='#ff6b6b', line_width=2,
            annotation_text='Max capacity (20)',
            annotation_font_color='#ff6b6b',
        )
        fig_cart.add_vline(
            x=cart_sizes['size'].mean(),
            line_dash='dash',
            line_color='#51cf66', line_width=2,
            annotation_text=f"Mean ({cart_sizes['size'].mean():.1f})",
            annotation_font_color='#51cf66',
        )
        fig_cart.update_layout(
            paper_bgcolor='#1a1d27',
            plot_bgcolor='#1a1d27',
            height=280,
            margin=dict(l=10, r=10, t=10, b=10),
            xaxis=dict(color='#8b8fa8', gridcolor='#2a2d3a',
                       title='Items per cart'),
            yaxis=dict(color='#8b8fa8', gridcolor='#2a2d3a',
                       title='Number of carts'),
            font=dict(family='DM Sans', color='#c8cad8'),
        )
        st.plotly_chart(fig_cart, use_container_width=True)

    with col2:
        st.markdown("### Membership Score Distribution")
        fig_mem = go.Figure(go.Histogram(
            x=carts['membership_score'],
            nbinsx=30,
            marker_color='#51cf66',
            marker_line_color='#1a1d27',
            marker_line_width=1,
        ))
        fig_mem.add_vline(
            x=0.7, line_dash='dash',
            line_color='#ffa94d', line_width=2,
            annotation_text='Strong threshold (0.7)',
            annotation_font_color='#ffa94d',
        )
        fig_mem.update_layout(
            paper_bgcolor='#1a1d27',
            plot_bgcolor='#1a1d27',
            height=280,
            margin=dict(l=10, r=10, t=10, b=10),
            xaxis=dict(color='#8b8fa8', gridcolor='#2a2d3a',
                       title='Membership score'),
            yaxis=dict(color='#8b8fa8', gridcolor='#2a2d3a',
                       title='Number of items'),
            font=dict(family='DM Sans', color='#c8cad8'),
        )
        st.plotly_chart(fig_mem, use_container_width=True)

    # ── Route visualization ───────────────────────────────────────
    st.markdown("### 🗺️ Route Visualization")

    r1, r2 = st.columns([1, 2])

    with r1:
        st.markdown("**Select a cart to visualize:**")
        cart_options = routes.sort_values(
            'total_demand', ascending=False
        )['cart_label'].tolist() \
            if 'total_demand' in routes.columns \
            else routes['cart_label'].tolist()

        selected_cart = st.selectbox(
            "Cart", cart_options, label_visibility="collapsed"
        )

        cart_row = routes[routes['cart_label'] == selected_cart]
        if len(cart_row) > 0:
            cr = cart_row.iloc[0]
            st.markdown(f"""
            <div class='info-card'>
                <b>{selected_cart}</b><br><br>
                Items in cart  : <b>{int(cr.get('items_in_cart', 0))}</b><br>
                Unique slots   : <b>{int(cr.get('unique_slots', 0))}</b><br>
                IACO distance  : <b>{cr.get('iaco_distance', 0):.1f}</b><br>
                Naive distance : <b>{cr.get('naive_distance', 0):.1f}</b><br>
                Improvement    : <b>{cr.get('improvement_pct', 0):.1f}%</b><br>
                Path steps     : <b>{int(cr.get('total_path_steps', 0))}</b>
            </div>
            """, unsafe_allow_html=True)

            route_str = cr.get('route', '')
            if route_str:
                st.markdown("**Picking order:**")
                stops = route_str.split(' → ')
                for i, stop in enumerate(stops):
                    icon = "🟢" if i == 0 or i == len(stops)-1 else "🔵"
                    st.markdown(
                        f"<span style='font-family:Space Mono,monospace;"
                        f"font-size:0.82rem;color:#c8cad8;'>"
                        f"{icon} {stop}</span>",
                        unsafe_allow_html=True
                    )

    with r2:
        # Draw warehouse grid with route
        ROWS_LIST = ['A','B','C','D','E','F','G','H','I','J','K','L']
        COLS_LIST = list(range(1, 11))

        cart_items_sel = carts[carts['cart_label'] == selected_cart]

        fig_route = go.Figure()

        # Background grid — colour by zone
        zone_bg = []
        for r_idx, row_label in enumerate(ROWS_LIST):
            for c_idx in range(len(COLS_LIST)):
                zone = ('HOT'  if r_idx < 1 else
                        'WARM' if r_idx < 6 else 'COLD')
                zone_bg.append((r_idx, c_idx, zone))

        zone_colors = {'HOT': '#2d1515', 'WARM': '#2d2215',
                       'COLD': '#151a2d'}
        for r_idx, c_idx, zone in zone_bg:
            fig_route.add_shape(
                type='rect',
                x0=c_idx-0.45, x1=c_idx+0.45,
                y0=r_idx-0.45, y1=r_idx+0.45,
                fillcolor=zone_colors[zone],
                line=dict(color='#2a2d3a', width=0.5),
                layer='below'
            )

        # Cart item slots
        for _, item in cart_items_sel.iterrows():
            r = ROWS_LIST.index(item['row'])
            c = item['col'] - 1
            fig_route.add_trace(go.Scatter(
                x=[c], y=[r],
                mode='markers',
                marker=dict(size=22, color='#7c8dff',
                            symbol='square', opacity=0.85),
                hovertext=f"{item['item_id']}<br>"
                          f"Slot: {item['slot_id']}<br>"
                          f"Demand: {item['predicted_weekly_demand']:.1f}/wk",
                hoverinfo='text',
                showlegend=False,
            ))

        # Route arrows
        if len(cart_row) > 0:
            route_str = cart_row.iloc[0].get('route', '')
            if route_str:
                stops = route_str.split(' → ')
                stop_coords = []
                for stop in stops:
                    stop = stop.strip()
                    if stop and len(stop) >= 2:
                        try:
                            row_char = stop[0]
                            col_num  = int(stop[1:])
                            if row_char in ROWS_LIST:
                                r = ROWS_LIST.index(row_char)
                                c = col_num - 1
                                stop_coords.append((c, r))
                        except ValueError:
                            continue

                if len(stop_coords) >= 2:
                    rx = [s[0] for s in stop_coords]
                    ry = [s[1] for s in stop_coords]
                    fig_route.add_trace(go.Scatter(
                        x=rx, y=ry,
                        mode='lines+markers',
                        line=dict(color='#51cf66', width=3),
                        marker=dict(size=10, color='#51cf66'),
                        name='Route',
                        showlegend=True,
                    ))

        # Entrance marker
        fig_route.add_trace(go.Scatter(
            x=[0], y=[0],
            mode='markers+text',
            marker=dict(size=18, color='#ffa94d', symbol='star'),
            text=['ENTRANCE'],
            textposition='top right',
            textfont=dict(color='#ffa94d', size=10,
                          family='Space Mono'),
            name='Entrance',
            showlegend=True,
        ))

        fig_route.update_layout(
            paper_bgcolor='#1a1d27',
            plot_bgcolor='#1a1d27',
            height=480,
            margin=dict(l=30, r=20, t=20, b=30),
            xaxis=dict(
                tickvals=list(range(len(COLS_LIST))),
                ticktext=[f'C{c}' for c in COLS_LIST],
                color='#8b8fa8', gridcolor='#2a2d3a',
                range=[-0.6, len(COLS_LIST)-0.4],
            ),
            yaxis=dict(
                tickvals=list(range(len(ROWS_LIST))),
                ticktext=ROWS_LIST,
                color='#8b8fa8', gridcolor='#2a2d3a',
                autorange='reversed',
                range=[-0.6, len(ROWS_LIST)-0.4],
            ),
            legend=dict(font=dict(color='#c8cad8'),
                        bgcolor='rgba(0,0,0,0)',
                        x=0.01, y=0.99),
            font=dict(family='DM Sans', color='#c8cad8'),
        )
        st.plotly_chart(fig_route, use_container_width=True)

    # ── Route optimization results table ─────────────────────────
    st.markdown("### 📋 Route Optimization Results")
    st.dataframe(
        routes.style.format({
            'iaco_distance'  : '{:.2f}',
            'naive_distance' : '{:.2f}',
            'improvement_pct': '{:.1f}%',
        }),
        use_container_width=True,
        hide_index=True,
        height=300
    )

    st.markdown("""
    <div class='success-card'>
        <b>Algorithm:</b> IACO (global optimizer) +
        A* (shortest path planner) + DWA (local obstacle avoidance)<br>
        <b>Result:</b> Average 10% improvement over naive picking order ·
        Best case 50% improvement · 100% zone purity from Fuzzy C Clustering
    </div>
    """, unsafe_allow_html=True)