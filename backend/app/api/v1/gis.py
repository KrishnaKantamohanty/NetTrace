from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from app.db.postgres import get_db
from app.models.postgres_models import CDRRecord, User
from app.core.security import get_current_user
from app.services.analytics.tower_dump import TowerDumpService

router = APIRouter(prefix="/gis", tags=["Geo-Spatial GIS Tracking"])

@router.get("/towers/{case_id}")
def get_case_towers(case_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Extracts all unique cell tower locations with aggregated transaction metrics."""
    records = db.query(CDRRecord).filter(
        CDRRecord.case_id == case_id,
        CDRRecord.latitude.isnot(None),
        CDRRecord.longitude.isnot(None)
    ).all()

    towers = {}
    for r in records:
        tid = r.cell_tower_id or f"TOW-{round(r.latitude, 4)}_{round(r.longitude, 4)}"
        if tid not in towers:
            towers[tid] = {
                "tower_id": tid,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "azimuth": r.azimuth,
                "operator": r.operator or "Unknown",
                "total_hits": 0,
                "unique_callers": set(),
                "last_active": r.timestamp.isoformat()
            }
        towers[tid]["total_hits"] += 1
        towers[tid]["unique_callers"].add(r.caller_number)
        if r.timestamp.isoformat() > towers[tid]["last_active"]:
            towers[tid]["last_active"] = r.timestamp.isoformat()

    res = []
    for t in towers.values():
        t["unique_caller_count"] = len(t["unique_callers"])
        t["unique_callers"] = list(t["unique_callers"])[:10] # sample
        res.append(t)

    return res

@router.get("/route/{case_id}/{phone_number}")
def get_suspect_route(
    case_id: str,
    phone_number: str,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns chronologically ordered location trace for a suspect phone number,
    enabling dynamic map playback.
    """
    query = db.query(CDRRecord).filter(
        CDRRecord.case_id == case_id,
        (CDRRecord.caller_number == phone_number) | (CDRRecord.receiver_number == phone_number),
        CDRRecord.latitude.isnot(None),
        CDRRecord.longitude.isnot(None)
    )

    if start_time:
        query = query.filter(CDRRecord.timestamp >= start_time)
    if end_time:
        query = query.filter(CDRRecord.timestamp <= end_time)

    records = query.order_by(CDRRecord.timestamp.asc()).all()

    route_points = []
    for r in records:
        route_points.append({
            "id": r.id,
            "timestamp": r.timestamp.isoformat(),
            "caller": r.caller_number,
            "receiver": r.receiver_number,
            "call_type": r.call_type,
            "duration": r.duration_seconds,
            "tower_id": r.cell_tower_id,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "azimuth": r.azimuth,
            "imei": r.imei
        })

    return {
        "case_id": case_id,
        "phone_number": phone_number,
        "total_breadcrumbs": len(route_points),
        "route": route_points
    }

from pydantic import BaseModel, Field

class TowerDumpRequest(BaseModel):
    tower_ids: Optional[List[str]] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    radius_km: Optional[float] = 2.0

@router.post("/tower-dump/{case_id}")
def run_tower_dump(
    case_id: str,
    payload: Optional[TowerDumpRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Multi-CDR geo intersection finder."""
    req = payload or TowerDumpRequest()
    return TowerDumpService.analyze_tower_dump(
        db=db,
        case_id=case_id,
        tower_ids=req.tower_ids,
        start_time=req.start_time,
        end_time=req.end_time,
        center_lat=req.lat,
        center_lon=req.lon,
        radius_km=req.radius_km if req.radius_km is not None else 2.0
    )

@router.get("/co-travelers/{case_id}")
def get_co_travelers(
    case_id: str,
    target_msisdn: Optional[str] = Query(None, description="Target phone number to track companions for"),
    window_minutes: int = Query(30, ge=5, le=180, description="Max time gap at same tower checkpoint in minutes"),
    min_shared_towers: int = Query(2, ge=1, le=20, description="Minimum shared sequential tower checkpoints"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Trajectory & Co-Traveler Analysis: Compares spatial-temporal paths of 2+ devices
    moving together across the same tower sequence within time windows.
    """
    from app.services.gis.co_traveler import CoTravelerService
    return CoTravelerService.analyze_co_travelers(
        db=db,
        case_id=case_id,
        target_msisdn=target_msisdn,
        window_minutes=window_minutes,
        min_shared_towers=min_shared_towers
    )


