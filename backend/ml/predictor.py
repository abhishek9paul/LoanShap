import sys
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import shap


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.ml.preprocessing import transform_new_applicant
from backend.ml.schemas import LoanApplicationRequest


MODELS_DIR = PROJECT_ROOT / "backend" / "models"
MODEL_PATH = MODELS_DIR / "xgboost_model.joblib"
PREPROCESSOR_PATH = MODELS_DIR / "preprocessing_artifacts.joblib"

_MODEL = joblib.load(MODEL_PATH)
_PREPROCESSING_ARTIFACTS = joblib.load(PREPROCESSOR_PATH)
_EXPLAINER = shap.TreeExplainer(_MODEL)


def _to_python(value: Any) -> Any:
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, np.ndarray):
        return value.tolist()
    return value


def _build_top_factors(applicant: dict[str, Any], transformed_row) -> list[dict[str, Any]]:
    shap_values = _EXPLAINER.shap_values(transformed_row)
    if isinstance(shap_values, list):
        shap_array = np.asarray(shap_values[1])[0]
    else:
        shap_array = np.asarray(shap_values)
        if shap_array.ndim == 3:
            shap_array = shap_array[0, :, 1]
        elif shap_array.ndim == 2:
            shap_array = shap_array[0]

    factors = []
    for feature_name, impact in zip(_PREPROCESSING_ARTIFACTS.feature_columns, shap_array):
        factors.append(
            {
                "feature": feature_name,
                "feature_value": _to_python(applicant[feature_name]),
                "impact": float(impact),
                "direction": "positive" if impact >= 0 else "negative",
            }
        )

    factors.sort(key=lambda item: abs(item["impact"]), reverse=True)
    return factors[:6]


def predict_loan(applicant: dict[str, Any]) -> dict[str, Any]:
    validated = LoanApplicationRequest.model_validate(applicant)
    applicant_data = validated.model_dump()
    transformed_row = transform_new_applicant(applicant_data, _PREPROCESSING_ARTIFACTS)

    prediction = int(_MODEL.predict(transformed_row)[0])
    probability = float(_MODEL.predict_proba(transformed_row)[0][1])
    confidence = probability if prediction == 1 else 1.0 - probability

    return {
        "prediction": prediction,
        "probability": probability,
        "confidence": float(confidence),
        "top_factors": _build_top_factors(applicant_data, transformed_row),
    }
