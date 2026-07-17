import sys
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import shap


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.preprocessing import transform_new_applicant
from ml.schemas import (
    LoanApplicationRequest,
    PredictionResponse,
    RiskLevel,
    ShapDirection,
    ShapFactor,
)


MODELS_DIR = PROJECT_ROOT / "backend" / "models"
MODEL_PATH = MODELS_DIR / "xgboost_model.joblib"
PREPROCESSOR_PATH = MODELS_DIR / "preprocessing_artifacts.joblib"

_MODEL = joblib.load(MODEL_PATH)
_PREPROCESSING_ARTIFACTS = joblib.load(PREPROCESSOR_PATH)
_EXPLAINER = shap.TreeExplainer(_MODEL)
_FEATURE_DISPLAY_NAMES = {
    "person_age": "Person Age",
    "person_gender": "Gender",
    "person_education": "Education",
    "person_income": "Annual Income",
    "person_emp_exp": "Employment Experience",
    "person_home_ownership": "Home Ownership",
    "loan_amnt": "Loan Amount",
    "loan_intent": "Loan Purpose",
    "loan_int_rate": "Interest Rate",
    "loan_percent_income": "Loan Percent of Income",
    "cb_person_cred_hist_length": "Credit History Length",
    "credit_score": "Credit Score",
    "previous_loan_defaults_on_file": "Previous Loan Default On File",
}


def _to_python(value: Any) -> Any:
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, np.ndarray):
        return value.tolist()
    return value


def _get_risk_level(probability: float) -> RiskLevel:
    if probability >= 0.7:
        return RiskLevel.LOW
    if probability >= 0.4:
        return RiskLevel.MEDIUM
    return RiskLevel.HIGH


def _build_top_factors(
    applicant: dict[str, Any],
    transformed_row,
) -> tuple[list[ShapFactor], list[ShapFactor]]:
    shap_values = _EXPLAINER.shap_values(transformed_row)
    if isinstance(shap_values, list):
        shap_array = np.asarray(shap_values[1])[0]
    else:
        shap_array = np.asarray(shap_values)
        if shap_array.ndim == 3:
            shap_array = shap_array[0, :, 1]
        elif shap_array.ndim == 2:
            shap_array = shap_array[0]

    factors: list[ShapFactor] = []
    for feature_name, impact in zip(_PREPROCESSING_ARTIFACTS.feature_columns, shap_array):
        factors.append(
            ShapFactor(
                feature=feature_name,
                display_name=_FEATURE_DISPLAY_NAMES.get(feature_name, feature_name),
                feature_value=_to_python(applicant[feature_name]),
                impact=float(_to_python(impact)),
                direction=ShapDirection.POSITIVE if impact >= 0 else ShapDirection.NEGATIVE,
            )
        )

    factors.sort(key=lambda item: abs(item.impact), reverse=True)
    top_factors = factors[:6]
    positive_factors = [factor for factor in top_factors if factor.impact >= 0]
    negative_factors = [factor for factor in top_factors if factor.impact < 0]
    return positive_factors, negative_factors


def predict_loan(applicant: dict[str, Any]) -> dict[str, Any]:
    validated = LoanApplicationRequest.model_validate(applicant)
    applicant_data = validated.model_dump()
    transformed_row = transform_new_applicant(applicant_data, _PREPROCESSING_ARTIFACTS)

    prediction = int(_to_python(_MODEL.predict(transformed_row)[0]))
    probability = float(_to_python(_MODEL.predict_proba(transformed_row)[0][1]))
    positive_factors, negative_factors = _build_top_factors(applicant_data, transformed_row)
    response = PredictionResponse(
        prediction=prediction,
        approval_label="approved" if prediction == 1 else "rejected",
        probability=probability,
        risk_level=_get_risk_level(probability),
        positive_factors=positive_factors,
        negative_factors=negative_factors,
    )
    return response.model_dump(mode="json")
