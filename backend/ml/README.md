# ML Backend Design

## Goal

Provide a minimal loan approval prediction service with SHAP explanations that can be plugged into the FastAPI backend without forcing the frontend or API team to understand ML internals.

## Scope

This folder should own only:

- loading training data
- training and saving one model
- loading saved artifacts for inference
- returning prediction probabilities
- returning top SHAP feature contributions for one prediction

This folder should not own:

- FastAPI routing
- frontend formatting logic
- LLM-generated explanations
- authentication or database concerns

## Recommended File Layout

```text
backend/ml/
  README.md
  schemas.py
  preprocess.py
  train.py
  predictor.py
  explainer.py
  artifacts/
    model.joblib
    preprocessor.joblib
    feature_columns.json
```

## Dataset Contract

Source file:

- `backend/data/loan_data.csv`

Target column:

- `loan_status`

Input features:

- `person_age`
- `person_gender`
- `person_education`
- `person_income`
- `person_emp_exp`
- `person_home_ownership`
- `loan_amnt`
- `loan_intent`
- `loan_int_rate`
- `loan_percent_income`
- `cb_person_cred_hist_length`
- `credit_score`
- `previous_loan_defaults_on_file`

## Simple Modeling Choice

Use one tree-based binary classifier only.

Recommended order:

1. `XGBClassifier` if it behaves cleanly with your environment.
2. `RandomForestClassifier` fallback if XGBoost setup becomes slow or brittle.

Reason:

- tree models are fast for hackathon-scale tabular data
- SHAP works naturally with tree models
- you avoid complex feature engineering

## Preprocessing Plan

Keep preprocessing explicit and small:

- numeric columns: passthrough
- categorical columns: `OneHotEncoder(handle_unknown="ignore")`
- combine with `ColumnTransformer`

Persist the fitted preprocessor separately from the model so inference is deterministic.

## Training Output Contract

Training should save:

- `model.joblib`
- `preprocessor.joblib`
- `feature_columns.json`

Optional metadata later if needed:

- model version
- train accuracy
- test accuracy
- ROC AUC

## Inference Contract

Person C should be able to call one ML service function with a plain dict payload.

Suggested internal function:

```python
predict_loan_application(payload: dict) -> dict
```

Suggested response shape:

```json
{
  "prediction": 1,
  "approval_label": "approved",
  "probability": 0.82,
  "risk_level": "low",
  "top_factors": [
    { "feature": "credit_score", "impact": 0.19, "direction": "positive" },
    { "feature": "loan_percent_income", "impact": -0.11, "direction": "negative" },
    { "feature": "previous_loan_defaults_on_file", "impact": -0.08, "direction": "negative" }
  ]
}
```

Notes:

- `prediction` should remain numeric for backend logic.
- `approval_label` is frontend-friendly.
- `probability` should mean probability of approval.
- `top_factors` should contain only the top 3 to 5 items to keep the UI simple.

## SHAP Contract

Use SHAP only at inference time for a single record, not for batch explanations.

Suggested internal function:

```python
explain_prediction(payload: dict) -> list[dict]
```

Output each factor as:

```json
{
  "feature": "credit_score",
  "feature_value": 720,
  "impact": 0.19,
  "direction": "positive"
}
```

Implementation rule:

- sort by absolute SHAP value descending
- return a small top-N list
- hide encoded column names from API consumers if possible

## API Contract For Person C

Person C can expose two simple endpoints:

### `POST /predict`

Request body:

```json
{
  "person_age": 28,
  "person_gender": "male",
  "person_education": "Bachelor",
  "person_income": 65000,
  "person_emp_exp": 4,
  "person_home_ownership": "RENT",
  "loan_amnt": 12000,
  "loan_intent": "EDUCATION",
  "loan_int_rate": 10.5,
  "loan_percent_income": 0.18,
  "cb_person_cred_hist_length": 5,
  "credit_score": 710,
  "previous_loan_defaults_on_file": "No"
}
```

Response body:

```json
{
  "prediction": 1,
  "approval_label": "approved",
  "probability": 0.82,
  "risk_level": "low",
  "top_factors": []
}
```

### `POST /explain`

Use the same request body as `/predict`.

Response body:

```json
{
  "prediction": 1,
  "probability": 0.82,
  "top_factors": [
    { "feature": "credit_score", "feature_value": 710, "impact": 0.19, "direction": "positive" }
  ]
}
```

If Person C wants fewer endpoints, `/predict` alone can include `top_factors` and `/explain` can be skipped.

## Frontend Contract For Person B

Person B should only need:

- one form payload matching the feature names above
- one numeric probability
- one status label
- one short list of explanation factors

Frontend should not need:

- raw SHAP arrays
- encoded feature names
- model-specific details

## Recommended Pydantic Shape

Keep request validation strict and shared with Person C:

- numeric fields as `int` or `float`
- categorical fields as `str`
- no extra fields

If time permits, add enum validation for:

- `person_gender`
- `person_education`
- `person_home_ownership`
- `loan_intent`
- `previous_loan_defaults_on_file`

## Hackathon Constraints

To stay fast and reliable:

- train offline, not on API startup if avoidable
- load artifacts once on startup
- use one model only
- avoid background jobs
- avoid async ML code
- avoid storing predictions unless another teammate needs it

## Recommended Build Order

1. Define request and response schema.
2. Train one baseline model and save artifacts.
3. Implement local prediction function.
4. Add SHAP top-factor extraction.
5. Hand clean input and output contract to Person C.
6. Let Person B wire the form and results screen against mock JSON first.

## Team Handoff Summary

You own:

- feature schema
- trained artifacts
- prediction logic
- SHAP factor extraction

Person C owns:

- FastAPI routes
- request validation integration
- route error handling
- optional LLM explanation endpoint

Person B owns:

- form UI
- result cards
- factor visualization

## Do Not Overbuild

For this hackathon, avoid:

- multiple model experiments exposed in the API
- live retraining
- complex feature stores
- large explanation payloads
- separate microservices for ML

One model, one payload shape, one clean response contract is enough.
