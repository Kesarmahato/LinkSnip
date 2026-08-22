from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .auth import get_current_user

from app.database import get_db
from .models import Link, Click, User

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
    # Find the link
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
    
    if link.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to access this link",
    )

    # Get all clicks for this link

    clicks = (
        db.query(Click)
        .filter(Click.link_id == link_id)
        .order_by(Click.clicked_at.asc())
        .all()
    )

    # Total clicks

    total_clicks = len(clicks)

    # Devices

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
        for device, count in device_counter.items()
    ]

    # Browsers

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
        for browser, count in browser_counter.items()
    ]

    # Operating systems

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
        for operating_system, count in os_counter.items()
    ]

    # Referrers

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

    # Clicks over time

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

    # Countries

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

    # Cities

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

    # Final response

    return {
        "link_id": link.id,
        "short_code": link.short_code,
        "custom_alias": link.custom_alias,
        "original_url": link.original_url,
        "total_clicks": total_clicks,
        "clicks_over_time": clicks_over_time,
        "top_referrers": top_referrers,
        "devices": devices,
        "browsers": browsers,
        "operating_systems": operating_systems,
        "countries": countries,
        "cities": cities,
    }