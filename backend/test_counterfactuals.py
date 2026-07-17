from ml.counterfactuals import generate_counterfactuals
from ml.schemas import (
    PersonGender, PersonEducation, HomeOwnership, LoanIntent, PreviousLoanDefault
)

sample = {
    "person_age": 28,
    "person_gender": "male",
    "person_education": "Bachelor",
    "person_income": 65000,
    "person_emp_exp": 4,
    "person_home_ownership": "RENT",
    "loan_amnt": 12000,
    "loan_intent": "EDUCATION",
    "loan_int_rate": 11.5,
    "loan_percent_income": 0.18,
    "cb_person_cred_hist_length": 5,
    "credit_score": 680,
    "previous_loan_defaults_on_file": "No"
}

print(generate_counterfactuals(sample))