import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.postgres_models import Base, CaseMetadata, CDRRecord, ChainOfCustodyLog
from app.services.analytics.case_management import CaseManagementService

# In-memory test sqlite engine
engine = create_engine("sqlite:///:memory:", echo=False)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()

def test_start_new_investigation(db_session):
    res = CaseManagementService.start_new_investigation(
        db=db_session,
        case_id="CASE-TEST-001",
        case_name="Operation Test Alpha",
        investigator_name="Insp. Vikram (CC-101)",
        description="Fresh automated testing investigation"
    )
    assert res["success"] is True
    assert res["case"]["case_id"] == "CASE-TEST-001"

    # Verify presence in database
    meta = db_session.query(CaseMetadata).filter(CaseMetadata.case_id == "CASE-TEST-001").first()
    assert meta is not None
    assert meta.case_name == "Operation Test Alpha"

def test_clear_investigation_data(db_session):
    # Populate test CDR records
    case_a = "CASE-TEST-001"
    case_b = "CASE-TEST-002"

    # Seed Case B
    CaseManagementService.start_new_investigation(
        db=db_session, case_id=case_b, case_name="Operation Case B"
    )

    rec1 = CDRRecord(
        case_id=case_a, caller_number="9811012345", receiver_number="9876543210",
        timestamp=datetime.utcnow(), duration_seconds=120, call_type="VOICE"
    )
    rec2 = CDRRecord(
        case_id=case_b, caller_number="9999900000", receiver_number="8888800000",
        timestamp=datetime.utcnow(), duration_seconds=60, call_type="VOICE"
    )
    db_session.add_all([rec1, rec2])
    db_session.commit()

    # Clear Case A only
    clear_res = CaseManagementService.clear_investigation_data(
        db=db_session, case_id=case_a, operator_badge="TEST-BADGE-1", preserve_metadata=True
    )
    assert clear_res["success"] is True
    assert clear_res["total_records_deleted"] == 1

    # Verify Case A CDRs are 0, but Case B is untouched
    cnt_a = db_session.query(CDRRecord).filter(CDRRecord.case_id == case_a).count()
    cnt_b = db_session.query(CDRRecord).filter(CDRRecord.case_id == case_b).count()
    assert cnt_a == 0
    assert cnt_b == 1

    # Verify chain of custody audit log recorded
    audit = db_session.query(ChainOfCustodyLog).filter(
        ChainOfCustodyLog.case_id == case_a, ChainOfCustodyLog.event_type == "CASE_DATA_CLEARED"
    ).first()
    assert audit is not None
    assert audit.investigator_badge == "TEST-BADGE-1"

def test_admin_reset_all_data(db_session):
    reset_res = CaseManagementService.admin_reset_all_data(
        db=db_session, admin_badge="ADM-TEST"
    )
    assert reset_res["success"] is True

    # All CDRs must be purged
    total_cdrs = db_session.query(CDRRecord).count()
    assert total_cdrs == 0
