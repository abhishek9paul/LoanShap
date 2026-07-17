from agents.prompts import build_prompt
from agents.groq_client import ask_groq

def explain(data):

    prompt = build_prompt(data)

    return ask_groq(prompt)