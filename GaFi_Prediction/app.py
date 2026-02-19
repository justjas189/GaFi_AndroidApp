"""
GaFi Prediction API — FastAPI Backend
Loads trained Prophet .pkl models and serves expense predictions.

Run with:  uvicorn app:app --host 0.0.0.0 --port 8000 --reload
"""

import os
import json
import logging
from datetime import datetime, date
from typing import Optional
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gafi-prediction")

# ——— App Setup ———
app = FastAPI(
    title="GaFi Prediction API",
    description="Serves Prophet-based expense predictions for GaFi Android App",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your app's domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ——— Supabase Client ———
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
# Use service_role key to bypass RLS (notebook + API need to read all users' data)
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY or SUPABASE_KEY)

# ——— Load Models ———
MODELS_DIR = Path(__file__).parent / "models"

total_model = None
category_models: dict = {}
metadata: dict = {}


def load_models():
    """Load all .pkl models from disk."""
    global total_model, category_models, metadata

    total_path = MODELS_DIR / "prophet_total.pkl"
    if not total_path.exists():
        logger.warning("No trained model found at %s — run train_model.ipynb first!", total_path)
        return False

    total_model = joblib.load(total_path)
    logger.info("Loaded total spending model")

    # Load category models
    for pkl_file in MODELS_DIR.glob("prophet_*.pkl"):
        if pkl_file.name == "prophet_total.pkl":
            continue
        cat_name = pkl_file.stem.replace("prophet_", "")
        category_models[cat_name] = joblib.load(pkl_file)
        logger.info(f"Loaded category model: {cat_name}")

    # Load metadata
    meta_path = MODELS_DIR / "metadata.json"
    if meta_path.exists():
        with open(meta_path) as f:
            metadata = json.load(f)
        logger.info("Loaded model metadata")

    logger.info(
        f"All models loaded: 1 total + {len(category_models)} category models"
    )
    return True


# ——— Helper Functions ———

CATEGORY_NAME_MAP = {
    "food_and_dining": "Food & Dining",
    "transport": "Transport",
    "shopping": "Shopping",
    "groceries": "Groceries",
    "entertainment": "Entertainment",
    "electronics": "Electronics",
    "school_supplies": "School Supplies",
    "utilities": "Utilities",
    "health": "Health",
    "education": "Education",
    "other": "Other",
}

# Philippine inflation rates (BSP)
PH_INFLATION = {
    2020: 0.026, 2021: 0.048, 2022: 0.058, 2023: 0.060,
    2024: 0.032, 2025: 0.035, 2026: 0.034,
}


def is_school_month(ds):
    """MMCL Trisemester: 1st Tri (Feb–May), 2nd Tri (Jun–Sep), 3rd Tri (Oct–Jan).
    Must EXACTLY match the function used during model training in train_model.ipynb."""
    m = ds.month
    if m == 8:   return 0.5   # Aug: short break between 2nd and 3rd tri
    if m == 1:   return 0.8   # Jan: end of 3rd tri / transition period
    return 1.0


def predict_total(target_date: datetime) -> dict:
    """Predict total monthly spending for a given month."""
    if total_model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    future = pd.DataFrame({"ds": [target_date]})
    future["is_school"] = future["ds"].apply(is_school_month)

    forecast = total_model.predict(future)
    row = forecast.iloc[0]

    return {
        "predicted": max(0, float(row["yhat"])),
        "lower": max(0, float(row["yhat_lower"])),
        "upper": max(0, float(row["yhat_upper"])),
    }


def predict_categories(target_date: datetime, total_predicted: float) -> dict:
    """Predict per-category spending. Uses individual models if available,
    otherwise falls back to proportional allocation."""
    cat_predictions = {}
    model_total = 0

    # Get individual model predictions
    for safe_name, cat_model in category_models.items():
        display_name = CATEGORY_NAME_MAP.get(safe_name, safe_name.replace("_", " ").title())
        try:
            future = pd.DataFrame({"ds": [target_date]})
            future["is_school"] = future["ds"].apply(is_school_month)
            forecast = cat_model.predict(future)
            pred = max(0, float(forecast.iloc[0]["yhat"]))
            cat_predictions[display_name] = pred
            model_total += pred
        except Exception as e:
            logger.warning(f"Category model {safe_name} failed: {e}")
            cat_predictions[display_name] = 0

    # Scale category predictions to match total prediction
    if model_total > 0:
        scale_factor = total_predicted / model_total
        for cat in cat_predictions:
            cat_predictions[cat] = round(cat_predictions[cat] * scale_factor, 2)

    return cat_predictions


def get_user_expenses(user_id: str, month: int, year: int) -> dict:
    """Fetch actual spending so far for a given month from Supabase."""
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"

    response = (
        supabase.table("expenses")
        .select("amount, category, date")
        .eq("user_id", user_id)
        .gte("date", start_date)
        .lt("date", end_date)
        .execute()
    )

    expenses = response.data
    total_spent = sum(float(e.get("amount", 0)) for e in expenses)

    # Category breakdown
    cat_spent = {}
    cat_map = {
        "food": "Food & Dining", "food & dining": "Food & Dining",
        "transportation": "Transport", "transport": "Transport",
        "shopping": "Shopping", "groceries": "Groceries",
        "entertainment": "Entertainment", "electronics": "Electronics",
        "school supplies": "School Supplies", "utilities": "Utilities",
        "health": "Health", "education": "Education",
        "other": "Other", "others": "Other",
    }
    for e in expenses:
        raw_cat = str(e.get("category", "other")).lower().strip()
        clean_cat = cat_map.get(raw_cat, "Other")
        cat_spent[clean_cat] = cat_spent.get(clean_cat, 0) + float(e.get("amount", 0))

    return {
        "total_spent": total_spent,
        "category_spent": cat_spent,
        "transaction_count": len(expenses),
    }


# ——— Request / Response Models ———

class PredictionRequest(BaseModel):
    user_id: str
    month: int  # 1-12
    year: int   # e.g. 2025
    monthly_budget: Optional[float] = 10000


class PredictionResponse(BaseModel):
    totalPredicted: float
    totalPredictedLower: float
    totalPredictedUpper: float
    spentSoFar: float
    projectedRemaining: float
    budgetStatus: str
    confidenceLevel: str
    predictionMethod: str
    categoryPredictions: dict
    categorySpent: dict
    transactionCount: int
    modelMetrics: dict


# ——— Endpoints ———

@app.on_event("startup")
async def startup():
    load_models()


@app.get("/")
async def root():
    return {
        "service": "GaFi Prediction API",
        "status": "running",
        "model_loaded": total_model is not None,
        "category_models": len(category_models),
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy" if total_model is not None else "no_model",
        "model_loaded": total_model is not None,
        "categories": len(category_models),
        "metadata": metadata.get("test_set_metrics", metadata.get("total_model_metrics", {})),
    }


@app.post("/predict", response_model=PredictionResponse)
async def predict(req: PredictionRequest):
    """
    Main prediction endpoint.
    Returns total + per-category predictions for the requested month/year.
    """
    if total_model is None:
        raise HTTPException(
            status_code=503,
            detail="No trained model available. Run train_model.ipynb first.",
        )

    # Validate inputs
    if not 1 <= req.month <= 12:
        raise HTTPException(status_code=400, detail="Month must be 1-12")
    if not 2020 <= req.year <= 2030:
        raise HTTPException(status_code=400, detail="Year must be 2020-2030")

    target_date = datetime(req.year, req.month, 1)

    # 1. Get model prediction for total spending
    total_pred = predict_total(target_date)

    # 2. Apply inflation adjustment if predicting future months
    now = datetime.now()
    if target_date > now:
        months_ahead = (target_date.year - now.year) * 12 + (target_date.month - now.month)
        yearly_rate = PH_INFLATION.get(target_date.year, 0.035)
        monthly_rate = yearly_rate / 12
        inflation_factor = (1 + monthly_rate) ** months_ahead
        total_pred["predicted"] *= inflation_factor
        total_pred["lower"] *= inflation_factor
        total_pred["upper"] *= inflation_factor

    total_predicted = round(total_pred["predicted"], 2)
    total_lower = round(total_pred["lower"], 2)
    total_upper = round(total_pred["upper"], 2)

    # 3. Get per-category predictions
    cat_preds = predict_categories(target_date, total_predicted)

    # 4. Get actual spending so far
    actual = get_user_expenses(req.user_id, req.month, req.year)
    spent_so_far = actual["total_spent"]

    # 5. Simple projected remaining = total - spent
    projected_remaining = max(0, total_predicted - spent_so_far)

    # 6. Budget status
    budget = req.monthly_budget or 10000
    if total_predicted > budget * 1.1:
        budget_status = "over_budget"
    elif total_predicted > budget * 0.9:
        budget_status = "near_budget"
    else:
        budget_status = "within_budget"

    # 7. Confidence level based on data availability
    training_months = metadata.get("training_months", 0)
    if training_months >= 12:
        confidence = "high"
    elif training_months >= 6:
        confidence = "medium"
    else:
        confidence = "low"

    return PredictionResponse(
        totalPredicted=total_predicted,
        totalPredictedLower=total_lower,
        totalPredictedUpper=total_upper,
        spentSoFar=round(spent_so_far, 2),
        projectedRemaining=round(projected_remaining, 2),
        budgetStatus=budget_status,
        confidenceLevel=confidence,
        predictionMethod="Prophet ML Model",
        categoryPredictions=cat_preds,
        categorySpent=actual["category_spent"],
        transactionCount=actual["transaction_count"],
        modelMetrics=metadata.get("test_set_metrics", metadata.get("total_model_metrics", {})),
    )


@app.get("/model-info")
async def model_info():
    """Returns model metadata and training info for the thesis."""
    if not metadata:
        raise HTTPException(status_code=404, detail="No model metadata found")
    return metadata


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("API_PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
