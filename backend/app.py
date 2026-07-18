from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from api.explain import router as explain_router
from api.ask import router as ask_router
from api.predict import predict
from api.dice import router as dice_router

from ml.schemas import PredictionResponse

app = FastAPI(
    title="LoanShap API",
    version="1.0.0",
    description="Explainable AI Loan Approval Backend"
)

# CORS — required since the frontend and this API run on different origins.
# Set ALLOWED_ORIGINS (comma-separated) in production; defaults to "*" for local dev.
_origins = os.getenv("ALLOWED_ORIGINS", "*")
allow_origins = ["*"] if _origins == "*" else [o.strip() for o in _origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(explain_router)
app.include_router(ask_router)
app.include_router(dice_router)

app.add_api_route(
    "/predict",
    predict,
    methods=["POST"],
    response_model=PredictionResponse,
    tags=["prediction"],
)

@app.get("/")
def home():
    return {
        "project": "LoanShap",
        "status": "Running",
        "version": "1.0.0"
    }