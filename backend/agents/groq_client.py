from groq import Groq
from config import API_KEY

client = Groq(api_key=API_KEY)

def ask_groq(prompt):
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role":"system",
                "content":"You explain loan decisions using only the provided data."
            },
            {
                "role":"user",
                "content":prompt
            }
        ]
    )

    return response.choices[0].message.content