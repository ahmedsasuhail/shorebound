"""Validate the /data store: every file parses, carries _meta, and country files have required keys.

Run: python scripts/validate_data.py
Replaced by zod schemas in packages/data-schema once the app exists (see PLAN.md).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "data"
META = ["schema_version", "researched_on", "generated_by", "confidence", "open_questions", "review_by"]
COUNTRY = ["code", "name", "region", "tier", "default_enabled", "currency", "languages", "salary",
           "visa_routes", "sponsor_register", "sponsorship_phrases", "ease_for_indian_nationals",
           "job_sites", "scam_warnings", "sources"]
SITE = ["id", "name", "url", "kind", "access", "verified"]

errors: list[str] = []


def check(cond: bool, msg: str) -> None:
    if not cond:
        errors.append(msg)


catalog = json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))
available = {c["code"].lower() for c in catalog["countries"] if c["status"] == "available"}

for path in sorted(ROOT.rglob("*.json")):
    rel = path.relative_to(ROOT).as_posix()
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        errors.append(f"{rel}: invalid JSON ({e})")
        continue
    if rel == "catalog.json":
        continue
    meta = doc.get("_meta", {})
    for key in META:
        check(key in meta, f"{rel}: _meta.{key} missing")
    if rel.startswith("countries/"):
        for key in COUNTRY:
            check(key in doc, f"{rel}: {key} missing")
        check(doc.get("code", "").lower() == path.stem, f"{rel}: code does not match filename")
        check(path.stem in available, f"{rel}: not marked 'available' in catalog.json")
        for i, site in enumerate(doc.get("job_sites", [])):
            for key in SITE:
                check(key in site, f"{rel}: job_sites[{i}].{key} missing")

for code in available:
    check((ROOT / "countries" / f"{code}.json").exists(), f"catalog.json: {code} marked available but file missing")

if errors:
    print("\n".join(errors))
    sys.exit(1)
print(f"data OK ({len(available)} countries available)")
