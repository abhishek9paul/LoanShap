from fastapi import FastAPI

<<<<<<< HEAD
from api.explain import router

app = FastAPI()

app.include_router(router)

=======
from backend.api.predict import predict
from backend.ml.schemas import PredictionResponse

app = FastAPI(
    title="LoanShap API",
    version="1.0.0",
    description="Explainable AI Loan Approval Backend"
)
>>>>>>> f4ba8d46f79a8f006a49d20f3103c20634d94d56

app.add_api_route(
    "/predict",
    predict,
    methods=["POST"],
    response_model=PredictionResponse,
    tags=["prediction"],
)

@app.get("/")
def home():
<<<<<<< HEAD

    return {"status":"LoanShap Running"}
=======
    return {
        "project": "LoanShap",
        "status": "Running",
        "version": "1.0.0"
    }
>>>>>>> f4ba8d46f79a8f006a49d20f3103c20634d94d56
