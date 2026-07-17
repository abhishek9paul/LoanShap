import json
import sys
from pathlib import Path

import joblib
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.ml.preprocessing import FEATURE_COLUMNS, load_and_preprocess_dataset


MODELS_DIR = PROJECT_ROOT / "backend" / "models"
MODEL_PATH = MODELS_DIR / "xgboost_model.joblib"
PREPROCESSOR_PATH = MODELS_DIR / "preprocessing_artifacts.joblib"
FEATURES_PATH = MODELS_DIR / "feature_columns.json"


def train_model() -> dict[str, float]:
    features, target, preprocessing_artifacts = load_and_preprocess_dataset()

    X_train, X_test, y_train, y_test = train_test_split(
        features,
        target,
        test_size=0.2,
        random_state=42,
        stratify=target,
    )

    model = XGBClassifier(
        n_estimators=150,
        max_depth=5,
        learning_rate=0.1,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=42,
    )
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    probabilities = model.predict_proba(X_test)[:, 1]
    metrics = {
        "accuracy": float(accuracy_score(y_test, predictions)),
        "roc_auc": float(roc_auc_score(y_test, probabilities)),
    }

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    joblib.dump(preprocessing_artifacts, PREPROCESSOR_PATH)
    FEATURES_PATH.write_text(json.dumps(FEATURE_COLUMNS, indent=2), encoding="utf-8")

    return metrics


def main() -> None:
    metrics = train_model()
    print(f"Saved model to: {MODEL_PATH}")
    print(f"Saved preprocessing artifacts to: {PREPROCESSOR_PATH}")
    print(f"Saved feature columns to: {FEATURES_PATH}")
    print(f"Accuracy: {metrics['accuracy']:.4f}")
    print(f"ROC-AUC: {metrics['roc_auc']:.4f}")


if __name__ == "__main__":
    main()
