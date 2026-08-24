from collections import Counter
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Click, Link, User


router = APIRouter(
    prefix="/api/links",
    tags=["Analytics"],
)


@router.get("/{link_id}/analytics")
def get_link_analytics(
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # ---------------------------------------------------------
    # 1. Find the link
    # ---------------------------------------------------------
    link = (
        db.query(Link)
        .filter(Link.id == link_id)
        .first()
    )

    if not link:
        raise HTTPException(
            status_code=404,
            detail="Link not found",
        )

    # ---------------------------------------------------------
    # 2. Check ownership
    # ---------------------------------------------------------
    if link.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to access this link",
        )

    # ---------------------------------------------------------
    # 3. Get all clicks
    # ---------------------------------------------------------
    clicks = (
        db.query(Click)
        .filter(Click.link_id == link_id)
        .order_by(Click.clicked_at.asc())
        .all()
    )

    # ---------------------------------------------------------
    # 4. Total clicks
    # ---------------------------------------------------------
    total_clicks = len(clicks)

    # ---------------------------------------------------------
    # 5. Today's clicks
    # ---------------------------------------------------------
    today = datetime.now(timezone.utc).date()

    today_clicks = sum(
        1
        for click in clicks
        if click.clicked_at
        and click.clicked_at.date() == today
    )

    # ---------------------------------------------------------
    # 6. Devices
    # ---------------------------------------------------------
    device_counter = Counter(
        click.device_type
        for click in clicks
        if click.device_type
    )

    devices = [
        {
            "device": device,
            "clicks": count,
        }
        for device, count in device_counter.most_common()
    ]

    # ---------------------------------------------------------
    # 7. Browsers
    # ---------------------------------------------------------
    browser_counter = Counter(
        click.browser
        for click in clicks
        if click.browser
    )

    browsers = [
        {
            "browser": browser,
            "clicks": count,
        }
        for browser, count in browser_counter.most_common()
    ]

    # ---------------------------------------------------------
    # 8. Operating systems
    # ---------------------------------------------------------
    os_counter = Counter(
        click.operating_system
        for click in clicks
        if click.operating_system
    )

    operating_systems = [
        {
            "operating_system": operating_system,
            "clicks": count,
        }
        for operating_system, count in os_counter.most_common()
    ]

    # ---------------------------------------------------------
    # 9. Referrers
    # ---------------------------------------------------------
    referrer_counter = Counter(
        click.referrer
        for click in clicks
        if click.referrer
    )

    top_referrers = [
        {
            "referrer": referrer,
            "clicks": count,
        }
        for referrer, count in referrer_counter.most_common(10)
    ]

    # ---------------------------------------------------------
    # 10. Clicks over time
    # ---------------------------------------------------------
    clicks_by_date = Counter(
        click.clicked_at.strftime("%Y-%m-%d")
        for click in clicks
        if click.clicked_at
    )

    clicks_over_time = [
        {
            "date": date,
            "clicks": count,
        }
        for date, count in sorted(clicks_by_date.items())
    ]

    # ---------------------------------------------------------
    # 11. Countries
    # ---------------------------------------------------------
    country_counter = Counter(
        click.country
        for click in clicks
        if click.country
    )

    countries = [
        {
            "country": country,
            "clicks": count,
        }
        for country, count in country_counter.most_common(10)
    ]

    # 12. Cities

    city_counter = Counter(
        click.city
        for click in clicks
        if click.city
    )

    cities = [
        {
            "city": city,
            "clicks": count,
        }
        for city, count in city_counter.most_common(10)
    ]

    #  Return analytics
   
    return {
        "link_id": link.id,
        "short_code": link.short_code,
        "custom_alias": link.custom_alias,
        "original_url": link.original_url,
        "total_clicks": total_clicks,
        "today_clicks": today_clicks,
        "clicks_over_time": clicks_over_time,
        "top_referrers": top_referrers,
        "devices": devices,
        "browsers": browsers,
        "operating_systems": operating_systems,
        "countries": countries,
        "cities": cities,
    }