import pandas as pd
from typing import List, Dict, Any, Tuple
from app.services.ingestion.parser_base import BaseCDRParser

class JioCDRParser(BaseCDRParser):
    OPERATOR_NAME = "Jio"

    def parse(self, df: pd.DataFrame, case_id: str, filename: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        normalized = []
        errors = []

        col_map = {str(c).strip().lower(): c for c in df.columns}

        def get_col(candidates):
            for cand in candidates:
                if cand in col_map:
                    return col_map[cand]
            return None

        caller_col = get_col(["msisdn", "source_number", "calling_party", "source_msisdn", "orig_number", "calling_no", "source", "calling number", "a_party"])
        receiver_col = get_col(["destination_number", "other_party", "called_party", "dest_msisdn", "term_number", "called_no", "target_msisdn", "called number", "b_party"])
        
        target_col = get_col(["target no", "target_no", "target number", "target_number", "target", "targetno"])
        b_party_col = get_col(["b party no", "b_party_no", "b party number", "b_party_number", "b party", "b_party", "b-party"])

        is_lea_target_format = False
        if (not caller_col or not receiver_col) and (target_col and (b_party_col or receiver_col)):
            is_lea_target_format = True
            caller_col = target_col
            receiver_col = b_party_col or receiver_col
        elif target_col and b_party_col:
            is_lea_target_format = True
            caller_col = target_col
            receiver_col = b_party_col

        dt_col = get_col(["call_start_date_time", "start_time", "event_date_time", "start_date_time", "datetime", "timestamp", "session_start", "date time"])
        date_col = get_col(["start_date", "date", "event_date", "call date"])
        time_col = get_col(["start_time", "time", "event_time", "call time"])
        dur_col = get_col(["dur(s)", "dur (s)", "duration_in_sec", "duration_seconds", "duration", "actual_duration", "duration_sec", "billable_duration"])
        type_col = get_col(["call_service_type", "record_type", "service_type", "call_type", "traffic_type", "bearer_service"])
        service_type_col = get_col(["service type", "service_type", "call_nature"])
        imei_col = get_col(["imei_number", "imei", "device_imei", "source_imei", "imeisv"])
        imsi_col = get_col(["imsi_number", "imsi", "source_imsi", "device_imsi"])
        tower_col = get_col(["cell_id", "cgi", "ecgi", "first_cgi", "source_cell_id", "cell_global_id", "site_id"])
        combined_lat_lng_col = get_col(["first cgi lat/long", "cgi lat/long", "lat/long", "latitude/longitude", "lat_long", "lat/lng"])
        lat_col = get_col(["lat", "latitude", "cell_lat", "site_latitude"])
        lng_col = get_col(["long", "longitude", "lng", "cell_long", "site_longitude"])
        azimuth_col = get_col(["azimuth", "cell_azimuth", "beam_direction", "azimuth_angle"])

        if not caller_col or not receiver_col:
            errors.append(f"Jio Parser: Missing caller or receiver column in {filename}")
            return [], errors

        for idx, row in df.iterrows():
            try:
                raw_type = str(row.get(type_col, "VOLTE")).strip().upper() if type_col else "VOLTE"
                raw_st = str(row.get(service_type_col, "")).strip().upper() if service_type_col else ""

                if is_lea_target_format:
                    target_val = self.clean_phone_number(row.get(caller_col))
                    other_val = self.clean_phone_number(row.get(receiver_col))
                    if not target_val or not other_val:
                        continue
                    if raw_type in ["IN", "SMT", "INCOMING", "TERM", "TERMINATING", "MT"]:
                        caller = other_val
                        receiver = target_val
                    else:
                        caller = target_val
                        receiver = other_val
                else:
                    caller = self.clean_phone_number(row.get(caller_col))
                    receiver = self.clean_phone_number(row.get(receiver_col))
                    if not caller or not receiver:
                        continue

                if dt_col:
                    dt = self.parse_datetime(row.get(dt_col))
                elif date_col:
                    dt = self.parse_datetime(row.get(date_col), row.get(time_col) if time_col else None)
                else:
                    continue

                if not dt:
                    continue

                duration = self.clean_duration(row.get(dur_col)) if dur_col else 0

                if "SMS" in raw_st or any(k in raw_type for k in ["SMS", "SMT", "SMO", "DSM"]):
                    call_type = "SMS"
                elif any(k in raw_type for k in ["DATA", "LTE_DATA", "PACKET", "GPRS"]):
                    call_type = "DATA"
                elif "ROAM" in raw_type:
                    call_type = "ROAMING"
                else:
                    call_type = "VOICE"

                imei = None
                if imei_col and not pd.isna(row.get(imei_col)):
                    raw_imei = str(row.get(imei_col)).strip().strip("'\"")
                    if raw_imei and raw_imei.lower() not in ["-", "--", "---", "none", "nan", "0"]:
                        imei = raw_imei[:30]

                imsi = None
                if imsi_col and not pd.isna(row.get(imsi_col)):
                    raw_imsi = str(row.get(imsi_col)).strip().strip("'\"")
                    if raw_imsi and raw_imsi.lower() not in ["-", "--", "---", "none", "nan", "0"]:
                        imsi = raw_imsi[:30]

                tower = str(row.get(tower_col)).strip().strip("'\"") if tower_col and not pd.isna(row.get(tower_col)) else None

                lat = None
                lng = None
                if combined_lat_lng_col and not pd.isna(row.get(combined_lat_lng_col)):
                    raw_coords = str(row.get(combined_lat_lng_col)).strip().strip("'\"")
                    if "/" in raw_coords:
                        parts = raw_coords.split("/")
                        try:
                            lat = float(parts[0].strip())
                            lng = float(parts[1].strip())
                        except Exception:
                            pass
                    elif "," in raw_coords:
                        parts = raw_coords.split(",")
                        try:
                            lat = float(parts[0].strip())
                            lng = float(parts[1].strip())
                        except Exception:
                            pass

                if lat is None and lat_col and not pd.isna(row.get(lat_col)):
                    try:
                        lat = float(str(row.get(lat_col)).strip().strip("'\""))
                    except Exception:
                        pass
                if lng is None and lng_col and not pd.isna(row.get(lng_col)):
                    try:
                        lng = float(str(row.get(lng_col)).strip().strip("'\""))
                    except Exception:
                        pass

                azimuth = None
                if azimuth_col and not pd.isna(row.get(azimuth_col)):
                    try:
                        azimuth = int(float(str(row.get(azimuth_col)).strip().strip("'\"")))
                    except Exception:
                        pass

                # Fallback: Query cell_tower_master / tower_metadata if lat/long is missing
                if (lat is None or lng is None) and tower:
                    from app.services.gis.tower_resolver import TowerResolver
                    resolved = TowerResolver.resolve_tower(tower, operator="Jio")
                    if resolved:
                        lat, lng, res_az = resolved
                        if azimuth is None:
                            azimuth = res_az

                normalized.append({
                    "case_id": case_id,
                    "caller_number": caller,
                    "receiver_number": receiver,
                    "timestamp": dt,
                    "duration_seconds": duration,
                    "call_type": call_type,
                    "imei": imei,
                    "imsi": imsi,
                    "cell_tower_id": tower,
                    "latitude": lat,
                    "longitude": lng,
                    "azimuth": azimuth,
                    "operator": self.OPERATOR_NAME,
                    "raw_source": filename,
                })
            except Exception as e:
                errors.append(f"Row {idx} parse failure: {str(e)}")

        return normalized, errors
