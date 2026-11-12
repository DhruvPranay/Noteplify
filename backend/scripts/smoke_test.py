"""End-to-end smoke test against a running API.

    python -m scripts.smoke_test --base http://localhost:8000 \
        --audio benchmarks/samples/tts_gradient_descent.wav

Registers (or logs into) a local dev account stored in data/dev-account.json, uploads the
audio, waits for processing, asks a question, scores WER if a same-name .txt exists, and
prints the metrics summary.
"""

import argparse
import json
import secrets
import sys
import time
from pathlib import Path

import httpx

ACCOUNT_FILE = Path("data/dev-account.json")


def account(client: httpx.Client) -> str:
    if ACCOUNT_FILE.is_file():
        creds = json.loads(ACCOUNT_FILE.read_text())
        r = client.post("/api/auth/login", json={"email": creds["email"], "password": creds["password"]})
    else:
        creds = {"name": "Dev Student", "email": f"dev-{secrets.token_hex(3)}@noteplify.dev",
                 "password": secrets.token_urlsafe(12)}
        r = client.post("/api/auth/register", json=creds)
        ACCOUNT_FILE.parent.mkdir(parents=True, exist_ok=True)
        ACCOUNT_FILE.write_text(json.dumps(creds, indent=2))
        print(f"registered dev account (credentials saved to {ACCOUNT_FILE})")
    r.raise_for_status()
    return r.json()["access_token"]


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--base", default="http://localhost:8000")
    p.add_argument("--audio", type=Path, required=True)
    p.add_argument("--question", default="What is the learning rate and why does it matter?")
    args = p.parse_args()

    with httpx.Client(base_url=args.base, timeout=120) as client:
        print("health:", client.get("/api/health").json())
        client.headers["Authorization"] = f"Bearer {account(client)}"

        with args.audio.open("rb") as f:
            r = client.post("/api/lectures/upload", files={"file": (args.audio.name, f, "audio/wav")},
                            data={"title": "Smoke test: gradient descent"})
        r.raise_for_status()
        lecture_id = r.json()["id"]
        print("uploaded lecture", lecture_id)

        t0 = time.time()
        while True:
            lec = client.get(f"/api/lectures/{lecture_id}").json()
            print(f"  [{time.time() - t0:5.1f}s] {lec['status']:<10} {lec['stage'] or '':<14} {lec['progress']:.0%}")
            if lec["status"] in ("completed", "failed"):
                break
            time.sleep(2)
        if lec["status"] == "failed":
            sys.exit(f"FAILED: {lec['error']}")

        print("\ntitle:", lec["title"])
        print("summary:", (lec["summary"] or "")[:300])
        print("takeaways:", lec["key_takeaways"])
        print("sections:", [s["title"] for s in lec["sections"] or []])
        print("flashcards:", lec["flashcard_count"])
        segs = client.get(f"/api/lectures/{lecture_id}/transcript").json()
        print("transcript segments:", [(s["start"], s["end"]) for s in segs])

        qa = client.post(f"/api/lectures/{lecture_id}/ask", json={"question": args.question})
        qa.raise_for_status()
        qa = qa.json()
        print("\nQ:", qa["question"], "\nA:", qa["answer"][:600])
        print("sources:", [(round(s["start"]), round(s["score"], 4)) for s in qa["sources"]])

        hits = client.get("/api/search", params={"q": "backpropagation chain rule"}).json()["hits"]
        print("search hits:", [(h["lecture_id"], round(h["start"])) for h in hits[:3]])

        ref = args.audio.with_suffix(".txt")
        if ref.is_file():
            wer = client.post(f"/api/lectures/{lecture_id}/wer", json={"reference": ref.read_text(encoding="utf-8")})
            wer.raise_for_status()
            print("\nWER:", wer.json())

        m = client.get(f"/api/lectures/{lecture_id}").json()["metric"]
        print("\ntimings (s):", {k: m[f"{k}_s"] for k in ("download", "preprocess", "transcribe", "index", "generate", "total")})
        print(f"min per audio hour: {m['minutes_per_audio_hour']:.2f} | RTF {m['rtf']:.4f} | chunks {m['num_audio_chunks']}")
        print("export bytes:", len(client.get(f"/api/lectures/{lecture_id}/export").content))
        print("\nOK")


if __name__ == "__main__":
    main()
