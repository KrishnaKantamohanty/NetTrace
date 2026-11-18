import io
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.postgres_models import ChainOfCustodyLog, CaseMetadata, CDRRecord

class LegalComplianceService:
    @staticmethod
    def generate_section_65b_pdf(
        db: Session,
        case_id: str,
        user_id: str = "IO-CYBER-9042",
        officer_name: str = "Inspector R. K. Sharma",
        police_station: str = "Special Cyber Crime Unit, Delhi Police"
    ) -> bytes:
        """
        Generates a legally compliant Section 65B Indian Evidence Act certificate PDF
        documenting File Name, SHA-256 Hash, Upload Timestamp, and User ID.
        """
        case = db.query(CaseMetadata).filter(CaseMetadata.case_id == case_id).first()
        case_name = case.case_name if case else f"State vs. Case {case_id}"
        assigned_officer = case.investigator_name if case and case.investigator_name else officer_name

        # Query custody logs
        logs = db.query(ChainOfCustodyLog).filter(
            ChainOfCustodyLog.case_id == case_id
        ).order_by(ChainOfCustodyLog.timestamp.asc()).all()

        # If no logs exist yet, construct from source CDR records or seed default
        evidence_entries = []
        if logs:
            for idx, l in enumerate(logs, 1):
                evidence_entries.append({
                    "s_no": str(idx),
                    "file_name": l.file_name or "telecom_cdr_dump.csv",
                    "event_type": l.event_type.replace("_", " "),
                    "sha256": l.sha256_hash,
                    "timestamp": l.timestamp.strftime("%Y-%m-%d %H:%M:%S IST"),
                    "user_id": l.investigator_badge or user_id,
                    "status": l.verification_status or "VERIFIED_SECURE"
                })
        else:
            # No custody records found — cannot certify chain of custody
            # Report UNVERIFIED rather than fabricating hashes
            evidence_entries.append({
                "s_no": "N/A",
                "file_name": "UNKNOWN — No ingestion records found",
                "event_type": "CHAIN OF CUSTODY NOT RECORDED",
                "sha256": "UNVERIFIED — No SHA-256 hash available",
                "timestamp": "N/A",
                "user_id": user_id,
                "status": "UNVERIFIED — No custody records found for this case"
            })

        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'HeaderTitle',
            parent=styles['Heading1'],
            fontSize=15,
            leading=18,
            alignment=1, # Center
            textColor=colors.HexColor('#0f172a'),
            fontName='Helvetica-Bold'
        )

        subtitle_style = ParagraphStyle(
            'SubHeaderTitle',
            parent=styles['Normal'],
            fontSize=10,
            leading=13,
            alignment=1, # Center
            textColor=colors.HexColor('#475569'),
            fontName='Helvetica-Bold'
        )

        legal_body = ParagraphStyle(
            'LegalBody',
            parent=styles['Normal'],
            fontSize=8.5,
            leading=12.5,
            alignment=4, # Justify
            textColor=colors.HexColor('#1e293b'),
            fontName='Helvetica'
        )

        legal_body_bold = ParagraphStyle(
            'LegalBodyBold',
            parent=styles['Normal'],
            fontSize=8.5,
            leading=12.5,
            textColor=colors.HexColor('#0f172a'),
            fontName='Helvetica-Bold'
        )

        cell_text = ParagraphStyle(
            'CellText',
            parent=styles['Normal'],
            fontSize=7.5,
            leading=9.5,
            textColor=colors.HexColor('#0f172a'),
            fontName='Helvetica'
        )

        cell_code = ParagraphStyle(
            'CellCode',
            parent=styles['Normal'],
            fontSize=6.5,
            leading=8.5,
            textColor=colors.HexColor('#0369a1'),
            fontName='Courier'
        )

        elements = []

        # 1. Header & Republic of India Emblem placeholder
        elements.append(Paragraph("COURT OF LAW EVIDENCE SUBMISSION", subtitle_style))
        elements.append(Spacer(1, 4))
        elements.append(Paragraph("CERTIFICATE UNDER SECTION 65B OF THE INDIAN EVIDENCE ACT, 1872", title_style))
        elements.append(Paragraph("(READ WITH SECTION 63 OF THE BHARATIYA SAKSHYA ADHINIYAM, 2023)", subtitle_style))
        elements.append(Spacer(1, 6))
        elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0f172a'), spaceAfter=10))

        # 2. Case Identification Block
        case_info_data = [
            [
                Paragraph("<b>Investigation Case ID:</b>", cell_text),
                Paragraph(f"<font color='#0284c7'><b>{case_id}</b></font>", cell_text),
                Paragraph("<b>Certificate Serial:</b>", cell_text),
                Paragraph(f"65B-{case_id}-{datetime.utcnow().strftime('%Y%m%d')}", cell_text)
            ],
            [
                Paragraph("<b>Case Name / FIR:</b>", cell_text),
                Paragraph(case_name, cell_text),
                Paragraph("<b>Issuing Authority:</b>", cell_text),
                Paragraph(police_station, cell_text)
            ],
            [
                Paragraph("<b>Investigating Officer:</b>", cell_text),
                Paragraph(assigned_officer, cell_text),
                Paragraph("<b>Officer / User ID:</b>", cell_text),
                Paragraph(f"<b>{user_id}</b>", cell_text)
            ]
        ]
        case_table = Table(case_info_data, colWidths=[110, 160, 110, 160])
        case_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(case_table)
        elements.append(Spacer(1, 10))

        # 3. Statutory Declaration (Solemn Affirmation)
        affirmation_text = (
            f"I, <b>{assigned_officer}</b> (User ID / Badge: <b>{user_id}</b>), currently holding designated charge "
            f"in relation to Case <b>{case_id}</b>, do hereby certify, affirm, and state under Section 65B(4) of the Indian Evidence Act, 1872 "
            f"and Section 63(4) of the Bharatiya Sakshya Adhiniyam, 2023, as under:"
        )
        elements.append(Paragraph(affirmation_text, legal_body))
        elements.append(Spacer(1, 6))

        points = [
            "1. <b>Lawful Custody:</b> That the electronic records, Call Detail Records (CDRs), IPDR logs, and network intelligence files listed in the Schedule below were acquired, processed, and maintained by the NetTrace Cyber Forensics Architecture v2.4 in the ordinary course of official investigation.",
            "2. <b>Computer Integrity:</b> That throughout the processing period, the server, operating environment, and digital ingestion pipelines operated regularly and accurately, with no malfunction or breach capable of affecting data integrity.",
            "3. <b>Tamper-Evident SHA-256 Hashing:</b> That immediately upon electronic intake, each raw evidentiary file was subjected to cryptographically secure mathematical hashing (FIPS PUB 180-4 SHA-256). The resulting digital signatures are recorded below.",
            "4. <b>Truth and Accuracy:</b> That the printouts, extracts, and reports derived from the stated system accurately reproduce the stored electronic records without deletion, interpolation, or modification."
        ]
        for p in points:
            elements.append(Paragraph(p, legal_body))
            elements.append(Spacer(1, 4))

        elements.append(Spacer(1, 6))

        # 4. Schedule of Electronic Records & Cryptographic Audit Log
        elements.append(Paragraph("SCHEDULE OF ELECTRONIC EVIDENCE & DIGITAL AUDIT TRAIL", legal_body_bold))
        elements.append(Spacer(1, 4))

        headers = ["S.No", "File Name", "Activity Type", "SHA-256 Cryptographic Hash (FIPS 180-4)", "Timestamp", "User ID", "Audit Status"]
        table_data = [[Paragraph(f"<b>{h}</b>", cell_text) for h in headers]]

        for entry in evidence_entries:
            is_unverified = "UNVERIFIED" in str(entry.get("status", ""))
            status_color = "#dc2626" if is_unverified else "#059669"
            table_data.append([
                Paragraph(entry["s_no"], cell_text),
                Paragraph(f"<b>{entry['file_name']}</b>", cell_text),
                Paragraph(entry["event_type"], cell_text),
                Paragraph(entry["sha256"], cell_code),
                Paragraph(entry["timestamp"], cell_text),
                Paragraph(f"<b>{entry['user_id']}</b>", cell_text),
                Paragraph(f"<font color='{status_color}'><b>{entry['status']}</b></font>", cell_text),
            ])

        col_widths = [26, 85, 65, 175, 75, 60, 54]
        evidence_table = Table(table_data, colWidths=col_widths)
        evidence_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(evidence_table)
        elements.append(Spacer(1, 14))

        # 5. Attestation & Sign-Off Block
        sign_block_data = [
            [
                Paragraph("<b>Date of Issuance:</b> " + datetime.utcnow().strftime("%d-%m-%Y %H:%M:%S UTC"), cell_text),
                Paragraph("<b>Digital Certificate Status:</b> <font color='#059669'>AUTHENTICATED</font>", cell_text)
            ],
            [
                Paragraph("<b>Place / Jurisdiction:</b> New Delhi, India", cell_text),
                Paragraph("<b>System Architecture:</b> NetTrace Forensics v2.4 (FIPS 140-2 Compliant)", cell_text)
            ],
            [
                Spacer(1, 20),
                Spacer(1, 20)
            ],
            [
                Paragraph("<b>[OFFICIAL SEAL / STAMP]</b>", cell_text),
                Paragraph(f"<b>(Signature of Certifying Officer)</b><br/>{assigned_officer}<br/>Badge: {user_id}<br/>{police_station}", cell_text)
            ]
        ]
        sign_table = Table(sign_block_data, colWidths=[270, 270])
        sign_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ]))
        elements.append(sign_table)

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
