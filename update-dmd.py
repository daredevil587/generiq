#!/usr/bin/env python3
"""
update-dmd.py  —  NHS dm+d automatic importer for GeneriQ
Downloads the latest release from TRUD (item 24), parses VMP/AMP/ingredient
XML files, and imports new medicines into the Railway PostgreSQL database.

Usage:
  python update-dmd.py              # import now
  python update-dmd.py --schedule   # import now + register Windows scheduled task
"""
from __future__ import annotations

import argparse
import io
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

try:
    import requests
    import psycopg2
except ImportError as exc:
    print(f"Missing dependency: {exc}")
    print("Run: pip install requests psycopg2-binary")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────

TRUD_API_KEY = "afae3c8912a33473d8c63cbd5474b765d1f07879"
TRUD_ITEM_ID = 24
TRUD_URL = (
    f"https://isd.digital.nhs.uk/trud/api/v1/keys/{TRUD_API_KEY}"
    f"/items/{TRUD_ITEM_ID}/releases?latest"
)

SCRIPT_DIR = Path(__file__).parent
LOG_FILE = SCRIPT_DIR / "dmd-import.log"

# SNOMED unit-of-measure codes → readable symbol
UOM_SYMBOLS: dict[str, str] = {
    "258684004": "mg",
    "258775009": "g",
    "258773002": "mL",
    "258770004": "L",
    "258774008": "mcg",
    "282113003": "mcg",
    "415818006": "mg/mL",
    "415819003": "mcg/mL",
    "258686002": "mcg",
    "258718000": "mmol",
    "246205007": "units",
    "385055001": "dose",
}

BNF_CATEGORIES: dict[str, str] = {
    "01": "Gastrointestinal",
    "02": "Cardiovascular",
    "03": "Respiratory",
    "04": "Central Nervous System",
    "05": "Infections",
    "06": "Endocrine",
    "07": "Obstetrics & Gynaecology",
    "08": "Malignant Disease",
    "09": "Nutrition & Blood",
    "10": "Musculoskeletal",
    "11": "Eye",
    "12": "Ear, Nose & Throat",
    "13": "Skin",
    "14": "Vaccines",
    "15": "Anaesthesia",
}

DOSAGE_FORMS: list[tuple[str, str]] = [
    ("oral solution", "Oral Solution"),
    ("oral suspension", "Oral Suspension"),
    ("oral drops", "Oral Drops"),
    ("oral gel", "Oral Gel"),
    ("modified-release tablets", "Modified-Release Tablets"),
    ("gastro-resistant tablets", "Gastro-Resistant Tablets"),
    ("effervescent tablets", "Effervescent Tablets"),
    ("dispersible tablets", "Dispersible Tablets"),
    ("chewable tablets", "Chewable Tablets"),
    ("tablets", "Tablets"),
    ("hard capsules", "Hard Capsules"),
    ("soft capsules", "Soft Capsules"),
    ("capsules", "Capsules"),
    ("cream", "Cream"),
    ("ointment", "Ointment"),
    ("gel", "Gel"),
    ("solution for injection", "Injection"),
    ("injection", "Injection"),
    ("infusion", "Infusion"),
    ("syrup", "Syrup"),
    ("drops", "Drops"),
    ("nasal spray", "Nasal Spray"),
    ("spray", "Spray"),
    ("inhaler", "Inhaler"),
    ("patches", "Patches"),
    ("patch", "Patches"),
    ("suppositories", "Suppositories"),
    ("suppository", "Suppositories"),
    ("pessaries", "Pessaries"),
    ("granules", "Granules"),
    ("powder", "Powder"),
    ("lotion", "Lotion"),
    ("foam", "Foam"),
    ("enema", "Enema"),
    ("implant", "Implant"),
    ("solution", "Solution"),
    ("suspension", "Suspension"),
    ("emulsion", "Emulsion"),
]

log = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def load_env() -> None:
    env_path = SCRIPT_DIR / ".env.local"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())


def get_category(bnf_code: str) -> str:
    if bnf_code and len(bnf_code) >= 2:
        return BNF_CATEGORIES.get(bnf_code[:2], "Other")
    return "Other"


def get_dosage_form(name: str) -> str:
    nl = name.lower()
    for keyword, label in DOSAGE_FORMS:
        if keyword in nl:
            return label
    return "Other"


def format_strength(val: str, uom_code: str) -> str | None:
    val = (val or "").strip()
    if not val:
        return None
    unit = UOM_SYMBOLS.get((uom_code or "").strip(), (uom_code or "").strip())
    return f"{val} {unit}".strip() or None


# ── Download ──────────────────────────────────────────────────────────────────

def fetch_latest_release() -> dict:
    log.info("Fetching latest dm+d release info from TRUD...")
    resp = requests.get(TRUD_URL, timeout=30)
    if resp.status_code == 401:
        print(
            "\n401 Unauthorized - TRUD API access not enabled for this account.\n"
            "Fix in 2 steps:\n"
            "  1. Log in at https://isd.digital.nhs.uk/trud/\n"
            "  2. Go to My Account > API Keys and enable API access\n"
            "\nAlternative: download dm+d ZIP manually from TRUD and run:\n"
            "  python update-dmd.py --file path\\to\\dmd.zip\n"
        )
        sys.exit(1)
    resp.raise_for_status()
    releases = resp.json().get("releases", [])
    if not releases:
        raise RuntimeError("TRUD returned no releases for item 24")
    r = releases[0]
    log.info(f"Latest release: {r.get('releaseDate', '?')} — {r.get('archiveFileName', '?')}")
    return r


def download_archive(url: str, dest: Path) -> None:
    log.info(f"Downloading dm+d archive...")
    with requests.get(url, stream=True, timeout=600) as resp:
        resp.raise_for_status()
        total = int(resp.headers.get("content-length", 0))
        downloaded = 0
        with open(dest, "wb") as f:
            for chunk in resp.iter_content(chunk_size=4 * 1024 * 1024):
                f.write(chunk)
                downloaded += len(chunk)
                if total:
                    print(
                        f"\r  Downloading: {downloaded / 1024 / 1024:.0f} MB"
                        f" / {total / 1024 / 1024:.0f} MB"
                        f" ({downloaded / total * 100:.0f}%)",
                        end="",
                        flush=True,
                    )
    print()
    log.info(f"Downloaded {downloaded / 1024 / 1024:.1f} MB")


# ── Extraction ────────────────────────────────────────────────────────────────

def _extract_xml_recursive(zf: zipfile.ZipFile, dest: Path) -> None:
    """Recursively extract XML files, opening any nested ZIPs."""
    for name in zf.namelist():
        lower = name.lower()
        if lower.endswith(".xml"):
            zf.extract(name, dest)
        elif lower.endswith(".zip"):
            data = zf.read(name)
            with zipfile.ZipFile(io.BytesIO(data)) as inner:
                _extract_xml_recursive(inner, dest)


def extract_xml_files(archive_path: Path, work_dir: Path) -> dict[str, Path]:
    """
    Extract all XML files from the dm+d archive (handles nested ZIPs).
    Returns {lowercase_filename: Path}.
    """
    xml_dir = work_dir / "xml"
    xml_dir.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive_path) as outer:
        _extract_xml_recursive(outer, xml_dir)
    result = {p.name.lower(): p for p in xml_dir.rglob("*.xml")}
    log.info(f"Extracted {len(result)} XML files: {', '.join(sorted(result.keys()))}")
    return result


def find_xml(xml_map: dict[str, Path], prefix: str) -> Path | None:
    for k, v in xml_map.items():
        if k.startswith(prefix) and k.endswith(".xml"):
            return v
    return None


# ── Parsing ───────────────────────────────────────────────────────────────────

def parse_ingredient_names(xml_path: Path) -> dict[str, str]:
    """f_ingredient2.xml → {isid: ingredient_name}"""
    log.info(f"Parsing ingredient substances ({xml_path.name})...")
    result: dict[str, str] = {}
    for _event, elem in ET.iterparse(str(xml_path), events=("end",)):
        if elem.tag == "ING":
            isid = elem.findtext("ISID") or ""
            ingnm = (elem.findtext("INGNM") or "").strip()
            if isid and ingnm:
                result[isid] = ingnm
            elem.clear()
    log.info(f"  {len(result)} ingredient substances")
    return result


def parse_vmps(
    xml_path: Path,
) -> tuple[dict[str, dict], list[dict]]:
    """
    f_vmp2.xml → (vmps dict, vmp_ingredients list)
    vmps: {vpid: {vpid, name, bnf_code}}
    vmp_ingredients: [{vpid, isid, strength}]
    """
    log.info(f"Parsing VMPs ({xml_path.name})...")
    vmps: dict[str, dict] = {}
    vmp_ingredients: list[dict] = []

    for _event, elem in ET.iterparse(str(xml_path), events=("end",)):
        if elem.tag == "VMP":
            vpid = elem.findtext("VPID") or ""
            invalid = (elem.findtext("INVALID") or "").strip()
            nm = (elem.findtext("NM") or "").strip()
            if vpid and invalid != "1" and nm:
                vmps[vpid] = {
                    "vpid": vpid,
                    "name": nm,
                    "bnf_code": (elem.findtext("BNF_CODE") or "").strip(),
                }
            elem.clear()
        elif elem.tag == "VPI":
            vpid = elem.findtext("VPID") or ""
            isid = elem.findtext("ISID") or ""
            if vpid and isid:
                vmp_ingredients.append({
                    "vpid": vpid,
                    "isid": isid,
                    "strength": format_strength(
                        elem.findtext("STRNT_NMRTR_VAL") or "",
                        elem.findtext("STRNT_NMRTR_UOMCD") or "",
                    ),
                })
            elem.clear()

    log.info(f"  {len(vmps)} valid VMPs, {len(vmp_ingredients)} ingredient links")
    return vmps, vmp_ingredients


def parse_brand_names(xml_path: Path) -> dict[str, list[str]]:
    """f_amp2.xml → {vpid: [brand_name, ...]} (up to 8 per VMP)"""
    log.info(f"Parsing brand names ({xml_path.name})...")
    result: dict[str, list[str]] = {}
    for _event, elem in ET.iterparse(str(xml_path), events=("end",)):
        if elem.tag == "AMP":
            vpid = elem.findtext("VPID") or ""
            nm = (elem.findtext("NM") or "").strip()
            if vpid and nm:
                bucket = result.setdefault(vpid, [])
                if len(bucket) < 8 and nm not in bucket:
                    bucket.append(nm)
            elem.clear()
    log.info(f"  {len(result)} VMPs have brand-name entries")
    return result


# ── Import ────────────────────────────────────────────────────────────────────

_INSERT_MED = """
    INSERT INTO medicines
        (name, generic_name, category, description, active_ingredient,
         dosage_form, mhra_approved, brand_names, bnf_code, atc_code, source)
    VALUES
        (%(name)s, %(generic_name)s, %(category)s, %(description)s,
         %(active_ingredient)s, %(dosage_form)s, %(mhra_approved)s,
         %(brand_names)s, %(bnf_code)s, %(atc_code)s, %(source)s)
    RETURNING id
"""

_INSERT_ING = """
    INSERT INTO ingredients (medicine_id, ingredient_name, quantity, is_active)
    VALUES (%s, %s, %s, %s)
"""


def connect_db(db_url: str):
    """Open a DB connection with TCP keepalives to prevent idle-timeout drops."""
    return psycopg2.connect(
        db_url,
        keepalives=1,
        keepalives_idle=60,
        keepalives_interval=10,
        keepalives_count=5,
        connect_timeout=30,
    )


def _load_existing_names(conn) -> set[str]:
    cur = conn.cursor()
    cur.execute("SELECT LOWER(name) FROM medicines")
    result = {row[0] for row in cur.fetchall()}
    cur.close()
    return result


def import_medicines(
    db_url: str,
    vmps: dict[str, dict],
    vmp_ingredients: list[dict],
    ing_names: dict[str, str],
    brand_names: dict[str, list[str]],
) -> tuple[int, int]:
    BATCH = 100
    MAX_RETRIES = 5
    RETRY_DELAY = 15  # seconds between reconnect attempts

    ings_by_vpid: dict[str, list[dict]] = {}
    for vi in vmp_ingredients:
        ing_name = ing_names.get(vi["isid"], "")
        if ing_name:
            ings_by_vpid.setdefault(vi["vpid"], []).append(
                {"name": ing_name, "strength": vi["strength"]}
            )

    conn = connect_db(db_url)
    existing = _load_existing_names(conn)
    log.info(f"Existing medicines in DB: {len(existing)}")

    # Build the full insert list, skipping anything already in the DB.
    # This naturally resumes from wherever a previous run stopped.
    to_insert: list[tuple[str, dict, list]] = []
    skipped = 0
    for vpid, vmp in vmps.items():
        nm = vmp["name"]
        if not nm or nm.lower() in existing:
            skipped += 1
            continue
        bnf = vmp["bnf_code"] or None
        ings = ings_by_vpid.get(vpid, [])
        generic = ings[0]["name"] if ings else nm.split()[0]
        brands = brand_names.get(vpid, [])
        to_insert.append((nm, {
            "name": nm,
            "generic_name": generic,
            "category": get_category(bnf or ""),
            "description": f"NHS dm+d: {nm}",
            "active_ingredient": generic,
            "dosage_form": get_dosage_form(nm),
            "mhra_approved": True,
            "brand_names": ", ".join(brands) if brands else None,
            "bnf_code": bnf,
            "atc_code": None,
            "source": "dmd",
        }, ings))

    log.info(f"Records to insert: {len(to_insert)} (skipping {skipped} already in DB)")

    inserted = 0
    errors = 0
    i = 0

    while i < len(to_insert):
        batch = to_insert[i:i + BATCH]
        batch_size = len(batch)
        retry_batch = list(batch)

        for attempt in range(MAX_RETRIES):
            try:
                cur = conn.cursor()
                count = 0
                for nm, row, ings in retry_batch:
                    if nm.lower() in existing:
                        continue
                    cur.execute(_INSERT_MED, row)
                    med_id = cur.fetchone()[0]
                    for ing in ings:
                        cur.execute(_INSERT_ING, (med_id, ing["name"], ing["strength"], True))
                    existing.add(nm.lower())
                    count += 1
                conn.commit()
                cur.close()
                inserted += count
                i += batch_size
                log.info(f"  Batch committed — {inserted} inserted so far")
                break  # success

            except (psycopg2.OperationalError, psycopg2.InterfaceError) as exc:
                log.warning(f"Connection lost (attempt {attempt + 1}/{MAX_RETRIES}): {exc}")
                try:
                    conn.close()
                except Exception:
                    pass

                if attempt + 1 < MAX_RETRIES:
                    log.info(f"Waiting {RETRY_DELAY}s then reconnecting...")
                    time.sleep(RETRY_DELAY)
                    conn = connect_db(db_url)
                    existing = _load_existing_names(conn)
                    log.info(f"Reconnected. DB has {len(existing)} medicines.")
                    # Drop any records that were committed before the disconnect
                    retry_batch = [
                        (nm, row, ings)
                        for nm, row, ings in retry_batch
                        if nm.lower() not in existing
                    ]
                    if not retry_batch:
                        log.info("All records in this batch were already committed.")
                        inserted += batch_size
                        i += batch_size
                        break
                else:
                    log.error(f"Max retries reached. Skipping batch of {len(retry_batch)} records.")
                    errors += len(retry_batch)
                    i += batch_size

            except Exception as exc:
                # Non-connection error: rollback and retry records individually
                # to isolate the bad row without losing the whole batch.
                try:
                    conn.rollback()
                except Exception:
                    pass
                cur = conn.cursor()
                count = 0
                for nm, row, ings in retry_batch:
                    if nm.lower() in existing:
                        continue
                    try:
                        cur.execute(_INSERT_MED, row)
                        med_id = cur.fetchone()[0]
                        for ing in ings:
                            cur.execute(_INSERT_ING, (med_id, ing["name"], ing["strength"], True))
                        existing.add(nm.lower())
                        count += 1
                    except Exception as row_exc:
                        try:
                            conn.rollback()
                        except Exception:
                            pass
                        cur = conn.cursor()
                        errors += 1
                        if errors <= 5:
                            log.warning(f"Insert error for {nm!r}: {row_exc}")
                conn.commit()
                cur.close()
                inserted += count
                i += batch_size
                break

    try:
        conn.close()
    except Exception:
        pass

    if errors:
        log.warning(f"{errors} total insert errors (first 5 logged above)")
    log.info(f"Import complete — inserted: {inserted}, skipped (already in DB): {skipped}")
    return inserted, skipped


# ── Scheduler ─────────────────────────────────────────────────────────────────

def setup_schedule() -> None:
    """Create a Windows Task Scheduler task: runs every Monday at 08:00."""
    bat_path = SCRIPT_DIR / "run-dmd-update.bat"
    python = sys.executable
    script = str(SCRIPT_DIR / "update-dmd.py")
    bat_path.write_text(
        f'@echo off\n"{python}" "{script}" >> "{SCRIPT_DIR / "dmd-import.log"}" 2>&1\n',
        encoding="utf-8",
    )
    log.info(f"Launcher created: {bat_path}")

    cmd = [
        "schtasks", "/create",
        "/tn", "GeneriQ_dmd_weekly",
        "/tr", str(bat_path),
        "/sc", "weekly",
        "/d", "MON",
        "/st", "08:00",
        "/f",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        log.info("Scheduled task 'GeneriQ_dmd_weekly' registered: every Monday 08:00")
        print("\nScheduled task created successfully.")
        print("Verify with: schtasks /query /tn GeneriQ_dmd_weekly")
    else:
        log.error(f"schtasks failed: {result.stderr.strip()}")
        print("\nCould not register scheduled task (try running as Administrator).")
        print(f"Manual setup: run {bat_path} every Monday at 08:00")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import latest NHS dm+d medicines into GeneriQ database"
    )
    parser.add_argument(
        "--schedule",
        action="store_true",
        help="Register Windows Task Scheduler task (run every Monday 08:00) then import",
    )
    parser.add_argument(
        "--file",
        metavar="PATH",
        help="Import from a locally downloaded dm+d ZIP instead of downloading from TRUD",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s  %(message)s",
        datefmt="%H:%M:%S",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(str(LOG_FILE), encoding="utf-8", mode="a"),
        ],
    )

    if args.schedule:
        setup_schedule()

    load_env()
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        log.error("DATABASE_URL not set — check .env.local")
        sys.exit(1)

    work_dir = Path(tempfile.mkdtemp(prefix="dmd_import_"))
    log.info(f"Working directory: {work_dir}")

    try:
        # Step 1 & 2 — get archive (download or use local file)
        if args.file:
            archive_path = Path(args.file).resolve()
            if not archive_path.exists():
                log.error(f"File not found: {archive_path}")
                sys.exit(1)
            log.info(f"Using local archive: {archive_path}")
        else:
            release = fetch_latest_release()
            archive_path = work_dir / "dmd.zip"
            download_archive(release["archiveFileUrl"], archive_path)

        # Step 3 — extract and parse XML
        xml_map = extract_xml_files(archive_path, work_dir)

        ing_file = find_xml(xml_map, "f_ingredient2")
        vmp_file = find_xml(xml_map, "f_vmp2")
        amp_file = find_xml(xml_map, "f_amp2")

        if not vmp_file:
            log.error("f_vmp2*.xml not found in the downloaded archive — aborting")
            sys.exit(1)

        ing_names = parse_ingredient_names(ing_file) if ing_file else {}
        vmps, vmp_ingredients = parse_vmps(vmp_file)
        brand_names = parse_brand_names(amp_file) if amp_file else {}

        # Step 4 — import into PostgreSQL
        log.info("Connecting to database...")
        inserted, skipped = import_medicines(
            db_url, vmps, vmp_ingredients, ing_names, brand_names
        )

        print(f"\nDone. {inserted} new medicines imported, {skipped} already existed.")

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
        log.info("Temp files cleaned up")


if __name__ == "__main__":
    main()
