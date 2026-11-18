import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.postgres_models import Base, CDRRecord
from app.services.analytics.deep_investigation import DeepInvestigationService

engine = create_engine("sqlite:///:memory:", echo=False)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    case_id = "CASE-DEEP-TEST"
    target = "9811099999"
    peer = "9876500001"
    mutual = "9999900002"

    t1 = datetime(2026, 3, 10, 2, 30, 0) # 02:30 AM (Late night call)
    t2 = datetime(2026, 3, 10, 10, 0, 0) # 7.5 hour gap (Silent period)

    records = [
        # Target calls peer late at night on Tower 101, IMEI-A
        CDRRecord(case_id=case_id, caller_number=target, receiver_number=peer,
                  timestamp=t1, duration_seconds=300, call_type="VOICE",
                  cell_tower_id="TOW-101", imei="352099001122334"),
        # Target calls mutual at 10 AM on Tower 102, swapped to IMEI-B
        CDRRecord(case_id=case_id, caller_number=target, receiver_number=mutual,
                  timestamp=t2, duration_seconds=150, call_type="VOICE",
                  cell_tower_id="TOW-102", imei="352099009988776"),
        # Peer calls mutual at 11 AM (creating common contact bridge between target and peer)
        CDRRecord(case_id=case_id, caller_number=peer, receiver_number=mutual,
                  timestamp=t2 + timedelta(hours=1), duration_seconds=90, call_type="VOICE",
                  cell_tower_id="TOW-101", imei="864500001122334"),
    ]
    session.add_all(records)
    session.commit()

    yield session
    session.close()

def test_deep_investigation_synthesis(db_session):
    res = DeepInvestigationService.run_investigation(
        db=db_session,
        case_id="CASE-DEEP-TEST",
        target_phone="9811099999",
        secondary_phone="9876500001"
    )

    profile = res["profile"]
    assert profile["target_number"] == "9811099999"
    assert profile["total_calls"] == 2
    assert profile["outgoing_calls"] == 2
    assert profile["unique_imeis"] == 2
    assert profile["unique_towers"] == 2

    # Verify common contacts detection (mutual is connected to both target & secondary)
    common = res["common_contacts"]
    assert "9999900002" in common

    # Verify shortest path between target and peer
    assert res["shortest_path"] is not None
    assert len(res["shortest_path"]) >= 2

    # Verify silent period detection (7.5 hour gap between 02:30 and 10:00)
    assert len(res["silent_periods"]) >= 1
    assert res["silent_periods"][0]["gap_duration_hours"] == 7.5

    # Verify IMEI usage history (2 unique handsets)
    assert len(res["imei_history"]) == 2

    # Verify hypotheses generation
    hypotheses = res["investigative_hypotheses"]
    assert len(hypotheses) > 0
    categories = [h["category"] for h in hypotheses]
    assert "TEMPORAL" in categories or "EQUIPMENT" in categories or "ACTIVITY_GAP" in categories
