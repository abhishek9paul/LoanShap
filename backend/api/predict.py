from fastapi import APIRouter

from backend.ml.predictor import predict_loan
from backend.ml.schemas import LoanApplicationRequest, PredictionResponse


router = APIRouter(tags=["prediction"])


@router.post("/predict", response_model=PredictionResponse)
def predict(applicant: LoanApplicationRequest) -> PredictionResponse:
    result = predict_loan(applicant.model_dump())
    return PredictionResponse.model_validate(result)
