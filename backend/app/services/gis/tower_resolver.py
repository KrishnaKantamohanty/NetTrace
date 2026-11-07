import os
import csv
from typing import Optional, Tuple, Dict
from sqlalchemy.orm import Session
from app.models.postgres_models import TowerMetadata

class TowerResolver:
    _csv_cache: Optional[Dict[str, Dict]] = None

    @classmethod
    def _load_csv_master(cls) -> Dict[str, Dict]:
        if cls._csv_cache is not None:
            return cls._csv_cache

        cache = {}
        paths = [
            os.path.join(os.path.dirname(__file__), "..", "..", "..", "sample_data", "cell_tower_master.csv"),
            os.path.join(os.getcwd(), "sample_data", "cell_tower_master.csv"),
            os.path.join(os.getcwd(), "backend", "sample_data", "cell_tower_master.csv"),
        ]

        for p in paths:
            if os.path.exists(p):
                try:
                    with open(p, mode="r", encoding="utf-8-sig") as f:
                        reader = csv.DictReader(f)
                        for row in reader:
                            tid = row.get("tower_id", "").strip()
                            if tid:
                                try:
                                    cache[tid.lower()] = {
                                        "tower_id": tid,
                                        "latitude": float(row.get("latitude", 0)),
                                        "longitude": float(row.get("longitude", 0)),
                                        "azimuth": int(float(row.get("azimuth", 0))) if row.get("azimuth") else None,
                                        "operator": row.get("operator", "Unknown"),
                                        "circle": row.get("circle", ""),
                                        "address": row.get("site_address", "")
                                    }
                                except Exception:
                                    pass
                    break
                except Exception as e:
                    print(f"Error loading cell tower master CSV from {p}: {e}")

        cls._csv_cache = cache
        return cls._csv_cache

    @classmethod
    def resolve_tower(
        cls,
        tower_id_or_cgi: Optional[str],
        db: Optional[Session] = None,
        operator: Optional[str] = None
    ) -> Optional[Tuple[float, float, Optional[int]]]:
        """
        Resolves tower coordinates (lat, lng, azimuth) using:
        1. Local cell_tower_master cache
        2. Database tower_metadata table
        3. Normalized CGI matching
        """
        if not tower_id_or_cgi:
            return None

        raw = str(tower_id_or_cgi).strip().strip("'\"")
        if not raw or raw.lower() in ["-", "--", "---", "none", "nan", "0"]:
            return None

        # 1. Query in-memory master dictionary
        master = cls._load_csv_master()
        key = raw.lower()
        if key in master:
            entry = master[key]
            return entry["latitude"], entry["longitude"], entry["azimuth"]

        # Partial / normalized key matching (e.g. without trailing sector/dashes)
        normalized = key.replace("/", "-").replace(" ", "")
        for k, entry in master.items():
            if k == normalized or k in normalized or normalized in k:
                return entry["latitude"], entry["longitude"], entry["azimuth"]

        # 2. Query DB tower_metadata table if db session passed
        if db is not None:
            try:
                db_tower = db.query(TowerMetadata).filter(
                    TowerMetadata.tower_id.ilike(f"%{raw}%")
                ).first()
                if db_tower:
                    return db_tower.latitude, db_tower.longitude, db_tower.azimuth
            except Exception:
                pass

        # 3. Known MCC-MNC Telecom Circle Geolocation Fallback
        # 404-10: Delhi Airtel; 404-97: UP West; 405-864: Jio Delhi; 404-20: Mumbai
        if "404-10" in raw or "40410" in raw:
            return 28.6139, 77.2090, 90  # Delhi Central
        elif "404-97" in raw or "40497" in raw:
            return 28.9845, 77.7064, 120 # UP West / Meerut
        elif "404-20" in raw or "40420" in raw:
            return 19.0760, 72.8777, 180 # Mumbai
        elif "405-864" in raw or "405864" in raw:
            return 28.5355, 77.3910, 45  # NCR Jio
        elif "404-45" in raw or "40445" in raw:
            return 12.9716, 77.5946, 60  # Bangalore Karnataka

        return None
