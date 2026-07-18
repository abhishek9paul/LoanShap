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
    b["previous_loan_defaults_on_file"] = "No"
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
    errors = 0

    for nudge in NUDGES:
        candidate = nudge(original)
        try:
            result = predict_loan(candidate)
            # predict_loan() returns PredictionResponse.model_dump(mode="json"),
            # i.e. a FLAT dict like {"prediction": 1, "approval_label": "approved", ...}.
            # There is no nested result["prediction"]["verdict"] — "prediction" is
            # just the raw int (0/1). approval_label is the human-readable field
            # ("approved" / "rejected") and is what we actually want here.
            verdict = result.get("approval_label") if isinstance(result, dict) else None
        except Exception as e:
            # If predict_loan's expected input shape differs, skip this
            # candidate rather than crashing the whole request — but log
            # it, otherwise an all-failing run looks identical to an
            # all-succeeding-but-no-flip run from the outside.
            errors += 1
            print(f"[dice] {nudge.__name__} failed: {type(e).__name__}: {e}")

            continue

        if verdict == "approved":
            scenarios.append(candidate)

        if len(scenarios) >= 3:
            break

    return {"scenarios": scenarios, "errors": errors}