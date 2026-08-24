from datetime import datetime
import re

from pydantic import BaseModel, ConfigDict, HttpUrl, field_validator


class LinkCreate(BaseModel):
    url: HttpUrl
    custom_alias: str | None = None
    expires_at: datetime | None = None

    @field_validator("custom_alias")
    @classmethod
    def validate_custom_alias(cls, value):
        if value is None or value == "":
            return None

        value = value.strip()

        if not 3 <= len(value) <= 30:
            raise ValueError(
                "Custom alias must be between 3 and 30 characters"
            )

        if not re.fullmatch(r"[A-Za-z0-9-]+", value):
            raise ValueError(
                "Custom alias may contain only letters, numbers, and hyphens"
            )

        return value


class LinkResponse(BaseModel):
    id: int
    original_url: str
    short_code: str
    short_url: str
    custom_alias: str | None = None
    expires_at: datetime | None = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)