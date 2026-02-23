from fastapi import FastAPI, Body
from keybert import KeyBERT

app = FastAPI()

# Initialize the KeyBERT model (this downloads a lightweight model on the first run)
kw_model = KeyBERT('distilbert-base-nli-mean-tokens')

@app.post("/extract_jd_keywords")
async def extract_keywords(data: dict = Body(...)):
    jd_text = data.get("jd")
    
    if not jd_text:
        return {"error": "Missing Job Description text"}

    # Extract keywords
    # top_n = 5 means we want the 5 most important topics/skills
    # keyphrase_ngram_range=(1, 2) means it can extract single words ("Redis") or pairs ("System Design")
    keywords_with_scores = kw_model.extract_keywords(
        jd_text, 
        keyphrase_ngram_range=(1, 2), 
        stop_words='english', 
        top_n=5
    )
    
    # KeyBERT returns a list of tuples: [('system design', 0.85), ('react', 0.72)]
    # We just want the words.
    extracted_keywords = [kw[0] for kw in keywords_with_scores]
    
    return {
        "keywords": extracted_keywords
    }