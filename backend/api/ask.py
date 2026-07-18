from fastapi import APIRouter
from pydantic import BaseModel
from agents.groq_client import ask_groq
from agents.prompts import build_chat_prompt, LEDGER_SYSTEM_PROMPT

router = APIRouter()

class Question(BaseModel):
    question: str
    context: dict

@router.post("/ask")
def ask(data: Question):

    prompt = build_chat_prompt(data.question, data.context)
    answer = ask_groq(prompt, system_prompt=LEDGER_SYSTEM_PROMPT)

    return {
        "answer": answer
    }