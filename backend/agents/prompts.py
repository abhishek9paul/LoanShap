def build_prompt(data):

    return f"""
Explain this loan prediction.

Prediction:

{data}

Explain:

1. Why approved/rejected
2. Positive factors
3. Negative factors

Maximum 100 words.
"""