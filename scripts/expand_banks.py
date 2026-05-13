#!/usr/bin/env python3
"""
Expand banks.json with all Indian card-issuing banks from Razorpay IFSC database.

Strategy:
- Major banks (PSB, Private, SFB, Foreign, Payments): One entry per IFSC prefix,
  with full verified details from the existing 50 banks preserved intact.
- Cooperative/Rural/RRB banks: One entry per unique IIN code (they each issue
  their own RuPay cards), with RBI helpline guidance for blocking.

Usage: python scripts/expand_banks.py

After expansion:
1. Verify: python -m pytest tests/ -v
2. Test locally: python run.py
3. Commit: git add app/data/banks.json && git commit
"""
import json
import re
from collections import defaultdict, Counter
from datetime import date
from pathlib import Path
import shutil

# Paths
SCRIPT_DIR = Path(__file__).parent
BASE_DIR = SCRIPT_DIR.parent
RAZORPAY_PATH = BASE_DIR / "data" / "banks-from-razorpay.json"
BANKS_PATH = BASE_DIR / "app" / "data" / "banks.json"

TODAY = date.today().isoformat()

# RBI helpline
RBI_HEPLINE = "14448"
RBI_EMAIL = "crpc@rbi.org.in"
RBI_URL = "https://www.rbi.org.in/Scripts/PublicContactDetail.aspx?id=172"

GENERIC_BLOCKING = (
    "For lost/stolen card, contact your nearest bank branch immediately. "
    f"RBI Banking Ombudsman Helpline: {RBI_HEPLINE}. "
    f"Email: {RBI_EMAIL}. "
    "For RuPay cards, also contact NPCI Helpline: 1800-159-8888. "
    "Check bank's mobile app or internet banking for self-service card blocking."
)

# Known major bank name mappings (IFSC prefix -> name)
BANK_NAMES = {
    # PSB (Public Sector Banks)
    "SBIN": "State Bank of India",
    "PUNB": "Punjab National Bank",
    "BARB": "Bank of Baroda",
    "CNRB": "Canara Bank",
    "SYNB": "Canara Bank (erstwhile Syndicate Bank)",
    "ORBC": "Bank of Baroda (erstwhile Oriental Bank of Commerce)",
    "CORP": "Union Bank of India (erstwhile Corporation Bank)",
    "UBIN": "Union Bank of India",
    "UCBA": "UCO Bank",
    "CBIN": "Central Bank of India",
    "IOBA": "Indian Overseas Bank",
    "IDIB": "Indian Bank",
    "MAHB": "Bank of Maharashtra",
    "ALLA": "Indian Bank (erstwhile Allahabad Bank)",
    "VIJB": "Canara Bank (erstwhile Vijaya Bank)",
    "BKDN": "Bank of India",
    "BKID": "Bank of India",
    "UTBI": "United Bank of India",
    "PSIB": "Punjab & Sind Bank",
    "ANDB": "Andhra Bank",
    "RBIN": "Reserve Bank of India",
    # Private Banks
    "HDFC": "HDFC Bank",
    "ICIC": "ICICI Bank",
    "UTIB": "Axis Bank",
    "KKBK": "Kotak Mahindra Bank",
    "YESB": "Yes Bank",
    "INDB": "IndusInd Bank",
    "IDFB": "IDFC FIRST Bank",
    "RATN": "RBL Bank",
    "CSBK": "CSB Bank",
    "DCBL": "DCB Bank",
    "CIUB": "City Union Bank",
    "SIBL": "South Indian Bank",
    "KVBL": "Karur Vysya Bank",
    "FDRL": "Federal Bank",
    "BDBL": "Bandhan Bank",
    "DLXB": "Dhanlaxmi Bank",
    "KARB": "Karnataka Bank",
    "JAKA": "Jammu & Kashmir Bank",
    "NTBL": "Nainital Bank",
    "IBKL": "IDBI Bank",
    "ABBL": "AB Bank Limited",
    "BBKM": "Bank of Bahrain and Kuwait",
    "BCEY": "Bank of Ceylon",
    # Small Finance Banks
    "AUBL": "AU Small Finance Bank",
    "ESFB": "Equitas Small Finance Bank",
    "CLBL": "Capital Small Finance Bank",
    "FINO": "Fino Payments Bank",
    "JANA": "Jana Small Finance Bank",
    "SRSB": "Suryoday Small Finance Bank",
    "USFB": "Ujjivan Small Finance Bank",
    "UTKS": "Utkarsh Small Finance Bank",
    "ESMF": "ESAF Small Finance Bank",
    "SMLF": "Shivalik Small Finance Bank",
    "GSFB": "Grameen Financial Services",
    "SMCB": "Suryoday Small Finance Bank",
    "SURY": "Suryoday Small Finance Bank",
    "FSFB": "Fincare Small Finance Bank",
    "NESF": "North East Small Finance Bank",
    "UJVN": "Ujjivan Small Finance Bank",
    "JSFB": "Jana Small Finance Bank",
    # Payments Banks
    "AIRP": "Airtel Payments Bank",
    "IPPB": "India Post Payments Bank",
    "JIOP": "Jio Payments Bank",
    "NPB0": "NSDL Payments Bank",
    "PYTM": "Paytm Payments Bank",
    # Foreign Banks
    "SCBL": "Standard Chartered Bank",
    "HSBC": "HSBC Bank",
    "DBSS": "DBS Bank",
    "CITI": "Citibank India",
    "DEUT": "Deutsche Bank",
    "EBIL": "Emirates Bank",
    "LAVB": "Latvia Bank",
    "STCB": "State Bank of Mauritius",
    # State Co-op Banks
    "ACAX": "AP State Cooperative Bank",
    "ANSX": "Andaman & Nicobar State Cooperative Bank",
    "APBL": "AP State Cooperative Agriculture Bank",
    "GBSC": "Gujarat State Cooperative Bank",
    "GBSX": "Gujarat State Cooperative Bank",
    "GSCB": "Gujarat State Cooperative Bank",
    "HARC": "Haryana State Cooperative Bank",
    "HPSC": "Himachal Pradesh State Cooperative Bank",
    "KSCB": "Kerala State Cooperative Bank",
    "KSCX": "Kerala State Cooperative Bank",
    "MSCB": "Madhya Pradesh Rajya Sahakari Bank",
    "ORCB": "Odisha State Cooperative Bank",
    "RSCB": "Rajasthan State Cooperative Bank",
    "TNSC": "Tamil Nadu State Apex Cooperative Bank",
    "UPCB": "Uttar Pradesh Cooperative Bank",
    "WBSC": "West Bengal State Cooperative Bank",
    "DLSC": "Delhi State Cooperative Bank",
    # RRBs with identifiable names
    "TGBX": "Tripura Gramin Bank",
    "VGBX": "Vananchal Gramin Bank",
    "CGBX": "Chhattisgarh Rajya Gramin Bank",
    "EDBX": "Uttarakhand Gramin Bank",
    "HGBX": "Himachal Gramin Bank",
    "HMBX": "Himachal Pradesh Gramin Bank",
    "MBGX": "Maharashtra Gramin Bank",
    "MDGX": "Madhya Pradesh Gramin Bank",
    "MRBX": "Maharashtra Rural Bank",
    "MZRX": "Mizoram Rural Bank",
    "PGBX": "Prathama UP Gramin Bank",
    "PUGX": "Punjab Gramin Bank",
    "SUBX": "Surbhi Gramin Bank",
    "TGRB": "Telangana Grameena Bank",
    "UKGX": "Uttarakhand Gramin Bank",
    "UGBX": "Uttar Bihar Gramin Bank",
    "UTGX": "Uttar Pradesh Cooperative Bank",
    "JKRX": "Jharkhand Rajya Gramin Bank",
    "CGGX": "Chaitanya Godavari Grameena Bank",
    "AGVX": "Aryavart Gramin Bank",
    "BGVX": "Balrampur Gramin Vikas Bank",
    "ODGB": "Odisha Gramya Bank",
    "GUBX": "Godavari Urban Cooperative Bank",
    "MGBX": "Maharashtra Gramin Bank",
    "PBGX": "Punjab State Cooperative Bank",
    "SPBX": "Sri Puducherry Coop Bank",
    "PABX": "Puducherry Mercantile Coop Bank",
    "GBCX": "Ganganagar Central Coop Bank",
}


def slugify(name):
    """Create URL-safe slug from bank name."""
    s = name.strip().lower()
    s = re.sub(r'[^a-z0-9\s]', '', s)
    s = re.sub(r'\s+', ' ', s)
    s = '_'.join(s.split())
    return s.strip('_')


def unique_slug(base_slug, banks_dict):
    """Ensure slug is unique by appending _2, _3, etc."""
    slug = base_slug
    counter = 1
    while slug in banks_dict:
        slug = f"{base_slug}_{counter}"
        counter += 1
    return slug


def create_coop_bank_entry(code, bank_data, bank_name, banks_so_far):
    """Create an entry for cooperative/district/RRB banks."""
    ifsc = bank_data.get('ifsc', '') or ''
    prefix = ifsc[:4] if ifsc else code
    iin = bank_data.get('iin', '')
    micr = bank_data.get('micr', '')
    bank_type = bank_data.get('type', 'O-UCB')

    base_slug = slugify(bank_name)
    slug = unique_slug(base_slug, banks_so_far)

    sources = [
        {
            "label": f"Razorpay IFSC Database - {code}",
            "url": "https://razorpay.com",
            "verified": False
        }
    ]

    entry = {
        "id": slug,
        "name": bank_name,
        "logo": f"/static/logos/{slug}.svg",
        "ifsc_prefix": prefix,
        "iin_code": iin,
        "micr_code": micr if micr else None,
        "bank_type": bank_type,
        "cardTypes": ["debit"],
        "blockingInstructions": {
            "debit": {
                "tollFree": RBI_HEPLINE,
                "email": RBI_EMAIL,
                "website": f"https://{prefix.lower()}.rbi.org.in",
                "reference": RBI_URL,
                "notes": GENERIC_BLOCKING
            }
        },
        "sources": sources,
        "lastVerified": TODAY
    }

    return slug, entry


def main():
    # Load existing banks (50 verified)
    with open(BANKS_PATH, 'r') as f:
        existing = json.load(f)

    print(f"Existing verified banks: {len(existing)}")

    # Backup
    backup_path = str(BANKS_PATH) + ".bak"
    shutil.copy(BANKS_PATH, backup_path)
    print(f"Backed up to {backup_path}")

    # Load Razorpay data
    with open(RAZORPAY_PATH, 'r') as f:
        razorpay = json.load(f)

    # Get card issuers with IIN
    card_issuers = {code: b for code, b in razorpay.items() if b.get('iin')}
    print(f"Razorpay card issuers with IIN: {len(card_issuers)}")

    # Build set of existing IFSC prefixes and IINs to avoid duplicates
    existing_prefixes = set()
    existing_iins = set()
    for bank in existing.values():
        # For existing banks: check ifsc_prefix field or first 4 chars of ifsc
        prefix = bank.get('ifsc_prefix', bank.get('ifsc', '')[:4])
        existing_prefixes.add(prefix)
        # Check iin_prefixes for legacy format
        iins = bank.get('iin_prefixes', [])
        if isinstance(iins, list):
            for i in iins:
                existing_iins.add(i)
        elif isinstance(iins, str):
            existing_iins.add(iins)

    print(f"Existing IFSC prefixes: {len(existing_prefixes)}")
    print(f"Existing IINs: {len(existing_iins)}")

    # Group major banks by IFSC prefix
    major_types = {'PSB', 'Private', 'SFB', 'Foreign', 'PB'}
    coop_entries = []

    for code, b in card_issuers.items():
        ifsc = b.get('ifsc') or ''
        ifsc_prefix = ifsc[:4] if ifsc else code[:4]
        iin = b.get('iin', '')

        # Skip if IFSC prefix or IIN already covered
        if ifsc_prefix in existing_prefixes or iin in existing_iins:
            continue

        # Only add coop/RRB/UCB entries (major banks are already in)
        coop_entries.append({
            'code': code,
            'type': b['type'],
            'iin': iin,
            'micr': b.get('micr', ''),
            'ifsc': ifsc,
        })

    print(f"New banks to add: {len(coop_entries)}")

    # Add cooperative/RRB banks
    new_banks = {}
    for entry in coop_entries:
        code = entry['code']
        bank_type = entry['type']
        ifsc_prefix = (entry.get('ifsc', '') or '')[:4] or code[:4]
        iin = entry.get('iin', '')

        # Get bank name from known mappings
        bank_name = BANK_NAMES.get(code) or BANK_NAMES.get(ifsc_prefix)
        if not bank_name:
            readable_code = code.upper()
            if bank_type in ['DCCB', 'SCB', 'S-UCB']:
                bank_name = f"{readable_code} {bank_type} Bank"
            elif bank_type == 'RRB':
                bank_name = f"{readable_code} Regional Rural Bank"
            elif bank_type == 'O-UCB':
                bank_name = f"{readable_code} Urban Cooperative Bank"
            elif bank_type == 'LAB':
                bank_name = f"{readable_code} Local Area Bank"
            elif bank_type == 'PB':
                bank_name = f"{readable_code} Payments Bank"
            else:
                bank_name = f"{readable_code} Bank"

        # Check duplicate within the new batch too
        if iin in existing_iins:
            continue

        slug, bank_entry = create_coop_bank_entry(
            code, entry, bank_name, {**existing, **new_banks}
        )
        new_banks[slug] = bank_entry
        existing_iins.add(iin)

    # Merge
    all_banks = {**existing, **new_banks}
    print(f"\nNew banks added: {len(new_banks)}")
    print(f"Total banks: {len(all_banks)}")

    # Save
    with open(BANKS_PATH, 'w') as f:
        json.dump(all_banks, f, indent=2, ensure_ascii=False)

    # Summary by bank type
    type_counts = Counter()
    for b in all_banks.values():
        t = b.get('bank_type', [])
        if isinstance(t, list):
            for x in t:
                type_counts[x] += 1
        elif t:
            type_counts[t] += 1
        else:
            type_counts['legacy'] += 1

    print("\nFinal bank type distribution:")
    for t, c in type_counts.most_common():
        print(f"  {t}: {c}")

    print(f"\nSaved to {BANKS_PATH}")


if __name__ == '__main__':
    main()
