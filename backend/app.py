from fastapi import FastAPI

from api.explain import router

app = FastAPI()

app.include_router(router)


@app.get("/")
def home():

    return {"status":"LoanShap Running"}