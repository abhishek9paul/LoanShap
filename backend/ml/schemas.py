from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class PersonGender(str, Enum):
    FEMALE = "female"
    MALE = "male"


class PersonEducation(str, Enum):
    ASSOCIATE = "Associate"
    BACHELOR = "Bachelor"
    DOCTORATE = "Doctorate"
    HIGH_SCHOOL = "High School"
    MASTER = "Master"


class HomeOwnership(str, Enum):
    MORTGAGE = "MORTGAGE"
    OTHER = "OTHER"
    OWN = "OWN"
    RENT = "RENT"


class LoanIntent(str, Enum):
    DEBT_CONSOLIDATION = "DEBTCONSOLIDATION"
    EDUCATION = "EDUCATION"
    HOME_IMPROVEMENT = "HOMEIMPROVEMENT"
    MEDICAL = "MEDICAL"
    PERSONAL = "PERSONAL"
    VENTURE = "VENTURE"


class PreviousLoanDefault(str, Enum):
    NO = "No"
    YES = "Yes"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ShapDirection(str, Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"


class LoanApplicationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    person_age: float = Field(..., gt=0, description="Applicant age in years.")
    person_gender: PersonGender
    person_education: PersonEducation
    person_income: float = Field(..., ge=0, description="Annual income.")
    person_emp_exp: int = Field(..., ge=0, description="Employment experience in years.")
    person_home_ownership: HomeOwnership
    loan_amnt: float = Field(..., gt=0, description="Requested loan amount.")
    loan_intent: LoanIntent
    loan_int_rate: float = Field(..., ge=0, description="Loan interest rate percentage.")
    loan_percent_income: float = Field(
        ...,
        ge=0,
        description="Loan amount as a fraction of income.",
    )
    cb_person_cred_hist_length: float = Field(
        ...,
        ge=0,
        description="Credit history length in years.",
    )
    credit_score: int = Field(..., ge=0, description="Applicant credit score.")
    previous_loan_defaults_on_file: PreviousLoanDefault


class ShapFactor(BaseModel):
    model_config = ConfigDict(extra="forbid")

    feature: str
    display_name: str
    impact: float
    direction: ShapDirection
    feature_value: str | int | float | None = None


class PredictionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prediction: int = Field(..., description="Binary prediction where 1 means approved.")
    approval_label: str = Field(..., description="Frontend-friendly label.")
    probability: float = Field(
        ...,
        ge=0,
        le=1,
        description="Probability of loan approval.",
    )
    risk_level: RiskLevel
    positive_factors: list[ShapFactor] = Field(default_factory=list)
    negative_factors: list[ShapFactor] = Field(default_factory=list)


class ExplanationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prediction: int = Field(..., description="Binary prediction where 1 means approved.")
    probability: float = Field(
        ...,
        ge=0,
        le=1,
        description="Probability of loan approval.",
    )
    top_factors: list[ShapFactor] = Field(default_factory=list)
