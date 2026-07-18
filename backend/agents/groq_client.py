from groq import Groq
from config import API_KEY

client = Groq(api_key=API_KEY)

DEFAULT_SYSTEM_PROMPT = "You explain loan decisions using only the provided data."

def ask_groq(prompt, system_prompt: str = DEFAULT_SYSTEM_PROMPT):
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    return response.choices[0].message.content