import re
import spacy
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# ────────────────────────────────────────────
# APP SETUP
# ────────────────────────────────────────────
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("🔄 Loading spaCy model (en_core_web_sm)...")
nlp = spacy.load("en_core_web_sm")
print("✅ spaCy model loaded.")

print("🔄 Loading SentenceTransformer model (all-MiniLM-L6-v2)...")
model = SentenceTransformer('all-MiniLM-L6-v2')
print("✅ SentenceTransformer model loaded.")


# ────────────────────────────────────────────
# HELPER: Extract resume sections
# ────────────────────────────────────────────
def extract_sections(text):
    """Split resume text into experience, skills, and education sections."""
    sections = {"experience": "", "skills": "", "education": ""}
    lines = text.split('\n')
    current_section = "skills"  # Default bucket

    for line in lines:
        l = line.upper().strip()
        if "EXPERIENCE" in l or "WORK" in l or "PROJECTS" in l:
            current_section = "experience"
        elif "EDUCATION" in l or "COLLEGE" in l or "ACADEMIC" in l:
            current_section = "education"
        elif "SKILLS" in l or "TECHNOLOGIES" in l or "TECH STACK" in l:
            current_section = "skills"
        sections[current_section] += line + " "

    print("\n📂 ── SECTION EXTRACTION ──")
    for sec_name, sec_text in sections.items():
        preview = sec_text.strip()[:120] + ("..." if len(sec_text.strip()) > 120 else "")
        print(f"   [{sec_name.upper():>12}] ({len(sec_text.strip()):>5} chars) → {preview}")

    return sections


# ────────────────────────────────────────────
# HELPER: Extract keywords using spaCy NLP
# ────────────────────────────────────────────
def extract_keywords(text):
    """Extract meaningful keywords (nouns, proper nouns, adjectives) using spaCy."""
    doc = nlp(text.lower())
    keywords = set()
    for token in doc:
        if token.pos_ in ("NOUN", "PROPN", "ADJ") and not token.is_stop and len(token.text) > 2:
            keywords.add(token.text)
    # Also extract named entities
    for ent in doc.ents:
        keywords.add(ent.text.lower())
    return keywords


# ────────────────────────────────────────────
# HELPER: Calculate bonus points
# ────────────────────────────────────────────
def calculate_bonus(text, resume_sections):
    """Award bonus points for impact metrics, leadership, prestige, and scale."""
    bonus = 0
    text_upper = text.upper()

    # 1. METRIC-BASED IMPACT (percentages, dollar values, action verbs)
    metrics_pattern = r'(\d+%)|(\\$\d+)|(REDUCED|INCREASED|IMPROVED|SAVED|OPTIMIZED|BOOSTED)'
    if re.search(metrics_pattern, text_upper):
        bonus += 5
        print("   🏆 +5  Metric-based impact detected")

    # 2. LEADERSHIP & OWNERSHIP SIGNALS
    leadership_keywords = ["LEAD", "MANAGED", "MENTORED", "ARCHITECTED", "OWNED", "INITIATED", "HEADED", "DIRECTED"]
    if any(word in text_upper for word in leadership_keywords):
        bonus += 5
        print("   🏆 +5  Leadership signal detected")

    # 3. TOP-TIER INSTITUTIONS (Universities & Companies)
    prestige_keywords = [
        "IIT", "NIT", "BITS", "STANFORD", "MIT", "HARVARD", "OXFORD", "CAMBRIDGE",
        "GOOGLE", "AMAZON", "META", "MICROSOFT", "NETFLIX", "APPLE", "UBER", "STRIPE"
    ]
    combined_text = (resume_sections.get('experience', '') +
                     resume_sections.get('education', '')).upper()
    if any(org in combined_text for org in prestige_keywords):
        bonus += 10
        print("   🏆 +10 Prestige institution/company detected")

    # 4. SCALE & COMPLEXITY
    scale_keywords = ["SCALE", "DISTRIBUTED", "MICROSERVICES", "KUBERNETES", "HIGH-TRAFFIC", "LATENCY", "MILLION", "BILLION"]
    if any(word in text_upper for word in scale_keywords):
        bonus += 5
        print("   🏆 +5  Scale/complexity signal detected")

    print(f"   ── Total Bonus: {bonus} points")
    return bonus


# ────────────────────────────────────────────
# HEALTH CHECK
# ────────────────────────────────────────────
@app.get("/health")
async def health_check():
    print("💚 Health check hit")
    return {"status": "ok"}


# ────────────────────────────────────────────
# MAIN ENDPOINT: Calculate Weighted ATS Score
# ────────────────────────────────────────────
@app.post("/calculate_weighted_score")
async def calculate_weighted_score(data: dict):
    print("\n" + "=" * 60)
    print("📥 ATS SCORE REQUEST RECEIVED")
    print("=" * 60)

    jd = data.get("jd", "")
    resume_raw = data.get("resume", "")

    # ── Input validation ──
    if not jd or not jd.strip():
        print("❌ ERROR: Job description is empty")
        return {"error": "Job description (jd) is required", "ats_score": 0}
    if not resume_raw or not resume_raw.strip():
        print("❌ ERROR: Resume text is empty")
        return {"error": "Resume text (resume) is required", "ats_score": 0}

    print(f"📝 JD Preview   : {jd[:100]}...")
    print(f"📄 Resume Preview: {resume_raw[:100]}...")

    # ── Step 1: Parse Resume into Sections ──
    print("\n── STEP 1: Extracting resume sections ──")
    resume_sections = extract_sections(resume_raw)

    # ── Step 2: Generate Embeddings ──
    print("\n── STEP 2: Generating embeddings ──")
    jd_vector = model.encode([jd])
    exp_vector = model.encode([resume_sections['experience']]) if resume_sections['experience'].strip() else model.encode([""])
    skill_vector = model.encode([resume_sections['skills']]) if resume_sections['skills'].strip() else model.encode([""])
    edu_vector = model.encode([resume_sections['education']]) if resume_sections['education'].strip() else model.encode([""])
    print("   ✅ Embeddings generated for JD + 3 resume sections")

    # ── Step 3: Calculate Sectional Similarities ──
    print("\n── STEP 3: Calculating cosine similarities ──")
    exp_sim = float(cosine_similarity(jd_vector, exp_vector)[0][0])
    skill_sim = float(cosine_similarity(jd_vector, skill_vector)[0][0])
    edu_sim = float(cosine_similarity(jd_vector, edu_vector)[0][0])
    print(f"   Experience Similarity : {exp_sim:.4f} ({exp_sim * 100:.2f}%)")
    print(f"   Skills Similarity     : {skill_sim:.4f} ({skill_sim * 100:.2f}%)")
    print(f"   Education Similarity  : {edu_sim:.4f} ({edu_sim * 100:.2f}%)")

    # ── Step 4: Apply Weights (Experience 60%, Skills 30%, Education 10%) ──
    print("\n── STEP 4: Applying weights (60% exp, 30% skills, 10% edu) ──")
    weighted_score = (exp_sim * 0.60) + (skill_sim * 0.30) + (edu_sim * 0.10)
    base_score = round(weighted_score * 100, 2)
    print(f"   Base Weighted Score: {base_score}%")

    # ── Step 5: Calculate Bonus Points ──
    print("\n── STEP 5: Calculating bonus points ──")
    bonus_points = calculate_bonus(resume_sections.get('experience', ''), resume_sections)

    # ── Step 6: Compute Final Score (capped at 100) ──
    final_score = min(100, round(base_score + bonus_points, 2))
    print(f"\n── STEP 6: Final Score ──")
    print(f"   Base: {base_score} + Bonus: {bonus_points} = {final_score}% (capped at 100)")

    # ── Step 7: Extract & Match Keywords ──
    print("\n── STEP 7: Keyword Matching ──")
    jd_keywords = extract_keywords(jd)
    resume_keywords = extract_keywords(resume_raw)
    matched_keywords = sorted(list(jd_keywords & resume_keywords))
    missing_keywords = sorted(list(jd_keywords - resume_keywords))
    print(f"   JD Keywords     : {len(jd_keywords)} found")
    print(f"   Resume Keywords : {len(resume_keywords)} found")
    print(f"   ✅ Matched       : {len(matched_keywords)} → {matched_keywords[:15]}")
    print(f"   ❌ Missing        : {len(missing_keywords)} → {missing_keywords[:15]}")

    # ── Build Response ──
    response = {
        "ats_score": final_score,
        "breakdown": {
            "experience": round(exp_sim * 100, 2),
            "skills": round(skill_sim * 100, 2),
            "education": round(edu_sim * 100, 2),
            "bonus": bonus_points,
        },
        "keywords": {
            "matched": matched_keywords,
            "missing": missing_keywords[:20],  # Limit to top 20
        }
    }

    print(f"\n📤 RESPONSE: {response}")
    print("=" * 60 + "\n")

    return response


# ────────────────────────────────────────────
# RUN SERVER
# ────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    print("\n🚀 Starting ATS Python Server on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)