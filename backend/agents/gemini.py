import google.generativeai as genai

from config import API_KEY

genai.configure(api_key=API_KEY)

model = genai.GenerativeModel("gemini-2.5-flash-lite")



def ask_gemini(prompt):

    response = model.generate_content(prompt)

    return response.text