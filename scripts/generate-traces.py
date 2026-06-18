#!/usr/bin/env python3
"""
Generate Hebrew Tracer clues directly — no edge function needed.
Calls LLM API directly for full rate limit control.

Usage:
  python3 scripts/generate-traces.py tel-aviv
  python3 scripts/generate-traces.py london
  python3 scripts/generate-traces.py tel-aviv --all     # all places, not just 20
  python3 scripts/generate-traces.py tel-aviv --dry-run # print clues, don't insert

Set LLM provider via env var:
  export LLM_PROVIDER=groq        LLM_API_KEY=gsk_...
  export LLM_PROVIDER=anthropic   LLM_API_KEY=sk-ant-...
  export LLM_PROVIDER=openai      LLM_API_KEY=sk-...
"""

import sys, os, json, time, subprocess, urllib.parse, urllib.request

# ── Config ────────────────────────────────────────────────────────────
SUPABASE_URL    = "https://plecaiybtebebbhoabkw.supabase.co"
ANON_KEY        = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsZWNhaXlidGViZWJiaG9hYmt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjI5NTIsImV4cCI6MjA5NzI5ODk1Mn0"
    ".D7VlSYxo0JtlV9u_yi2TU24wP6lT0I_CO8wasMUsWC0"
)
PLACES_DIR      = os.path.join(os.path.dirname(__file__), "places")
LLM_PROVIDER    = os.environ.get("LLM_PROVIDER", "groq")
LLM_API_KEY     = os.environ.get("LLM_API_KEY", "")
DELAY_SECS      = 3   # delay between LLM calls

PROVIDER_CONFIG = {
    "groq":      {"url": "https://api.groq.com/openai/v1/chat/completions",        "model": "llama-3.3-70b-versatile"},
    "anthropic": {"url": "https://api.anthropic.com/v1/messages",                   "model": "claude-haiku-4-5"},
    "openai":    {"url": "https://api.openai.com/v1/chat/completions",              "model": "gpt-4o-mini"},
}

# ── Prompt ────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """אתה כותב רמזים למשחק רחוב בשם Tracer. שחקנים מקבלים רמז, מבינים לאיזה מקום הוא מתייחס, הולכים לשם ומצלמים.

החוק הראשון: העובדה הידועה ביותר על המקום אסורה לחלוטין ברמז.
• אבו חסן → אסור לציין "הומוס הכי טוב"
• כיכר רבין → אסור לציין 1995, רצח, שלום
• אצטדיון → אסור לציין "הדרבי"
כתוב מהשכבה השנייה של ידע — ההתנהגות, הכלל, הפרט שמעט יודעים.

מה גורם לרמז להיות טוב? לא תיאור — אלא ההתנהגות של המקום. האופי שלו. הכלל הלא-כתוב.

דוגמה מושלמת:
"אני פתוחה כל בוקר עד שנגמר האוכל. אף פעם לא אמרתי לאף אחד באיזו שעה זה קורה. מי שמכיר יודע לבוא מוקדם. מי שלא — יגיע ולא יבין למה הדלת סגורה באמצע היום."

חוקים:
1. לא לציין שם, רחוב, כתובת
2. גוף ראשון — המקום מדבר
3. 2-3 משפטים קצרים וחדים
4. ישראלי שמכיר תל אביב צריך לחשוב לפחות 30 שניות
5. עברית בלבד

החזר JSON בלבד:
{
  "clue": "הרמז",
  "hint": "רמז עזר קצר וישיר יותר",
  "difficulty": "easy"
}"""

# ── LLM call ──────────────────────────────────────────────────────────

def call_llm(place: dict) -> dict | None:
    name    = place["name"]
    ctx     = place.get("description", "")
    quirk   = place.get("quirk", "")
    ptype   = place.get("type", "מקום")

    user_msg = f"""כתוב רמז בעברית למקום הזה. הרמז חייב להיות קשה.

שם המקום (אסור לציין): {name}
{f"הקשר: {ctx}" if ctx else ""}
{f"""
⭐ הלב של הרמז — בנה אותו סביב הפרט הזה בלבד:
"{quirk}"
""" if quirk else ""}

חוקים: לא לציין שם. גוף ראשון. 2-3 משפטים. קשה לישראלי."""

    cfg = PROVIDER_CONFIG.get(LLM_PROVIDER, PROVIDER_CONFIG["groq"])

    if LLM_PROVIDER == "anthropic":
        payload = {
            "model": cfg["model"], "max_tokens": 512,
            "system": SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": user_msg}],
        }
        headers = {
            "x-api-key": LLM_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
    else:
        payload = {
            "model": cfg["model"], "max_tokens": 512, "temperature": 0.8,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
        }
        headers = {
            "Authorization": f"Bearer {LLM_API_KEY}",
            "Content-Type": "application/json",
        }

    try:
        req = urllib.request.Request(
            cfg["url"], data=json.dumps(payload).encode(),
            headers=headers, method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())

        if LLM_PROVIDER == "anthropic":
            text = data["content"][0]["text"]
        else:
            text = data["choices"][0]["message"]["content"]

        match = __import__("re").search(r'\{[\s\S]*\}', text)
        if not match: return None
        parsed = json.loads(match.group())
        if not all(k in parsed for k in ("clue", "hint", "difficulty")):
            return None
        return parsed

    except Exception as e:
        print(f"    ✗ LLM error: {e}")
        return None


# ── Supabase insert ───────────────────────────────────────────────────

def insert_trace(place: dict, generated: dict) -> bool:
    diff_radii = {
        "easy":      {"solve": 30,  "notify": 100},
        "medium":    {"solve": 50,  "notify": 300},
        "hard":      {"solve": 100, "notify": 600},
        "legendary": {"solve": 200, "notify": 1000},
    }
    diff = generated["difficulty"] if generated["difficulty"] in diff_radii else "medium"
    radii = diff_radii[diff]

    result = subprocess.run(
        ["curl", "-s", "--max-time", "15",
         "-X", "POST",
         f"{SUPABASE_URL}/functions/v1/generate-traces",
         "-H", f"Authorization: Bearer {ANON_KEY}",
         "-H", "Content-Type: application/json",
         "--data-binary", "@-"],
        input=json.dumps({
            "pois": [{
                "name": place["name"],
                "lat": place["lat"],
                "lng": place["lng"],
                "type": place.get("type", "place"),
                "description": f"CLUE_OVERRIDE:{generated['clue']}|HINT_OVERRIDE:{generated['hint']}",
            }]
        }).encode(),
        capture_output=True, timeout=20,
    )
    # Parse result
    try:
        data = json.loads(result.stdout)
        return data.get("generated", 0) > 0
    except:
        pass

    # Fallback: insert via seed_single_trace RPC
    rpc_result = subprocess.run(
        ["curl", "-s", "--max-time", "15",
         "-X", "POST",
         f"{SUPABASE_URL}/rest/v1/rpc/seed_single_trace",
         "-H", f"apikey: {ANON_KEY}",
         "-H", f"Authorization: Bearer {ANON_KEY}",
         "-H", "Content-Type: application/json",
         "-d", json.dumps({
             "p_arena_id": None,
             "p_lat": place["lat"],
             "p_lng": place["lng"],
             "p_place_name": place["name"],
             "p_clue": generated["clue"],
             "p_hint": generated["hint"],
             "p_difficulty": diff,
             "p_solve_radius": radii["solve"],
             "p_notify_radius": radii["notify"],
         })],
        capture_output=True, timeout=20,
    )
    return rpc_result.returncode == 0


# ── Existing names ────────────────────────────────────────────────────

def get_existing_names() -> set:
    try:
        result = subprocess.run(
            ["curl", "-s", "--max-time", "10",
             f"{SUPABASE_URL}/rest/v1/traces?select=place_name",
             "-H", f"apikey: {ANON_KEY}"],
            capture_output=True, text=True, timeout=15,
        )
        return {r["place_name"] for r in json.loads(result.stdout)}
    except:
        return set()


# ── Main ──────────────────────────────────────────────────────────────

args  = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
do_all  = "--all"  in flags
dry_run = "--dry-run" in flags

if not args:
    print(__doc__)
    sys.exit(0)

city   = args[0].lower().replace(" ", "-")
path   = os.path.join(PLACES_DIR, f"{city}.json")
if not os.path.exists(path):
    available = [f[:-5] for f in os.listdir(PLACES_DIR) if f.endswith(".json")]
    print(f"✗ No list for '{city}'. Available: {', '.join(available)}")
    sys.exit(1)

with open(path) as f:
    all_pois = json.load(f)

limit = len(all_pois) if do_all else min(len(all_pois), 20)
pois  = all_pois[:limit]

# Skip already generated
existing = get_existing_names()
before   = len(pois)
pois     = [p for p in pois if p["name"] not in existing]
if before != len(pois):
    print(f"  ↳ Skipping {before - len(pois)} already in DB")

print(f"→ [{LLM_PROVIDER}] Generating {len(pois)} clues for {city}...\n")

total_ok = 0
total_fail = 0

for i, place in enumerate(pois, 1):
    print(f"  [{i}/{len(pois)}] {place['name']}", end=" ", flush=True)
    generated = call_llm(place)

    if not generated:
        print("✗ failed")
        total_fail += 1
        time.sleep(DELAY_SECS)
        continue

    if dry_run:
        print(f"\n    [{generated['difficulty'].upper()}] {generated['clue'][:80]}...")
        total_ok += 1
    else:
        ok = insert_trace(place, generated)
        if ok:
            print(f"✓ [{generated['difficulty'].upper()}]")
            total_ok += 1
        else:
            print("✗ insert failed")
            total_fail += 1

    if i < len(pois):
        time.sleep(DELAY_SECS)

print(f"\n✓ Done — {total_ok} generated, {total_fail} failed.")
