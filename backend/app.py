from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

# ------------------------------------------------------------
# CORS — required because the frontend (Vite, localhost:5173)
# and this API run on different origins. Without this, every
# fetch() from the browser fails with a CORS error even though
# curl/Postman requests work fine.
# ------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to ["http://localhost:5173"] before demo if you want
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