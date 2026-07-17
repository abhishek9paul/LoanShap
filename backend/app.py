from fastapi import FastAPI

app = FastAPI(
    title="LoanShap API",
    version="1.0.0",
    description="Explainable AI Loan Approval Backend"
)

@app.get("/")
def home():
    return {
        "project": "LoanShap",
        "status": "Running",
        "version": "1.0.0"
    }