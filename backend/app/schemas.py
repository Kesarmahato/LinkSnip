from datetime import datetime

from pydantic import BaseModel, ConfigDict, HttpUrl


class LinkCreate(BaseModel):
    url: HttpUrl
    custom_alias: str | None = None
    expires_at: datetime | None = None


class LinkResponse(BaseModel):
    id: int
    original_url: str
    short_code: str
    short_url: str
    custom_alias: str | None = None
    expires_at: datetime | None = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)