from backend.ml.predictor import predict_loan
from backend.ml.schemas import (
    LoanApplicationRequest,
    PersonGender,
    PersonEducation,
    HomeOwnership,
    LoanIntent,
    PreviousLoanDefault,
)

person_gender=PersonGender.MALE
person_education=PersonEducation.BACHELOR
person_home_ownership=HomeOwnership.RENT
loan_intent=LoanIntent.EDUCATION
previous_loan_defaults_on_file=PreviousLoanDefault.NO

applicant = LoanApplicationRequest(
    person_age=28,
    person_gender=PersonGender.MALE,
    person_education=PersonEducation.BACHELOR,
    person_income=65000,
    person_emp_exp=4,
    person_home_ownership=HomeOwnership.RENT,
    loan_amnt=12000,
    loan_intent=LoanIntent.EDUCATION,
    loan_int_rate=11.5,
    loan_percent_income=0.18,
    cb_person_cred_hist_length=5,
    credit_score=680,
    previous_loan_defaults_on_file=PreviousLoanDefault.NO
)

result = predict_loan(applicant.model_dump())

print(result)