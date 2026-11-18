from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

# Authentication
class UserLogin(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    badge_number: Optional[str] = None
    role: Optional[str] = "INVESTIGATOR"

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    badge_number: Optional[str] = None
    role: str

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenData(BaseModel):
    username: Optional[str] = None

# Case Schemas
class CaseCreate(BaseModel):
    case_id: str
    case_name: str
    investigator_name: Optional[str] = "Forensics Unit"
    description: Optional[str] = None

class CaseResponse(BaseModel):
    id: int
    case_id: str
    case_name: str
    investigator_name: Optional[str] = None
    description: Optional[str] = None
    status: str
    created_at: datetime
    record_count: Optional[int] = 0

    class Config:
        from_attributes = True

# CDR Schemas
class CDRRecordBase(BaseModel):
    case_id: str
    caller_number: str
    receiver_number: str
    timestamp: datetime
    duration_seconds: int = 0
    call_type: Optional[str] = "VOICE"
    imei: Optional[str] = None
    imsi: Optional[str] = None
    cell_tower_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    azimuth: Optional[int] = None
    operator: Optional[str] = None

class CDRRecordCreate(CDRRecordBase):
    raw_source: Optional[str] = None

class CDRRecordResponse(CDRRecordBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Ingestion Schemas
class IngestionResult(BaseModel):
    total_parsed: int
    valid_records: int
    skipped_records: int
    operator_detected: str
    case_id: str
    errors: List[str] = []
    graph_sync_status: Optional[str] = None

# Graph Schemas
class GraphNode(BaseModel):
    id: str
    label: str
    degree: int = 0
    betweenness: float = 0.0
    pagerank: float = 0.0
    totalCalls: int = 0
    totalDuration: int = 0
    lateNightCalls: int = 0
    isSuspect: bool = False
    isHub: bool = False
    isBridge: bool = False
    operator: Optional[str] = "Unknown"
    imeis: List[str] = []

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    weight: int = 1 # total interactions
    callCount: int = 0
    smsCount: int = 0
    totalDuration: int = 0
    firstCall: Optional[str] = None
    lastCall: Optional[str] = None

class NetworkGraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    stats: Dict[str, Any]

class CommonContactRequest(BaseModel):
    case_id: str
    numbers: List[str]

class CommonContactResult(BaseModel):
    common_contact: str
    interaction_breakdown: Dict[str, Dict[str, Any]]
    total_mutual_interactions: int

class ShortestPathRequest(BaseModel):
    case_id: str
    source_number: str
    target_number: str

class ShortestPathResponse(BaseModel):
    found: bool = True
    path: List[str]
    length: int
    nodes: Optional[List[Any]] = []
    edges: Optional[List[Any]] = []

class MultiHopRequest(BaseModel):
    case_id: str
    seed_number: str
    max_hops: int = 2

# Analytics & GIS Schemas
class HourlySpike(BaseModel):
    hour: int
    total_calls: int
    voice_calls: int
    sms_count: int
    duration_minutes: float

class IMEISwapItem(BaseModel):
    imei: str
    associated_sims: List[str]
    sim_count: int
    first_seen: str
    last_seen: str
    suspicious_score: float

class SIMSwapItem(BaseModel):
    phone_number: str
    associated_imeis: List[str]
    imei_count: int
    first_seen: str
    last_seen: str

class IMEITrackerResponse(BaseModel):
    multi_sim_imeis: List[IMEISwapItem]
    multi_imei_sims: List[SIMSwapItem]

class TowerDumpRequest(BaseModel):
    case_id: str
    tower_ids: Optional[List[str]] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: Optional[float] = 2.0

class TowerDumpSuspectMatch(BaseModel):
    phone_number: str
    tower_hits: int
    matching_towers: List[str]
    timestamps: List[datetime]
    imei: Optional[str] = None
    co_presence_score: float

class TowerDumpResponse(BaseModel):
    total_hits: int
    unique_numbers: int
    matched_suspects: List[TowerDumpSuspectMatch]

class RoutePoint(BaseModel):
    timestamp: datetime
    caller_number: str
    receiver_number: str
    cell_tower_id: Optional[str]
    latitude: float
    longitude: float
    duration_seconds: int
    call_type: str
    imei: Optional[str]
