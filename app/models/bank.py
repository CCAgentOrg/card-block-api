import re
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import date

# Validated patterns for app store URLs
_PLAY_STORE_PATTERN = re.compile(
    r'^https://play\.google\.com/store/apps/details\?id=[a-zA-Z0-9._-]+$'
)
_APP_STORE_PATTERN = re.compile(
    r'^https://apps\.apple\.com/[a-z]{2}/app/[^/]+/id\d+$'
)

class BinRangeModel(BaseModel):
    """BIN/IIN range for identifying bank cards."""
    start: str = Field(..., description="Starting 6-digit BIN prefix")
    end: Optional[str] = Field(None, description="Ending 6-digit BIN prefix (null for single BIN)")
    cardType: Optional[str] = Field(None, description="Card type (e.g., 'Visa', 'Mastercard', 'RuPay')")

class SourceModel(BaseModel):
    """Verification source information."""
    label: str
    url: str

class BlockingInstructionModel(BaseModel):
    """Blocking instructions for a card type."""
    tollFree: str = Field(..., description="Primary toll-free number")
    number1: Optional[str] = Field(None, description="Alternative number 1")
    number2: Optional[str] = Field(None, description="Alternative number 2")
    rmn: Optional[str] = Field(None, description="SMS command from registered mobile")
    email: Optional[str] = Field(None, description="Email contact")
    website: Optional[str] = Field(None, description="Web portal URL")
    reference: Optional[str] = Field(None, description="Official reference link")
    androidApp: Optional[str] = Field(None, description="Google Play Store URL for the bank's app")
    iosApp: Optional[str] = Field(None, description="Apple App Store URL for the bank's app")
    notes: Optional[str] = Field(None, description="Additional notes")

    @field_validator('androidApp')
    @classmethod
    def validate_android_url(cls, v: Optional[str]) -> Optional[str]:
        if v and not _PLAY_STORE_PATTERN.match(v):
            raise ValueError(
                f"Invalid Google Play Store URL: {v}. "
                "Expected format: https://play.google.com/store/apps/details?id=<package_id>"
            )
        return v

    @field_validator('iosApp')
    @classmethod
    def validate_ios_url(cls, v: Optional[str]) -> Optional[str]:
        if v and not _APP_STORE_PATTERN.match(v):
            raise ValueError(
                f"Invalid App Store URL: {v}. "
                "Expected format: https://apps.apple.com/<country>/app/<app-name>/id<numeric_id>"
            )
        return v

class BankModel(BaseModel, arbitrary_types_allowed=True):
    """Full bank information."""
    id: str
    name: str
    logo: str
    ifsc: str
    blockingInstructions: dict[str, BlockingInstructionModel]
    sources: list[SourceModel]
    lastVerified: date
    binRanges: Optional[list[BinRangeModel]] = Field(None, description="BIN/IIN ranges for identifying bank's cards")

    def model_dump(self, *args, **kwargs):
        data = super().model_dump(*args, **kwargs)
        # Convert date to ISO string for JSON serialization
        if isinstance(data.get("lastVerified"), date):
            data["lastVerified"] = data["lastVerified"].isoformat()
        return data

class BankSummaryModel(BaseModel):
    """Bank summary (list view)."""
    id: str
    name: str
    logo: str
