from fastapi import APIRouter

from ml.predictor import predict_loan
from ml.schemas import LoanApplicationRequest, PredictionResponse


router = APIRouter(tags=["prediction"])


@router.post("/predict", response_model=PredictionResponse)
def predict(applicant: LoanApplicationRequest) -> PredictionResponse:
    result = predict_loan(applicant.model_dump())
    return PredictionResponse.model_validate(result)
