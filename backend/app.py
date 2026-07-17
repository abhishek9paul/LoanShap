from fastapi import FastAPI

from backend.api.predict import predict
from backend.ml.schemas import PredictionResponse

app = FastAPI(
    title="LoanShap API",
    version="1.0.0",
    description="Explainable AI Loan Approval Backend"
)

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
