import pandas as pd
from typing import Type
from app.services.ingestion.parser_base import BaseCDRParser
from app.services.ingestion.airtel_parser import AirtelCDRParser
from app.services.ingestion.jio_parser import JioCDRParser
from app.services.ingestion.vi_parser import VICDRParser

class GenericCDRParser(BaseCDRParser):
    OPERATOR_NAME = "Standard CDR"

    def parse(self, df: pd.DataFrame, case_id: str, filename: str):
        # Fall back to Airtel/Universal parser logic
        return AirtelCDRParser().parse(df, case_id, filename)

def detect_parser(df: pd.DataFrame, operator_hint: str = "AUTO") -> BaseCDRParser:
    hint = operator_hint.strip().upper()
    if hint == "AIRTEL":
        return AirtelCDRParser()
    elif hint == "JIO":
        return JioCDRParser()
    elif hint in ["VI", "VODAFONE", "IDEA", "VODAFONE IDEA"]:
        return VICDRParser()

    # Automatic inspection based on column names
    col_str = " ".join([str(c).lower() for c in df.columns])
    col_map = {str(c).strip().lower(): c for c in df.columns}

    # Indian LEA format or Airtel standard
    if any(k in col_str for k in ["target no", "b party no", "first cgi lat/long", "target_no", "b_party_no", "first cgi", "a_party", "b_party", "anumber", "bnumber"]):
        for rn_key in ["roam nw", "lrn tsp-lsa", "operator", "tsp"]:
            if rn_key in col_map:
                vals = " ".join(df[col_map[rn_key]].dropna().astype(str).unique()).upper()
                if "AIR" in vals:
                    return AirtelCDRParser()
                elif "JIO" in vals or "RJIL" in vals:
                    return JioCDRParser()
                elif "VODA" in vals or "IDEA" in vals or "VI" in vals:
                    return VICDRParser()
        return AirtelCDRParser()

    if any(k in col_str for k in ["msisdn", "dest_msisdn", "call_start_date_time", "volte", "ecgi"]):
        return JioCDRParser()
    elif any(k in col_str for k in ["originating_number", "terminating_number", "dialed_no", "cli", "cell_id_first"]):
        return VICDRParser()
    
    # Default generic
    return GenericCDRParser()
