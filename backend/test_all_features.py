import urllib.request
import urllib.parse
import json
import sys

BASE = 'http://127.0.0.1:8001/api/v1'
CASE_ID = 'CASE-DL-2026-904'
SUSPECT = '9811012345'

tests = [
    ('Cases List', f'{BASE}/cases', 'GET'),
    ('Case Analytics Summary', f'{BASE}/analytics/summary/{CASE_ID}', 'GET'),
    ('Hourly Distribution', f'{BASE}/analytics/hourly/{CASE_ID}', 'GET'),
    ('Top Suspects', f'{BASE}/analytics/suspects/{CASE_ID}', 'GET'),
    ('IMEI Swaps', f'{BASE}/analytics/imei-swaps/{CASE_ID}', 'GET'),
    ('GIS Cell Towers', f'{BASE}/gis/towers/{CASE_ID}', 'GET'),
    ('Suspect Movement Trajectory', f'{BASE}/gis/movement/{CASE_ID}/{SUSPECT}', 'GET'),
    ('Multi-Tower Dump Analysis', f'{BASE}/gis/multitower-dump?towers=DEL-CP-TOW-01,DEL-KB-TOW-04', 'GET'),
    ('Co-Traveler Correlation', f'{BASE}/gis/co-travelers/{CASE_ID}', 'GET'),
    ('Network Graph (Cytoscape/Vis)', f'{BASE}/network/graph/{CASE_ID}', 'GET'),
    ('Network Communities', f'{BASE}/network/communities/{CASE_ID}', 'GET'),
    ('Network Centrality', f'{BASE}/network/centrality/{CASE_ID}', 'GET'),
    ('Relay Chains (Domino Calling)', f'{BASE}/forensics/relay-chains/{CASE_ID}?gap_minutes=30', 'GET'),
    ('IPDR & Telemetry Analytics', f'{BASE}/forensics/ipdr/{CASE_ID}', 'GET'),
    ('Speech Intercepts & Transcripts', f'{BASE}/forensics/speech/{CASE_ID}', 'GET'),
    ('Multi-Script OCR Scans', f'{BASE}/forensics/ocr/{CASE_ID}', 'GET'),
    ('OSINT Profile & Risk Score', f'{BASE}/forensics/osint/profile/{SUSPECT}', 'GET'),
    ('OSINT Cross-Case Correlation', f'{BASE}/forensics/osint/cross-case/{CASE_ID}/{SUSPECT}', 'GET'),
    ('Geofence Rules', f'{BASE}/forensics/geofence/rules/{CASE_ID}', 'GET'),
    ('Geofence Breaches', f'{BASE}/forensics/geofence/breaches/{CASE_ID}', 'GET'),
    ('Chain of Custody Audit Log', f'{BASE}/forensics/custody-log/{CASE_ID}', 'GET'),
]

print("=== NETTRACE AUTOMATED BACKEND VERIFICATION ===")
passed = 0
failed = 0

for name, url, method in tests:
    try:
        req = urllib.request.Request(url, method=method)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            status = 'PASS'
            cnt = len(data) if isinstance(data, (list, dict)) else 1
            print(f"  [OK] {name:<35} -> {resp.status} (Count/Keys: {cnt})")
            passed += 1
    except Exception as e:
        print(f"  [FAIL] {name:<35} -> {e}")
        failed += 1

print("="*50)
print(f"Results: {passed} passed, {failed} failed.")
if failed > 0:
    sys.exit(1)
