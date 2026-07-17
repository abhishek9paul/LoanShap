from pathlib import Path

import pandas as pd


DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "loan_data.csv"


def main() -> None:
    df = pd.read_csv(DATA_PATH)

    categorical_cols = df.select_dtypes(include=["object", "category", "string"]).columns.tolist()
    numerical_cols = df.select_dtypes(include=["number"]).columns.tolist()

    print(f"Dataset path: {DATA_PATH}")
    print(f"Shape: {df.shape}")
    print("\nColumn names:")
    print(df.columns.tolist())

    print("\nData types:")
    print(df.dtypes.to_string())

    print("\nMissing values:")
    print(df.isna().sum().to_string())

    print("\nClass distribution: loan_status")
    print(df["loan_status"].value_counts(dropna=False).to_string())

    print("\nCategorical columns:")
    print(categorical_cols)

    print("\nNumerical columns:")
    print(numerical_cols)


if __name__ == "__main__":
    main()
