from fastapi import APIRouter
from pydantic import BaseModel

from agents.explainer import explain

router = APIRouter()

class Loan(BaseModel):
    prediction: dict

@router.post("/explain")
def explain_prediction(data: Loan):

    answer = explain(data.prediction)

    return {
        "explanation": answer
    }