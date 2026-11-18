import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.postgres_models import Base, CDRRecord
from app.services.analytics.party_analysis import PartyAnalysisService

engine = create_engine("sqlite:///:memory:", echo=False)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    case_id = "CASE-PARTY-TEST"
    now = datetime(2026, 3, 1, 10, 0, 0)

    # 3 calls from A -> B
    # 2 calls from B -> A
    # 1 call from A -> C
    records = [
        CDRRecord(case_id=case_id, caller_number="9811000001", receiver_number="9811000002",
                  timestamp=now, duration_seconds=100, call_type="VOICE"),
        CDRRecord(case_id=case_id, caller_number="9811000001", receiver_number="9811000002",
                  timestamp=now + timedelta(hours=1), duration_seconds=200, call_type="VOICE"),
        CDRRecord(case_id=case_id, caller_number="9811000001", receiver_number="9811000002",
                  timestamp=now + timedelta(hours=2), duration_seconds=300, call_type="VOICE"),
        CDRRecord(case_id=case_id, caller_number="9811000002", receiver_number="9811000001",
                  timestamp=now + timedelta(hours=3), duration_seconds=150, call_type="VOICE"),
        CDRRecord(case_id=case_id, caller_number="9811000002", receiver_number="9811000001",
                  timestamp=now + timedelta(hours=4), duration_seconds=50, call_type="VOICE"),
        CDRRecord(case_id=case_id, caller_number="9811000001", receiver_number="9811000003",
                  timestamp=now + timedelta(hours=5), duration_seconds=80, call_type="VOICE"),
    ]
    session.add_all(records)
    session.commit()

    yield session
    session.close()

def test_directional_party_analysis_pair(db_session):
    res = PartyAnalysisService.get_party_call_analysis(
        db=db_session,
        case_id="CASE-PARTY-TEST",
        party_a="9811000001",
        party_b="9811000002",
        direction="ALL"
    )

    pair = res["pair_summary"]
    assert pair is not None
    assert pair["party_a"] == "9811000001"
    assert pair["party_b"] == "9811000002"
    assert pair["total_calls"] == 5
    assert pair["a_to_b_count"] == 3
    assert pair["b_to_a_count"] == 2
    assert pair["total_duration"] == 800  # 100+200+300 + 150+50
    assert pair["formatted_total_duration"] == "00:13:20"

def test_directional_filter_a_to_b(db_session):
    res = PartyAnalysisService.get_party_call_analysis(
        db=db_session,
        case_id="CASE-PARTY-TEST",
        party_a="9811000001",
        party_b="9811000002",
        direction="A_TO_B"
    )
    assert len(res["records"]) == 3
    for r in res["records"]:
        assert r["direction_indicator"] == "A_TO_B"
        assert r["caller_msisdn"] == "9811000001"
        assert r["receiver_msisdn"] == "9811000002"

def test_directional_filter_b_to_a(db_session):
    res = PartyAnalysisService.get_party_call_analysis(
        db=db_session,
        case_id="CASE-PARTY-TEST",
        party_a="9811000001",
        party_b="9811000002",
        direction="B_TO_A"
    )
    assert len(res["records"]) == 2
    for r in res["records"]:
        assert r["direction_indicator"] == "B_TO_A"
        assert r["caller_msisdn"] == "9811000002"
        assert r["receiver_msisdn"] == "9811000001"
