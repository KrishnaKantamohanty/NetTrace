import pandas as pd
from typing import List, Dict, Any, Tuple
from app.services.ingestion.parser_base import BaseCDRParser

class AirtelCDRParser(BaseCDRParser):
    OPERATOR_NAME = "Airtel"

    def parse(self, df: pd.DataFrame, case_id: str, filename: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        normalized = []
        errors = []

        # Lowercase and clean column map
        col_map = {str(c).strip().lower(): c for c in df.columns}

        def get_col(candidates):
            for cand in candidates:
                if cand in col_map:
                    return col_map[cand]
            return None

        # 1. Standard A/B party columns
        caller_col = get_col([
            "calling number", "calling_number", "a_party", "anumber", "caller", "source",
            "calling party", "originating number", "a-party", "a_num", "cli", "source_number"
        ])
        receiver_col = get_col([
            "called number", "called_number", "b_party", "bnumber", "receiver", "destination",
            "called party", "terminating number", "b-party", "b_num", "dialed_no", "destination_number", "other_party"
        ])

        # 2. Indian LEA format (Target No & B Party No)
        target_col = get_col([
            "target no", "target_no", "target number", "target_number", "target", "targetno",
            "target ms", "target_msisdn", "target msisdn", "msisdn_target"
        ])
        b_party_col = get_col([
            "b party no", "b_party_no", "b party number", "b_party_number", "b party",
            "b_party", "b-party", "bparty", "b party no.", "b_party_no."
        ])

        is_lea_target_format = False
        if (not caller_col or not receiver_col) and (target_col and (b_party_col or receiver_col)):
            is_lea_target_format = True
            caller_col = target_col
            receiver_col = b_party_col or receiver_col
        elif target_col and b_party_col:
            is_lea_target_format = True
            caller_col = target_col
            receiver_col = b_party_col

        date_col = get_col(["call date", "call_date", "date", "start_date", "call start date", "event_date"])
        time_col = get_col(["call time", "call_time", "time", "start_time", "call start time", "event_time"])
        dt_col = get_col(["date time", "call date time", "datetime", "timestamp", "start_datetime", "call_start_date_time", "date & time", "date_time"])
        dur_col = get_col([
            "dur(s)", "dur (s)", "duration(s)", "duration (s)", "dur(sec)", "dur (sec)",
            "duration(sec)", "duration", "duration_sec", "call duration", "call_duration",
            "duration (s)", "actual_duration", "duration_in_sec", "duration_seconds"
        ])
        type_col = get_col(["call type", "call_type", "type", "call_nature", "service", "traffic_type", "record_type"])
        service_type_col = get_col(["service type", "service_type", "bearer_service"])
        imei_col = get_col(["imei", "caller_imei", "a_imei", "imei_number", "device_imei"])
        imsi_col = get_col(["imsi", "caller_imsi", "a_imsi", "imsi_number", "device_imsi"])
        tower_col = get_col(["first cgi", "cell id", "cell_id", "cgi", "first_cgi", "site id", "tower_id", "first cell id", "last cgi"])
        
        # Combined Lat/Long column (e.g. "First CGI Lat/Long": "28.63969/77.41769")
        combined_lat_lng_col = get_col([
            "first cgi lat/long", "first cgi lat_long", "cgi lat/long", "lat/long",
            "latitude/longitude", "lat_long", "lat/lng", "cell lat/long", "last cgi lat/long"
        ])
        lat_col = get_col(["latitude", "lat", "site latitude", "site_lat", "first cgi lat"])
        lng_col = get_col(["longitude", "long", "lng", "site longitude", "site_long", "first cgi long", "first cgi lng"])
        azimuth_col = get_col(["azimuth", "antenna_azimuth", "beam_angle", "sector_angle"])
        roam_nw_col = get_col(["roam nw", "roam_nw", "operator", "tsp", "network"])

        if not caller_col or not receiver_col:
            errors.append(f"Airtel/LEA Parser: Could not identify caller or receiver columns in {filename}")
            return [], errors

        for idx, row in df.iterrows():
            try:
                raw_type = str(row.get(type_col, "VOICE")).strip().upper() if type_col else "VOICE"
                raw_st = str(row.get(service_type_col, "")).strip().upper() if service_type_col else ""

                if is_lea_target_format:
                    target_val = self.clean_phone_number(row.get(caller_col))
                    other_val = self.clean_phone_number(row.get(receiver_col))
                    if not target_val or not other_val:
                        continue

                    # If incoming communication (IN = incoming call, SMT = incoming SMS, TERM = terminating)
                    if raw_type in ["IN", "SMT", "INCOMING", "TERM", "TERMINATING", "MT"]:
                        caller = other_val
                        receiver = target_val
                    else: # OUT = outgoing call, SMO = outgoing SMS, DSM = delivery report
                        caller = target_val
                        receiver = other_val
                else:
                    caller = self.clean_phone_number(row.get(caller_col))
                    receiver = self.clean_phone_number(row.get(receiver_col))
                    if not caller or not receiver:
                        continue

                if dt_col and not pd.isna(row.get(dt_col)):
                    dt = self.parse_datetime(row.get(dt_col))
                elif date_col and not pd.isna(row.get(date_col)):
                    dt = self.parse_datetime(row.get(date_col), row.get(time_col) if time_col else None)
                else:
                    continue

                if not dt:
                    continue

                duration = self.clean_duration(row.get(dur_col)) if dur_col else 0

                # Determine standard call_type: VOICE, SMS, DATA, ROAMING
                if "SMS" in raw_st or any(k in raw_type for k in ["SMS", "SMT", "SMO", "DSM"]):
                    call_type = "SMS"
                elif any(k in raw_type for k in ["DATA", "GPRS", "INTERNET"]):
                    call_type = "DATA"
                elif "ROAM" in raw_type:
                    call_type = "ROAMING"
                else:
                    call_type = "VOICE"

                # Clean IMEI & IMSI (strip single/double quotes, check validity)
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

                tower = None
                if tower_col and not pd.isna(row.get(tower_col)):
                    raw_tw = str(row.get(tower_col)).strip().strip("'\"")
                    if raw_tw and raw_tw not in ["-", "--", "---", "None", "nan"]:
                        tower = raw_tw[:100]

                lat = None
                lng = None

                # Check combined lat/long (e.g. 28.63969/77.41769)
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
                    resolved = TowerResolver.resolve_tower(tower, operator="Airtel")
                    if resolved:
                        lat, lng, res_az = resolved
                        if azimuth is None:
                            azimuth = res_az

                # Operator detection from row if available
                operator_name = self.OPERATOR_NAME
                if roam_nw_col and not pd.isna(row.get(roam_nw_col)):
                    rn = str(row.get(roam_nw_col)).strip().upper()
                    if "AIR" in rn:
                        operator_name = "Airtel"
                    elif "JIO" in rn or "RJIL" in rn:
                        operator_name = "Jio"
                    elif "VODA" in rn or "IDEA" in rn or "VI" in rn:
                        operator_name = "Vodafone Idea (VI)"

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
                    "operator": operator_name,
                    "raw_source": filename,
                })
            except Exception as e:
                errors.append(f"Row {idx} parse failure: {str(e)}")

        return normalized, errors
