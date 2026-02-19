# GaFi Prediction — Prophet ML Backend

## Overview

This project trains a **Facebook Prophet** time-series forecasting model on your expense data from Supabase,
exports it as a `.pkl` file, and serves predictions via a **FastAPI** REST API that the GaFi Android app calls.

## Architecture

```
┌─────────────────┐     POST /predict     ┌─────────────────────┐
│  GaFi Android   │ ──────────────────►   │  FastAPI Backend     │
│  (React Native) │ ◄──────────────────   │  loads prophet.pkl   │
└─────────────────┘     JSON response     └─────────────────────┘
                                                    ▲
                                                    │ joblib.load()
                                          ┌─────────┴───────────┐
                                          │  models/             │
                                          │   prophet_total.pkl  │
                                          │   prophet_*.pkl      │
                                          │   metadata.json      │
                                          └─────────────────────┘
                                                    ▲
                                                    │ trained by
                                          ┌─────────┴───────────┐
                                          │  train_model.ipynb   │
                                          │  (Jupyter Notebook)  │
                                          └─────────────────────┘
```

## Quick Start

### 1. Install Python Dependencies

```bash
cd GaFi_Prediction
pip install -r requirements.txt
```

> **Note:** Prophet may take a few minutes to install as it compiles C++ code.
> If Prophet installation fails on Windows, try: `conda install -c conda-forge prophet`

### 2. Train the Model (Jupyter Notebook)

```bash
jupyter notebook train_model.ipynb
```

Run all cells in order. This will:
- Connect to Supabase and fetch your expense data
- Perform exploratory data analysis (EDA) with charts
- Train a Prophet model with Philippine seasonal patterns
- Evaluate accuracy (MAE, RMSE, MAPE, R²)
- Save trained models to `models/` folder as `.pkl` files
- Generate charts for your thesis (saved as `.png` files)

### 3. Start the FastAPI Server

```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

Or simply:
```bash
python app.py
```

The server will start at `http://localhost:8000`.

### 4. Test the API

Open your browser: `http://localhost:8000/docs` — Swagger UI

Or test with curl:
```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"user_id": "7c5f754b-12c0-4361-82dd-bd5a126df798", "month": 6, "year": 2025, "monthly_budget": 10000}'
```

### 5. Connect the Android App

The app's `PredictionEngine.js` is configured to call `http://10.0.2.2:8000` (Android Emulator).

For a **physical device**, update `API_BASE_URL` in `PredictionEngine.js`:
```javascript
const API_BASE_URL = 'http://<YOUR_PC_IP>:8000';
```

Find your PC's IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux).

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service status |
| `/health` | GET | Model health check |
| `/predict` | POST | Get expense prediction |
| `/model-info` | GET | Model metadata & accuracy metrics |

### POST /predict — Request

```json
{
  "user_id": "7c5f754b-12c0-4361-82dd-bd5a126df798",
  "month": 6,
  "year": 2025,
  "monthly_budget": 10000
}
```

### POST /predict — Response

```json
{
  "totalPredicted": 9850.00,
  "totalPredictedLower": 8200.00,
  "totalPredictedUpper": 11500.00,
  "spentSoFar": 3500.00,
  "projectedRemaining": 6350.00,
  "budgetStatus": "within_budget",
  "confidenceLevel": "high",
  "predictionMethod": "Prophet ML Model",
  "categoryPredictions": {
    "Food & Dining": 3200.00,
    "Transport": 1500.00,
    ...
  },
  "categorySpent": {
    "Food & Dining": 1200.00,
    ...
  },
  "transactionCount": 45,
  "modelMetrics": {
    "mae": 450.00,
    "rmse": 580.00,
    "mape": 4.5,
    "r2": 0.92
  }
}
```

## Files

| File | Purpose |
|------|---------|
| `train_model.ipynb` | Jupyter notebook — trains Prophet model, generates charts, saves .pkl |
| `app.py` | FastAPI server — loads .pkl models and serves predictions |
| `requirements.txt` | Python dependencies |
| `.env` | Supabase credentials (DO NOT commit to git) |
| `models/` | Saved .pkl models and metadata (created after training) |
| `*.png` | EDA and evaluation charts (created after training) |

## Thesis Documentation

After running the notebook, you'll have these artifacts for your thesis:

- **EDA Charts**: `eda_charts.png` — monthly spending, category pie, stacked bars, distribution
- **Forecast Plot**: `forecast_plot.png` — Prophet forecast with confidence intervals
- **Components**: `forecast_components.png` — trend + seasonality decomposition
- **Evaluation**: `model_evaluation.png` — actual vs predicted scatter + time series
- **Cross-Validation**: `cross_validation.png` — MAPE over forecast horizon
- **Metrics**: In-sample MAE, RMSE, MAPE, R² printed in notebook output

## Troubleshooting

**Prophet won't install:**
```bash
pip install pystan==2.19.1.1
pip install prophet
```
Or use Conda: `conda install -c conda-forge prophet`

**API returns "Model not loaded":**
Run `train_model.ipynb` first to generate the `.pkl` files in `models/`.

**App can't reach API:**
- Emulator: Use `http://10.0.2.2:8000`
- Physical device: Use `http://<YOUR_PC_IP>:8000` and make sure both are on the same WiFi network
- Check firewall allows port 8000
