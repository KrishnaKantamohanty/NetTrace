import io
from datetime import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.postgres_models import CDRRecord, CaseMetadata
from app.services.analytics.timeline import TimelineAnalyticsService
from app.services.analytics.imei_tracker import IMEITrackerService
from app.services.graph.graph_builder import GraphBuilder
from app.services.graph.centrality import CentralityAnalysisService

class ForensicReportService:
    @staticmethod
    def generate_case_summary(db: Session, case_id: str) -> Dict[str, Any]:
        case = db.query(CaseMetadata).filter(CaseMetadata.case_id == case_id).first()
        timeline = TimelineAnalyticsService.get_frequency_matrix(db, case_id)
        imei_data = IMEITrackerService.detect_swaps(db, case_id)
        
        G = GraphBuilder.build_networkx_graph(db, case_id)
        ranked_nodes = CentralityAnalysisService.rank_nodes(G)

        return {
            "case_id": case_id,
            "case_name": case.case_name if case else "General Cyber Forensics Investigation",
            "investigator": case.investigator_name if case else "Special Cell Investigation Officer",
            "generated_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "total_records": timeline["total_records"],
            "total_duration_minutes": timeline["total_duration_minutes"],
            "late_night_calls_count": timeline["late_night_count"],
            "unique_imeis": imei_data["total_unique_imeis"],
            "multi_sim_devices": imei_data["multi_sim_handsets_count"],
            "multi_imei_subscribers": imei_data["multi_imei_numbers_count"],
            "total_network_nodes": G.number_of_nodes(),
            "total_network_edges": G.number_of_edges(),
            "top_suspects": ranked_nodes[:10],
            "suspicious_imeis": imei_data["multi_sim_handsets"][:5],
        }

    @staticmethod
    def generate_pdf_report(db: Session, case_id: str) -> bytes:
        summary = ForensicReportService.generate_case_summary(db, case_id)
        
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib import colors

            buffer = io.BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
            styles = getSampleStyleSheet()

            title_style = ParagraphStyle(
                'TitleStyle',
                parent=styles['Heading1'],
                fontSize=20,
                leading=24,
                textColor=colors.HexColor('#0f172a'),
                spaceAfter=12
            )
            subtitle_style = ParagraphStyle(
                'SubStyle',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.HexColor('#475569'),
                spaceAfter=20
            )
            section_style = ParagraphStyle(
                'SectionStyle',
                parent=styles['Heading2'],
                fontSize=14,
                leading=18,
                textColor=colors.HexColor('#1e293b'),
                spaceBefore=14,
                spaceAfter=8
            )
            body_style = ParagraphStyle(
                'Body',
                parent=styles['Normal'],
                fontSize=9,
                textColor=colors.HexColor('#334155')
            )

            story = []

            # Header
            story.append(Paragraph("FORENSIC EVIDENCE & CDR INTELLIGENCE REPORT", title_style))
            story.append(Paragraph(f"CONFIDENTIAL & PRIVILEGED - COURT SUBMISSION DRAFT<br/>Case ID: <b>{summary['case_id']}</b> | Case Name: <b>{summary['case_name']}</b><br/>Investigator: <b>{summary['investigator']}</b> | Generated: {summary['generated_at']}", subtitle_style))
            story.append(Spacer(1, 10))

            # Executive Summary Table
            story.append(Paragraph("1. Executive Forensic Summary", section_style))
            summary_data = [
                ["Metric", "Value", "Metric", "Value"],
                ["Total CDR Transactions", str(summary["total_records"]), "Total Talk Time", f"{summary['total_duration_minutes']} mins"],
                ["Late Night Calls (12 AM-4 AM)", str(summary["late_night_calls_count"]), "Unique Network Nodes", str(summary["total_network_nodes"])],
                ["Multi-SIM Handsets (Swaps)", str(summary["multi_sim_devices"]), "Multi-IMEI Subscribers", str(summary["multi_imei_subscribers"])],
            ]
            t_summary = Table(summary_data, colWidths=[160, 100, 160, 100])
            t_summary.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#0f172a')),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('ALIGN', (1, 1), (1, -1), 'CENTER'),
                ('ALIGN', (3, 1), (3, -1), 'CENTER'),
            ]))
            story.append(t_summary)
            story.append(Spacer(1, 15))

            # Top Network Suspects Table
            story.append(Paragraph("2. Top Identified Network Hubs & High-Centrality Targets", section_style))
            suspects_data = [["Phone Number", "Total Calls", "Duration", "Late Night", "Degree Cent.", "Betweenness", "Role"]]
            for s in summary["top_suspects"]:
                role = "HUB" if s["is_hub"] else ("BRIDGE" if s["is_bridge"] else "NODE")
                suspects_data.append([
                    s["id"],
                    str(s["total_calls"]),
                    f"{round(s['total_duration']/60, 1)}m",
                    str(s["late_night_calls"]),
                    str(s["degree_centrality"]),
                    str(s["betweenness_centrality"]),
                    role
                ])

            t_suspects = Table(suspects_data, colWidths=[100, 60, 60, 65, 80, 80, 75])
            t_suspects.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ]))
            story.append(t_suspects)
            story.append(Spacer(1, 15))

            # IMEI Swap Highlights
            story.append(Paragraph("3. Detected Handset & SIM Swap Anomalies", section_style))
            imei_table_data = [["IMEI Number", "SIM Count", "Associated Phone Numbers", "Risk Score"]]
            for dev in summary["suspicious_imeis"]:
                sims_str = ", ".join(dev["associated_sims"][:3])
                if len(dev["associated_sims"]) > 3:
                    sims_str += f" (+{len(dev['associated_sims'])-3} more)"
                imei_table_data.append([
                    dev["imei"],
                    str(dev["sim_count"]),
                    sims_str,
                    f"{dev['suspicious_score'] * 100}%"
                ])

            if len(imei_table_data) > 1:
                t_imei = Table(imei_table_data, colWidths=[120, 60, 260, 80])
                t_imei.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dc2626')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ]))
                story.append(t_imei)
            else:
                story.append(Paragraph("No anomalous multi-SIM IMEI devices detected in current case scope.", body_style))

            story.append(Spacer(1, 20))
            story.append(Paragraph("<i>End of Summary Report. Certified extracted from evidentiary database by NetTrace Cyber Forensics Platform.</i>", body_style))

            doc.build(story)
            buffer.seek(0)
            return buffer.getvalue()

        except Exception as e:
            # Fallback plain text buffer if reportlab fails
            out = f"FORENSIC EVIDENCE & CDR INTELLIGENCE REPORT\nCase ID: {case_id}\nGenerated: {summary['generated_at']}\nTotal Records: {summary['total_records']}\nLate Night Calls: {summary['late_night_calls_count']}\n"
            return out.encode("utf-8")
