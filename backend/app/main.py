from fastapi import FastAPI

app = FastAPI(
    title="LinkSnip API",
    description="Free URL Shortening and Analytics Platform",
    version="1.0.0",
)


@app.get("/")
def root():
    return {
        "message": "LinkSnip API is running",
        "version": "1.0.0",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }