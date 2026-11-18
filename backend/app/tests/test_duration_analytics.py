import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.postgres_models import Base, CDRRecord
from app.services.analytics.duration_analytics import DurationAnalyticsService, format_duration_hms

engine = create_engine("sqlite:///:memory:", echo=False)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    case_id = "CASE-DURATION-TEST"
    now = datetime(2026, 3, 5, 12, 0, 0)

    # Durations: 0s, 30s, 120s, 3600s (1 hour)
    records = [
        CDRRecord(case_id=case_id, caller_number="9811000001", receiver_number="9811000002",
                  timestamp=now, duration_seconds=0, call_type="VOICE"),
        CDRRecord(case_id=case_id, caller_number="9811000001", receiver_number="9811000002",
                  timestamp=now + timedelta(minutes=10), duration_seconds=30, call_type="VOICE"),
        CDRRecord(case_id=case_id, caller_number="9811000002", receiver_number="9811000001",
                  timestamp=now + timedelta(minutes=20), duration_seconds=120, call_type="VOICE"),
        CDRRecord(case_id=case_id, caller_number="9811000001", receiver_number="9811000003",
                  timestamp=now + timedelta(minutes=30), duration_seconds=3600, call_type="VOICE"),
    ]
    session.add_all(records)
    session.commit()

    yield session
    session.close()

def test_duration_hh_mm_ss_formatter():
    assert format_duration_hms(0) == "00:00:00"
    assert format_duration_hms(59) == "00:00:59"
    assert format_duration_hms(60) == "00:01:00"
    assert format_duration_hms(3661) == "01:01:01"
    assert format_duration_hms(86400) == "24:00:00"

def test_duration_analytics_metrics(db_session):
    res = DurationAnalyticsService.get_duration_analytics(
        db=db_session,
        case_id="CASE-DURATION-TEST"
    )

    metrics = res["overall_metrics"]
    assert metrics["total_calls_analyzed"] == 4
    # Total: 0 + 30 + 120 + 3600 = 3750s
    assert metrics["total_talking_time_seconds"] == 3750
    assert metrics["formatted_total_talking_time"] == "01:02:30"
    assert metrics["longest_call_seconds"] == 3600
    assert metrics["formatted_longest_call"] == "01:00:00"
    assert metrics["shortest_call_seconds"] == 30  # Shortest connected call duration
    assert metrics["zero_duration_calls"] == 1

    dist = res["duration_distribution"]
    assert dist["zero_duration"] == 1
    assert dist["under_1_min"] == 1  # 30s
    assert dist["1_to_5_min"] == 1   # 120s
    assert dist["over_30_min"] == 1  # 3600s
