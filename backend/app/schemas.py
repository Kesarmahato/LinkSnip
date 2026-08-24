from datetime import datetime
import re

from pydantic import BaseModel, ConfigDict, HttpUrl, field_validator


ALIAS_PATTERN = r"[A-Za-z0-9-]+"


class LinkCreate(BaseModel):
    url: HttpUrl
    custom_alias: str | None = None
    expires_at: datetime | None = None
    expires_after_clicks: int | None = None
    folder: str | None = None
    tags: list[str] = []

    @field_validator("custom_alias")
    @classmethod
    def validate_custom_alias(cls, value):
        if value is None or value == "":
            return None
        value = value.strip()
        if not 3 <= len(value) <= 30:
            raise ValueError("Custom alias must be between 3 and 30 characters")
        if not re.fullmatch(ALIAS_PATTERN, value):
            raise ValueError("Custom alias may contain only letters, numbers, and hyphens")
        return value

    @field_validator("expires_after_clicks")
    @classmethod
    def validate_click_limit(cls, value):
        if value is not None and value < 1:
            raise ValueError("Click limit must be at least 1")
        return value

    @field_validator("folder")
    @classmethod
    def validate_folder(cls, value):
        if value is None:
            return None
        value = value.strip()
        if len(value) > 100:
            raise ValueError("Folder name must be 100 characters or fewer")
        return value or None

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value):
        cleaned = []
        for tag in value or []:
            tag = tag.strip()
            if tag and tag not in cleaned:
                cleaned.append(tag[:50])
        return cleaned[:20]


class LinkUpdate(BaseModel):
    url: HttpUrl | None = None
    custom_alias: str | None = None
    expires_at: datetime | None = None
    expires_after_clicks: int | None = None
    folder: str | None = None
    tags: list[str] = []

    @field_validator("custom_alias")
    @classmethod
    def validate_custom_alias(cls, value):
        if value is None or value == "":
            return None
        value = value.strip()
        if not 3 <= len(value) <= 30:
            raise ValueError("Custom alias must be between 3 and 30 characters")
        if not re.fullmatch(ALIAS_PATTERN, value):
            raise ValueError("Custom alias may contain only letters, numbers, and hyphens")
        return value

    @field_validator("expires_after_clicks")
    @classmethod
    def validate_click_limit(cls, value):
        if value is not None and value < 1:
            raise ValueError("Click limit must be at least 1")
        return value

    @field_validator("folder")
    @classmethod
    def validate_folder(cls, value):
        if value is None:
            return None
        value = value.strip()
        if len(value) > 100:
            raise ValueError("Folder name must be 100 characters or fewer")
        return value or None

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value):
        cleaned = []
        for tag in value or []:
            tag = tag.strip()
            if tag and tag not in cleaned:
                cleaned.append(tag[:50])
        return cleaned[:20]


class LinkResponse(BaseModel):
    id: int
    original_url: str
    short_code: str
    short_url: str
    custom_alias: str | None = None
    expires_at: datetime | None = None
    expires_after_clicks: int | None = None
    folder: str | None = None
    tags: list[str] = []
    clicks: int = 0
    created_at: datetime
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
