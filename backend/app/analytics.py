from collections import Counter
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Click, Link, User

router = APIRouter(prefix="/api/links", tags=["Analytics"])


@router.get("/{link_id}/analytics")
def get_link_analytics(
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    link = db.query(Link).filter(Link.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    if link.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to access this link")

    clicks = db.query(Click).filter(Click.link_id == link_id).order_by(Click.clicked_at.desc()).all()
    total_clicks = len(clicks)
    today = datetime.now(timezone.utc).date()
    today_clicks = sum(1 for click in clicks if click.clicked_at and click.clicked_at.date() == today)

    def counter_items(field, limit=10):
        counter = Counter(getattr(click, field) for click in clicks if getattr(click, field))
        return [{field: value, "clicks": count} for value, count in counter.most_common(limit)]

    clicks_by_date = Counter(click.clicked_at.strftime("%Y-%m-%d") for click in clicks if click.clicked_at)
    clicks_over_time = [{"date": date, "clicks": count} for date, count in sorted(clicks_by_date.items())]

    click_details = [
        {
            "timestamp": click.clicked_at,
            "referrer": click.referrer or "Direct",
            "device": click.device_type or "Unknown",
            "location": ", ".join(part for part in [click.city, click.country] if part) or "Unknown",
            "browser": click.browser or "Unknown",
            "operating_system": click.operating_system or "Unknown",
        }
        for click in clicks[:100]
    ]

    return {
        "link_id": link.id,
        "short_code": link.short_code,
        "custom_alias": link.custom_alias,
        "original_url": link.original_url,
        "total_clicks": total_clicks,
        "today_clicks": today_clicks,
        "click_limit": link.expires_after_clicks,
        "clicks_over_time": clicks_over_time,
        "top_referrers": counter_items("referrer"),
        "devices": counter_items("device_type"),
        "browsers": counter_items("browser"),
        "operating_systems": counter_items("operating_system"),
        "countries": counter_items("country"),
        "cities": counter_items("city"),
        "click_details": click_details,
    }
