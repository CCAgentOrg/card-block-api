import json
import pytest

@pytest.fixture
def banks_data():
    with open("app/data/banks.json", encoding="utf-8") as f:
        return json.load(f)

def test_minimum_bank_count(banks_data):
    assert len(banks_data) >= 10, "Should have at least 10 banks"

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
