"""
/reports/pdf and /reports/csv - export prediction history as real files.
"""
import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import Prediction

router = APIRouter(prefix="/reports", tags=["reports"])


def _get_rows(db: Session, current_user):
    q = db.query(Prediction).order_by(Prediction.created_at.desc())
    role_val = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_val != "admin":
        q = q.filter(Prediction.user_id == current_user.id)
    return q.all()


@router.get("/csv")
def export_csv(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    rows = _get_rows(db, current_user)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["ID", "Type", "Confidence", "Risk Level", "Risk Score", "Created At"])
    for r in rows:
        level_val = r.risk_level.value if hasattr(r.risk_level, "value") else str(r.risk_level)
        writer.writerow([r.id, r.prediction_type, r.confidence, level_val, r.risk_score, r.created_at])
    buffer.seek(0)

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=predictions_report.csv"},
    )


@router.get("/pdf")
def export_pdf(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    rows = _get_rows(db, current_user)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = [
        Paragraph("Disaster Prediction Report", styles["Title"]),
        Spacer(1, 12),
        Paragraph(f"Generated for: {current_user.name} ({current_user.email})", styles["Normal"]),
        Spacer(1, 20),
    ]

    table_data = [["ID", "Type", "Confidence %", "Risk Level", "Risk Score", "Created At"]]
    for r in rows:
        level_val = r.risk_level.value if hasattr(r.risk_level, "value") else str(r.risk_level)
        table_data.append([
            str(r.id), r.prediction_type, f"{r.confidence:.1f}",
            level_val, f"{r.risk_score:.1f}" if r.risk_score else "-",
            r.created_at.strftime("%Y-%m-%d %H:%M"),
        ])

    table = Table(table_data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
    ]))
    elements.append(table)
    doc.build(elements)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=predictions_report.pdf"},
    )
