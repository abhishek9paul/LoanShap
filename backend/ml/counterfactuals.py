import sys
from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import Any, cast

import joblib
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    from backend.ml.preprocessing import (
        DATA_PATH,
        FEATURE_COLUMNS,
        NUMERICAL_COLUMNS,
        PreprocessingArtifacts,
        load_dataset,
        transform_new_applicant,
    )
    from backend.ml.schemas import LoanApplicationRequest
except ImportError:  # pragma: no cover - supports existing script-style imports
    from ml.preprocessing import (
        DATA_PATH,
        FEATURE_COLUMNS,
        NUMERICAL_COLUMNS,
        PreprocessingArtifacts,
        load_dataset,
        transform_new_applicant,
    )
    from ml.schemas import LoanApplicationRequest


MODELS_DIR = PROJECT_ROOT / "backend" / "models"
MODEL_PATH = MODELS_DIR / "xgboost_model.joblib"
PREPROCESSOR_PATH = MODELS_DIR / "preprocessing_artifacts.joblib"
MAX_RUPEE_VALUE = 800_000.0
MAX_COUNTERFACTUALS = 3
COUNTERFACTUAL_SEARCH_COUNT = 9
INT_LIKE_COLUMNS = {"person_emp_exp", "credit_score"}
RATIO_COLUMNS = {"loan_percent_income"}
FLOAT_PRECISION = 4
DISPLAY_NAMES = {
    "person_age": "Person Age",
    "person_income": "Annual Income",
    "person_emp_exp": "Employment Experience",
    "loan_amnt": "Loan Amount",
    "loan_int_rate": "Interest Rate",
    "loan_percent_income": "Loan Percent of Income",
    "cb_person_cred_hist_length": "Credit History Length",
    "credit_score": "Credit Score",
    "person_gender": "Gender",
    "person_education": "Education",
    "person_home_ownership": "Home Ownership",
    "loan_intent": "Loan Purpose",
    "previous_loan_defaults_on_file": "Previous Loan Default On File",
}


try:
    import dice_ml
except ImportError:  # pragma: no cover - depends on runtime environment
    dice_ml = None


class _PreprocessedModelWrapper:
    def __init__(self, model, artifacts: PreprocessingArtifacts):
        self._model = model
        self._artifacts = artifacts

    def _transform_record(self, record: dict[str, Any]) -> pd.DataFrame:
        return transform_new_applicant(record, self._artifacts)

    def _transform(self, rows: pd.DataFrame | dict[str, Any]) -> pd.DataFrame:
        if isinstance(rows, pd.DataFrame):
            records = cast(list[dict[str, Any]], rows.to_dict(orient="records"))
            transformed_rows = [self._transform_record(record) for record in records]
            return pd.concat(transformed_rows, ignore_index=True)
        return self._transform_record(rows)

    def predict(self, rows: pd.DataFrame | dict[str, Any]):
        return self._model.predict(self._transform(rows))

    def predict_proba(self, rows: pd.DataFrame | dict[str, Any]):
        return self._model.predict_proba(self._transform(rows))


def _to_python(value: Any) -> Any:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    item = getattr(value, "item", None)
    if callable(item):
        try:
            return item()
        except (ValueError, TypeError):
            pass
    tolist = getattr(value, "tolist", None)
    if callable(tolist):
        try:
            return tolist()
        except TypeError:
            pass
    return value


def _round_numeric(value: float, column: str) -> int | float:
    if column in INT_LIKE_COLUMNS:
        return int(round(value))
    if column in RATIO_COLUMNS:
        return round(value, FLOAT_PRECISION)
    return round(value, 2)


def _convert_enums(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    return value


def _clamp_currency_fields(applicant: dict[str, Any]) -> dict[str, Any]:
    sanitized = {key: _convert_enums(value) for key, value in dict(applicant).items()}
    for column in ("person_income", "loan_amnt"):
        if column in sanitized:
            sanitized[column] = min(float(sanitized[column]), MAX_RUPEE_VALUE)
    return sanitized


def _normalize_applicant(applicant: dict[str, Any]) -> dict[str, Any]:
    validated = LoanApplicationRequest.model_validate(_clamp_currency_fields(applicant))
    normalized = validated.model_dump(mode="json")
    normalized["person_income"] = _round_numeric(float(normalized["person_income"]), "person_income")
    normalized["loan_amnt"] = _round_numeric(float(normalized["loan_amnt"]), "loan_amnt")
    normalized["loan_percent_income"] = _round_numeric(
        float(normalized["loan_percent_income"]),
        "loan_percent_income",
    )
    return normalized


@lru_cache(maxsize=1)
def _load_model():
    return joblib.load(MODEL_PATH)


@lru_cache(maxsize=1)
def _load_wrapped_model() -> _PreprocessedModelWrapper:
    return _PreprocessedModelWrapper(_load_model(), _load_preprocessing_artifacts())


@lru_cache(maxsize=1)
def _load_preprocessing_artifacts() -> PreprocessingArtifacts:
    return joblib.load(PREPROCESSOR_PATH)


@lru_cache(maxsize=1)
def _load_counterfactual_dataset() -> pd.DataFrame:
    dataset = load_dataset(DATA_PATH)
    return dataset[FEATURE_COLUMNS + ["loan_status"]].copy()


@lru_cache(maxsize=1)
def _get_allowed_categorical_values() -> dict[str, set[str]]:
    artifacts = _load_preprocessing_artifacts()
    return {
        column: {str(value) for value in artifacts.encoder.categories_[index]} # pyright: ignore[reportGeneralTypeIssues]
        for index, column in enumerate(artifacts.categorical_columns)
    }


def _get_permitted_range() -> dict[str, list[float]]:
    dataset = _load_counterfactual_dataset()
    return {
        "person_income": [0.0, min(MAX_RUPEE_VALUE, float(dataset["person_income"].max()))],
        "loan_amnt": [0.0, min(MAX_RUPEE_VALUE, float(dataset["loan_amnt"].max()))],
    }


@lru_cache(maxsize=1)
def _get_dice_components():
    if dice_ml is None:  # pragma: no cover - depends on runtime environment
        raise ImportError(
            "dice-ml is required for counterfactual generation. "
            "Install it in the backend environment before calling generate_counterfactuals."
        )

    dataset = _load_counterfactual_dataset()
    data = dice_ml.Data(
        dataframe=dataset,
        continuous_features=NUMERICAL_COLUMNS,
        outcome_name="loan_status",
    )
    model = dice_ml.Model(model=_load_wrapped_model(), backend="sklearn")
    dice = dice_ml.Dice(data, model, method="random")
    return data, model, dice


def _coerce_counterfactual_row(
    row: pd.Series,
    base_applicant: dict[str, Any],
) -> dict[str, Any]:
    artifacts = _load_preprocessing_artifacts()
    allowed_categorical_values = _get_allowed_categorical_values()
    candidate: dict[str, Any] = {}

    for column in artifacts.feature_columns:
        value = _to_python(row[column])
        if column in artifacts.categorical_columns:
            allowed_values = allowed_categorical_values[column]
            if str(value) not in allowed_values:
                value = base_applicant[column]
            candidate[column] = str(value)
            continue

        numeric_value = float(value)
        if column in ("person_income", "loan_amnt"):
            numeric_value = min(numeric_value, MAX_RUPEE_VALUE)
        candidate[column] = _round_numeric(numeric_value, column)

    return _normalize_applicant(candidate)


def _build_change_list(
    original: dict[str, Any],
    candidate: dict[str, Any],
) -> list[dict[str, Any]]:
    changes: list[dict[str, Any]] = []

    for column in FEATURE_COLUMNS:
        before = _to_python(original[column])
        after = _to_python(candidate[column])
        if before == after:
            continue

        changes.append(
            {
                "feature": column,
                "display_name": DISPLAY_NAMES.get(column, column),
                "current": before,
                "recommended": after,
            }
        )

    return changes


def _build_counterfactual_response(
    original: dict[str, Any],
    candidate: dict[str, Any],
) -> dict[str, Any]:
    probability = float(_load_wrapped_model().predict_proba(pd.DataFrame([candidate]))[0][1])
    return {
        "changes": _build_change_list(original, candidate),
        "approved_probability": round(probability, FLOAT_PRECISION),
    }


def _get_approved_probability(candidate: dict[str, Any]) -> float:
    return float(_load_wrapped_model().predict_proba(pd.DataFrame([candidate]))[0][1])


def _refine_counterfactual_candidate(
    original: dict[str, Any],
    candidate: dict[str, Any],
    model: _PreprocessedModelWrapper,
) -> dict[str, Any]:
    refined_candidate = dict(candidate)
    current_probability = _get_approved_probability(refined_candidate)

    for column in FEATURE_COLUMNS:
        if refined_candidate[column] == original[column]:
            continue

        trial_candidate = dict(refined_candidate)
        trial_candidate[column] = original[column]
        trial_candidate = _normalize_applicant(trial_candidate)

        trial_prediction = int(_to_python(model.predict(pd.DataFrame([trial_candidate]))[0]))
        if trial_prediction != 1:
            continue

        trial_probability = _get_approved_probability(trial_candidate)
        if trial_probability >= current_probability:
            refined_candidate = trial_candidate
            current_probability = trial_probability

    return refined_candidate


def generate_counterfactuals(applicant: dict[str, Any]) -> list[dict[str, Any]]:
    original = _normalize_applicant(applicant)
    original_row = pd.DataFrame([original])
    model = _load_wrapped_model()

    current_prediction = int(_to_python(model.predict(original_row)[0]))
    if current_prediction == 1:
        return []

    _, _, dice = _get_dice_components()
    query_instance = pd.DataFrame([original])

    dice_generate_kwargs = cast(
        dict[str, Any],
        {
            "query_instances": query_instance,
            "total_CFs": COUNTERFACTUAL_SEARCH_COUNT,
            "desired_class": "opposite",
            "features_to_vary": FEATURE_COLUMNS,
            "permitted_range": _get_permitted_range(),
            "verbose": False,
        },
    )
    counterfactual_examples = dice.generate_counterfactuals(**dice_generate_kwargs)

    cf_frame = counterfactual_examples.cf_examples_list[0].final_cfs_df
    if cf_frame is None or cf_frame.empty:
        raise ValueError(
            f"Expected exactly {MAX_COUNTERFACTUALS} approved counterfactuals, "
            "but DiCE returned none."
        )

    responses: list[dict[str, Any]] = []
    seen_signatures: set[tuple[tuple[str, Any], ...]] = set()

    for _, row in cf_frame.iterrows():
        candidate = _coerce_counterfactual_row(row, original)
        prediction = int(_to_python(model.predict(pd.DataFrame([candidate]))[0]))
        if prediction != 1:
            continue

        candidate = _refine_counterfactual_candidate(original, candidate, model)

        changes = _build_change_list(original, candidate)
        if not changes:
            continue

        signature = tuple((change["feature"], change["recommended"]) for change in changes)
        if signature in seen_signatures:
            continue
        seen_signatures.add(signature)

        responses.append(_build_counterfactual_response(original, candidate))
        if len(responses) == MAX_COUNTERFACTUALS:
            break

    if len(responses) != MAX_COUNTERFACTUALS:
        raise ValueError(
            f"Expected exactly {MAX_COUNTERFACTUALS} approved counterfactuals, "
            f"but generated {len(responses)}."
        )

    return responses
