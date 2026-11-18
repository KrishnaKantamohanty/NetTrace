import re
import io
import pandas as pd
from datetime import datetime
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Tuple, Optional
import logging

logger = logging.getLogger("nettrace.parser")

class BaseCDRParser(ABC):
    OPERATOR_NAME = "GENERIC"

    @classmethod
    def clean_phone_number(cls, raw: Any) -> Optional[str]:
        if pd.isna(raw) or raw is None:
            return None
        s = str(raw).strip().strip("'\"")
        if not s or s.lower() in ["-", "--", "---", "none", "nan", "null"]:
            return None
        # Remove scientific notation if read as float
        if ("e" in s.lower() or "." in s) and re.match(r"^[\d.eE+-]+$", s):
            try:
                s = str(int(float(s)))
            except Exception:
                pass

        # Check if it has alphabet characters (e.g. DLT SMS headers: VM-CANBNK, AD-iPaytm, AIRMCA)
        if re.search(r"[a-zA-Z]", s):
            clean_hdr = re.sub(r"[^\w\-]", "", s).strip("-_")
            return clean_hdr[:25] if clean_hdr else None

        # Pure numeric or shortcode
        digits = re.sub(r"\D", "", s)
        if not digits:
            return None

        # Normalize Indian 10-digit mobile numbers
        if len(digits) == 12 and digits.startswith("91"):
            digits = digits[2:]
        elif len(digits) == 11 and digits.startswith("0"):
            digits = digits[1:]

        if len(digits) >= 3 and len(digits) <= 20:
            return digits
        return digits[:20] if digits else None

    @classmethod
    def parse_datetime(cls, raw_dt: Any, raw_time: Any = None) -> Optional[datetime]:
        if pd.isna(raw_dt) or raw_dt is None:
            return None

        if isinstance(raw_dt, datetime):
            return raw_dt
        if isinstance(raw_dt, pd.Timestamp):
            return raw_dt.to_pydatetime()

        s_dt = str(raw_dt).strip().strip("'\"")
        if raw_time and not pd.isna(raw_time):
            s_time = str(raw_time).strip().strip("'\"")
            s_dt = f"{s_dt} {s_time}"

        # Clean multiple spaces and any residual quotes
        s_dt = re.sub(r"['\"]", "", s_dt)
        s_dt = re.sub(r"\s+", " ", s_dt).strip()

        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
            "%d-%m-%Y %H:%M:%S",
            "%d/%m/%y %H:%M:%S",
            "%d-%m-%y %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%d-%b-%Y %H:%M:%S",
            "%d-%b-%y %H:%M:%S",
            "%d/%m/%Y %I:%M:%S %p",
            "%Y-%m-%d %I:%M:%S %p",
            "%Y-%m-%d",
            "%d/%m/%Y",
            "%d-%m-%Y",
            "%d/%m/%y",
            "%Y/%m/%d",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(s_dt, fmt)
            except ValueError:
                continue

        try:
            return pd.to_datetime(s_dt).to_pydatetime()
        except Exception:
            return None

    @classmethod
    def clean_duration(cls, raw: Any) -> int:
        if pd.isna(raw) or raw is None:
            return 0
        s = str(raw).strip()
        # Handle HH:MM:SS format
        if ":" in s:
            parts = s.split(":")
            try:
                if len(parts) == 3:
                    return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                elif len(parts) == 2:
                    return int(parts[0]) * 60 + int(parts[1])
            except Exception:
                pass
        # Numeric extraction
        digits = re.sub(r"[^\d.]", "", s)
        try:
            return int(float(digits))
        except Exception:
            return 0

    @classmethod
    def load_dataframe(cls, file_bytes: bytes, filename: str) -> pd.DataFrame:
        if not file_bytes:
            raise ValueError(f"Uploaded file '{filename}' is empty (0 bytes).")

        from app.core.config import settings
        if len(file_bytes) > settings.MAX_UPLOAD_SIZE_BYTES:
            max_mb = settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
            raise ValueError(f"File '{filename}' exceeds maximum allowed size of {max_mb} MB.")

        fn = filename.lower().strip()
        if not any(fn.endswith(ext) for ext in settings.ALLOWED_EXTENSIONS):
            raise ValueError(
                f"Unsupported file format for '{filename}'. Supported extensions are: {', '.join(settings.ALLOWED_EXTENSIONS)}"
            )

        try:
            if fn.endswith(".xlsx") or fn.endswith(".xls"):
                df = pd.read_excel(io.BytesIO(file_bytes), engine="openpyxl")
            elif fn.endswith(".csv"):
                try:
                    df = pd.read_csv(io.BytesIO(file_bytes), encoding="utf-8")
                except UnicodeDecodeError:
                    df = pd.read_csv(io.BytesIO(file_bytes), encoding="latin-1")
            elif fn.endswith(".txt"):
                sample = file_bytes[:4096].decode("latin-1", errors="ignore")
                sep = ","
                if "\t" in sample:
                    sep = "\t"
                elif "|" in sample:
                    sep = "|"
                elif ";" in sample:
                    sep = ";"
                df = pd.read_csv(io.BytesIO(file_bytes), sep=sep, encoding="latin-1")
            else:
                raise ValueError(f"Unsupported file extension for {filename}")

            if df is None or df.empty or len(df.columns) == 0:
                raise ValueError(f"Uploaded file '{filename}' contains no readable data rows or columns.")

            return df
        except Exception as e:
            if isinstance(e, ValueError):
                raise e
            raise ValueError(f"Malformed or corrupt file structure in '{filename}': {str(e)}")

    @abstractmethod
    def parse(self, df: pd.DataFrame, case_id: str, filename: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        """Returns (normalized_records, errors)"""
        pass
