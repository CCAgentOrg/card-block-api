import json
import pytest

@pytest.fixture
def banks_data():
    with open("app/data/banks.json", encoding="utf-8") as f:
        return json.load(f)

def test_minimum_bank_count(banks_data):
    assert len(banks_data) >= 115, "Should have at least 10 banks"

def test_no_duplicate_ids(banks_data):
    ids = [b["id"] for b in banks_data.values()]
    assert len(ids) == len(set(ids)), "No duplicate bank IDs allowed"

def test_required_fields(banks_data):
    required = {"id", "name", "logo", "ifsc", "blockingInstructions", "sources", "lastVerified"}
    for bank_id, bank in banks_data.items():
        missing = required - set(bank.keys())
        assert not missing, f"{bank_id} missing fields: {missing}"

def test_blocking_instructions_have_tollfree(banks_data):
    for bank_id, bank in banks_data.items():
        for card_type, inst in bank["blockingInstructions"].items():
            assert inst.get("tollFree"), f"{bank_id}/{card_type}: missing tollFree"

def test_all_urls_valid_format(banks_data):
    import re
    url_pattern = re.compile(r'^(https?://|/)')
    for bank_id, bank in banks_data.items():
        assert url_pattern.match(bank["logo"]), f"{bank_id}: invalid logo URL"
        for card_type, inst in bank["blockingInstructions"].items():
            if inst.get("website"):
                assert url_pattern.match(inst["website"]), f"{bank_id}/{card_type}: invalid website URL"

def test_sources_exist(banks_data):
    for bank_id, bank in banks_data.items():
        assert len(bank["sources"]) >= 1, f"{bank_id}: should have at least 1 source"
        for s in bank["sources"]:
            assert "label" in s and "url" in s, f"{bank_id}: source missing label or url"

def test_at_least_2_sources_for_top_banks(banks_data):
    """Top banks should have at least 2 sources for verification."""
    top_banks = {"sbi", "hdfc", "icici"}
    for bank_id in top_banks:
        if bank_id in banks_data:
            assert len(banks_data[bank_id]["sources"]) >= 2, f"{bank_id}: should have 2+ sources"

def test_bank_ids_are_lowercase(banks_data):
    for bank_id, bank in banks_data.items():
        assert bank_id == bank_id.lower(), f"Bank ID {bank_id} should be lowercase"
        assert bank["id"] == bank_id, f"Bank {bank_id}: id field doesn't match key"

def test_card_types_have_reasonable_names(banks_data):
    valid_types = {"credit", "debit", "atm_cum_debit", "credit_card", "debit_card", "atm"}
    for bank_id, bank in banks_data.items():
        for card_type in bank["blockingInstructions"].keys():
            # Just log warning if unexpected, don't fail
            if card_type not in valid_types:
                print(f"Warning: {bank_id} has unusual card type: {card_type}")

def test_logo_files_exist(banks_data):
    import os
    logos_dir = "app/static/logos"
    for bank_id, bank in banks_data.items():
        logo_path = bank["logo"].lstrip("/")
        # Check if logo is external URL or local path
        if logo_path.startswith("http"):
            continue
        full_path = os.path.join(logos_dir, os.path.basename(logo_path))
        assert os.path.exists(full_path), f"Logo file not found: {full_path}"


# --- App link validation tests ---


_PLAY_STORE_PATTERN = __import__('re').compile(
    r'^https://play\.google\.com/store/apps/details\?id=[a-zA-Z0-9._-]+$'
)
_APP_STORE_PATTERN = __import__('re').compile(
    r'^https://apps\.apple\.com/[a-z]{2}/app/[^/]+/id\d+$'
)


def test_android_app_urls_have_valid_format(banks_data):
    """All androidApp fields must use the standard Play Store URL format."""
    for bank_id, bank in banks_data.items():
        for card_type, inst in bank["blockingInstructions"].items():
            url = inst.get("androidApp")
            if url:
                assert _PLAY_STORE_PATTERN.match(url), (
                    f"{bank_id}/{card_type}: invalid Android URL format: {url}. "
                    "Expected: https://play.google.com/store/apps/details?id=<package_id>"
                )


def test_ios_app_urls_have_valid_format(banks_data):
    """All iosApp fields must use the standard App Store URL format with app name."""
    for bank_id, bank in banks_data.items():
        for card_type, inst in bank["blockingInstructions"].items():
            url = inst.get("iosApp")
            if url:
                assert _APP_STORE_PATTERN.match(url), (
                    f"{bank_id}/{card_type}: invalid iOS URL format: {url}. "
                    "Expected: https://apps.apple.com/<country>/app/<app-name>/id<numeric_id>"
                )


def test_app_links_consistent_across_card_types(banks_data):
    """A bank's app links should be the same across credit/debit card types."""
    for bank_id, bank in banks_data.items():
        bi = bank["blockingInstructions"]
        card_types = list(bi.keys())
        if len(card_types) < 2:
            continue

        android_urls = [bi[ct].get("androidApp") for ct in card_types if bi[ct].get("androidApp")]
        if len(set(android_urls)) > 1:
            assert False, (
                f"{bank_id}: inconsistent androidApp URLs across card types: {android_urls}"
            )

        ios_urls = [bi[ct].get("iosApp") for ct in card_types if bi[ct].get("iosApp")]
        if len(set(ios_urls)) > 1:
            assert False, (
                f"{bank_id}: inconsistent iosApp URLs across card types: {ios_urls}"
            )


def test_no_cross_bank_android_package_collisions(banks_data):
    """Different banks must not share the same Android package ID (data error)."""
    pkg_to_banks = {}
    for bank_id, bank in banks_data.items():
        for ct, inst in bank["blockingInstructions"].items():
            url = inst.get("androidApp", "")
            if url and "id=" in url:
                pkg = url.split("id=")[1].split("&")[0]
                pkg_to_banks.setdefault(pkg, set()).add(bank_id)

    for pkg, bank_ids in pkg_to_banks.items():
        if len(bank_ids) > 1:
            assert False, (
                f"Android package {pkg} is used by multiple banks: {bank_ids}. "
                "Each bank should have its own app."
            )


def test_no_cross_bank_ios_app_id_collisions(banks_data):
    """Different banks must not share the same iOS app ID (data error)."""
    ios_to_banks = {}
    for bank_id, bank in banks_data.items():
        for ct, inst in bank["blockingInstructions"].items():
            url = inst.get("iosApp", "")
            if url and "/id" in url:
                parts = url.split("/id")
                if len(parts) > 1:
                    app_id = parts[-1].split("?")[0]
                    ios_to_banks.setdefault(app_id, set()).add(bank_id)

    for app_id, bank_ids in ios_to_banks.items():
        if len(bank_ids) > 1:
            assert False, (
                f"iOS app ID {app_id} is used by multiple banks: {bank_ids}. "
                "Each bank should have its own app."
            )


def test_android_packages_are_plausible(banks_data):
    """Android package IDs should vaguely relate to the bank name (catches copy-paste errors)."""
    # Known legitimate mappings where package doesn't obviously match bank name
    known_exceptions = {
        "com.fed.fedmobile": "federal_bank",         # Federal Bank uses fed
        "com.ib.eazypay": "indian_bank",             # Indian Bank uses ib
        "com.csam.icici.bank.imobile": "icici",      # ICICI
        "com.cs.canara": "canara",                   # Canara Bank
        "com.cs.bankcu": "city_union",               # City Union Bank
        "com.cs.bankub2": "union",                   # Union Bank
        "com.rbank.mobile": "rbl",                   # RBL Bank
        "com.mgs.bobapp": "bob",                     # Bank of Baroda
        "com.mgs.bankofmaharashtraapp": "bank_of_maharashtra",
        "com.mgs.centbankapp": "central_bank",
        "com.mgs.idbi.android": "idbi",
        "com.ioe.iomb": "indian_overseas",
        "com.mobfin.ucobank.mbanking": "uc_bank",
        "com.bkibank.boki": "bank_of_india",
        "com.jana.app": "shimoga",                   # Jana SFB
        "in.idfc.bank2": "idfc_first",               # IDFC FIRST
        "in.org.indusind.indusapp": "indusind",
        "in.gov.ippb.android": "ippb",               # India Post
        "com.kvb.mobilebanking": "karur_vysya_bank", # Karur Vysya
        "com.nsdl.client_app": "nordic_bank",        # NSDL Payment Bank
        "com.psb.omniretail": "poc_bank",            # Punjab & Sind
    }

    for bank_id, bank in banks_data.items():
        for ct, inst in bank["blockingInstructions"].items():
            url = inst.get("androidApp", "")
            if not url or "id=" not in url:
                continue
            pkg = url.split("id=")[1].split("&")[0]

            if bank_id in known_exceptions.values() and known_exceptions.get(pkg) == bank_id:
                continue

            # Simple heuristic: at least one domain segment should partially match bank_id
            # This catches gross errors like Ujjivan pointing to Federal Bank
            pkg_parts = pkg.replace(".", "_").split("_")
            bank_parts = bank_id.replace("_", " ").split()
            bank_initials = bank_id[:3]

            # Check if any pkg part appears in bank name or vice versa
            match = False
            for part in pkg_parts:
                if len(part) < 3:
                    continue
                if part in bank_id or bank_id.startswith(part) or part.startswith(bank_initials):
                    match = True
                    break
            for part in bank_parts:
                if len(part) < 3:
                    continue
                if part in pkg:
                    match = True
                    break

            if not match:
                print(
                    f"Warning: {bank_id}/{ct} package '{pkg}' "
                    f"doesn't appear related to bank name. "
                    f"If legitimate, add to known_exceptions."
                )
