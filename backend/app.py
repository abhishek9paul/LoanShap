from fastapi import FastAPI

from api.explain import router as explain_router
from api.ask import router as ask_router
from api.predict import predict

from ml.schemas import PredictionResponse

app = FastAPI(
    title="LoanShap API",
    version="1.0.0",
    description="Explainable AI Loan Approval Backend"
)

app.include_router(explain_router)
app.include_router(ask_router)

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