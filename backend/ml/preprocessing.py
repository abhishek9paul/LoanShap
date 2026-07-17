from dataclasses import dataclass
from pathlib import Path

import pandas as pd
from sklearn.preprocessing import OrdinalEncoder


DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "loan_data.csv"
TARGET_COLUMN = "loan_status"
CATEGORICAL_COLUMNS = [
    "person_gender",
    "person_education",
    "person_home_ownership",
    "loan_intent",
    "previous_loan_defaults_on_file",
]
NUMERICAL_COLUMNS = [
    "person_age",
    "person_income",
    "person_emp_exp",
    "loan_amnt",
    "loan_int_rate",
    "loan_percent_income",
    "cb_person_cred_hist_length",
    "credit_score",
]
FEATURE_COLUMNS = NUMERICAL_COLUMNS + CATEGORICAL_COLUMNS


@dataclass
class PreprocessingArtifacts:
    encoder: OrdinalEncoder
    categorical_columns: list[str]
    numerical_columns: list[str]
    feature_columns: list[str]
    target_column: str = TARGET_COLUMN


def load_dataset(data_path: Path | str = DATA_PATH) -> pd.DataFrame:
    return pd.read_csv(data_path)


def split_features_target(
    df: pd.DataFrame,
    target_column: str = TARGET_COLUMN,
) -> tuple[pd.DataFrame, pd.Series]:
    missing = set(FEATURE_COLUMNS + [target_column]) - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")
    features = df[FEATURE_COLUMNS].copy()
    target = df[target_column].copy()
    return features, target


def fit_preprocessor(features: pd.DataFrame) -> PreprocessingArtifacts:
    encoder = OrdinalEncoder(
        handle_unknown="use_encoded_value",
        unknown_value=-1,
        encoded_missing_value=-1,
    )
    encoder.fit(features[CATEGORICAL_COLUMNS])
    return PreprocessingArtifacts(
        encoder=encoder,
        categorical_columns=CATEGORICAL_COLUMNS.copy(),
        numerical_columns=NUMERICAL_COLUMNS.copy(),
        feature_columns=FEATURE_COLUMNS.copy(),
    )


def transform_features(
    features: pd.DataFrame,
    artifacts: PreprocessingArtifacts,
) -> pd.DataFrame:
    missing = set(artifacts.feature_columns) - set(features.columns)
    if missing:
        raise ValueError(f"Missing required feature columns: {sorted(missing)}")

    transformed = features[artifacts.feature_columns].copy()
    transformed[artifacts.categorical_columns] = artifacts.encoder.transform(
        transformed[artifacts.categorical_columns]
    )
    return transformed


def fit_transform_dataset(
    df: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.Series, PreprocessingArtifacts]:
    features, target = split_features_target(df)
    artifacts = fit_preprocessor(features)
    transformed_features = transform_features(features, artifacts)
    return transformed_features, target, artifacts


def transform_new_applicant(
    applicant_data: dict,
    artifacts: PreprocessingArtifacts,
) -> pd.DataFrame:
    applicant_df = pd.DataFrame([applicant_data])
    return transform_features(applicant_df, artifacts)


def load_and_preprocess_dataset(
    data_path: Path | str = DATA_PATH,
) -> tuple[pd.DataFrame, pd.Series, PreprocessingArtifacts]:
    df = load_dataset(data_path)
    return fit_transform_dataset(df)
