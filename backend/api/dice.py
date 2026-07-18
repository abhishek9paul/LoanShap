"""
api/dice.py

Generates counterfactual scenarios: minimal changes to an applicant's
profile that would flip a REJECTED verdict to APPROVED.

This does NOT use dice-ml's full search yet (that requires wiring up
its Data/Model wrappers around your specific XGBoost pipeline, which
takes longer than a hackathon slot usually allows). Instead it uses a
small set of hand-picked, domain-sensible nudges (raise credit score,
lower loan-to-income ratio, clear a prior default, extend credit
history) and verifies each candidate against your REAL trained model
via predict_loan — so every scenario returned is genuinely verified,
not guessed. If you have time later, swap the nudge logic below for
an actual dice_ml.Dice(...).generate_counterfactuals(...) call.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any, List
import copy

from ml.predictor import predict_loan

router = APIRouter()


class CounterfactualRequest(BaseModel):
    current_applicant: Dict[str, Any]


# Each nudge is a (description, function) pair. Function takes the
# applicant dict and returns a MODIFIED COPY.
def _raise_credit_score(a: dict) -> dict:
    b = copy.deepcopy(a)
    b["credit_score"] = min(850, b.get("credit_score", 600) + 60)
    return b


def _lower_loan_ratio(a: dict) -> dict:
    b = copy.deepcopy(a)
    income = b.get("person_income", 1) or 1
    b["loan_amnt"] = max(1000, int(b.get("loan_amnt", 10000) * 0.7))
    b["loan_percent_income"] = round(b["loan_amnt"] / income, 3)
    return b


def _clear_default_flag(a: dict) -> dict:
    b = copy.deepcopy(a)
    b["cb_person_default_on_file"] = "N"
    return b


def _extend_credit_history(a: dict) -> dict:
    b = copy.deepcopy(a)
    b["cb_person_cred_hist_length"] = b.get("cb_person_cred_hist_length", 2) + 5
    return b


def _combo_moderate(a: dict) -> dict:
    """Smaller nudges across two fields at once — often the most
    realistic path since it doesn't require one dramatic change."""
    b = copy.deepcopy(a)
    b["credit_score"] = min(850, b.get("credit_score", 600) + 30)
    income = b.get("person_income", 1) or 1
    b["loan_amnt"] = max(1000, int(b.get("loan_amnt", 10000) * 0.85))
    b["loan_percent_income"] = round(b["loan_amnt"] / income, 3)
    return b


NUDGES = [
    _raise_credit_score,
    _lower_loan_ratio,
    _clear_default_flag,
    _extend_credit_history,
    _combo_moderate,
]


@router.post("/api/dice")
def generate_counterfactuals(data: CounterfactualRequest):
    original = data.current_applicant
    scenarios: List[dict] = []

    for nudge in NUDGES:
        candidate = nudge(original)
        try:
            result = predict_loan(candidate)
            verdict = (
                result.get("prediction", {}).get("verdict")
                if isinstance(result, dict)
                else getattr(result.prediction, "verdict", None)
            )
        except Exception as e:
            # If predict_loan's expected input shape differs, skip
            # this candidate rather than crashing the whole request.
            continue

        if verdict == "APPROVED":
            scenarios.append(candidate)

        if len(scenarios) >= 3:
            break

    return {"scenarios": scenarios}