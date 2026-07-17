from fastapi import APIRouter
from pydantic import BaseModel
from agents.groq_client import ask_groq

router = APIRouter()

class Question(BaseModel):
    question: str
    context: dict

@router.post("/ask")
def ask(data: Question):

    prompt = f"""
You are LoanShap.

Prediction Context:
{data.context}

User Question:
{data.question}

Answer using ONLY the prediction context.
If the answer cannot be determined, say so.
"""

    answer = ask_groq(prompt)

    return {
        "answer": answer
    }