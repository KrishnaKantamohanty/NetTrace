import pytest
import pandas as pd
from app.services.ingestion.airtel_parser import AirtelCDRParser
from app.services.ingestion.jio_parser import JioCDRParser
from app.services.ingestion.vi_parser import VICDRParser
from app.services.ingestion.detector import detect_parser

def test_airtel_parser_normalization():
    df = pd.DataFrame({
        "Calling Number": ["+919811012345", "9811012345"],
        "Called Number": ["09876543210", "9876543210"],
        "Call Date": ["01/10/2026", "01/10/2026"],
        "Call Time": ["01:30:00", "02:15:00"],
        "Duration(Sec)": [120, "00:05:00"],
        "Call Type": ["VOICE", "SMS-MO"],
        "IMEI": ["359281094829104", "359281094829104"],
        "First CGI": ["DEL-CP-TOW-01", "DEL-CP-TOW-01"],
        "Latitude": [28.6315, 28.6315],
        "Longitude": [77.2167, 77.2167]
    })
    parser = AirtelCDRParser()
    records, errors = parser.parse(df, case_id="TEST-001", filename="test_airtel.csv")
    assert len(records) == 2
    assert records[0]["caller_number"] == "9811012345"
    assert records[0]["receiver_number"] == "9876543210"
    assert records[0]["duration_seconds"] == 120
    assert records[1]["duration_seconds"] == 300
    assert records[1]["call_type"] == "SMS"

def test_jio_parser_normalization():
    df = pd.DataFrame({
        "MSISDN": ["9876543210"],
        "DESTINATION_NUMBER": ["9123456780"],
        "CALL_START_DATE_TIME": ["2026-10-02 16:30:00"],
        "DURATION_IN_SEC": [180],
        "CALL_SERVICE_TYPE": ["VoLTE"],
        "IMEI_NUMBER": ["862049182948201"],
        "CELL_ID": ["NOI-SEC62-TOW-08"],
        "LAT": [28.6280],
        "LONG": [77.3649]
    })
    parser = JioCDRParser()
    records, errors = parser.parse(df, case_id="TEST-002", filename="test_jio.csv")
    assert len(records) == 1
    assert records[0]["caller_number"] == "9876543210"
    assert records[0]["receiver_number"] == "9123456780"
    assert records[0]["call_type"] == "VOICE"
    assert records[0]["operator"] == "Jio"

def test_detector_auto_selection():
    df_jio = pd.DataFrame(columns=["msisdn", "dest_msisdn", "call_start_date_time"])
    parser = detect_parser(df_jio)
    assert isinstance(parser, JioCDRParser)

    df_airtel = pd.DataFrame(columns=["a_party", "b_party", "first cgi"])
    parser = detect_parser(df_airtel)
    assert isinstance(parser, AirtelCDRParser)
