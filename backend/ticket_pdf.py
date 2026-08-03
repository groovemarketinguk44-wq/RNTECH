import io
from reportlab.lib.pagesizes import A5
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from reportlab.pdfgen import canvas


def _draw_qr(c, data, x, y, size):
    widget = QrCodeWidget(data)
    b = widget.getBounds()
    w, h = b[2] - b[0], b[3] - b[1]
    d = Drawing(size, size, transform=[size / w, 0, 0, size / h, 0, 0])
    d.add(widget)
    renderPDF.draw(d, c, x, y)


def generate_tickets_pdf(tickets, event, ticket_type_names: dict) -> bytes:
    """One page per ticket. `ticket_type_names` maps ticket_type_id -> name."""
    buf = io.BytesIO()
    page_w, page_h = A5
    c = canvas.Canvas(buf, pagesize=A5)

    for t in tickets:
        c.setFillColor(HexColor("#040c18"))
        c.rect(0, 0, page_w, page_h, fill=1, stroke=0)

        c.setFillColor(HexColor("#3272a8"))
        c.setFont("Helvetica-Bold", 10)
        c.drawString(20 * mm, page_h - 18 * mm, "RNTECH")

        c.setFillColor(HexColor("#ffffff"))
        c.setFont("Helvetica-Bold", 16)
        title = event.title if event else "Event"
        c.drawString(20 * mm, page_h - 30 * mm, title[:40])

        c.setFont("Helvetica", 10)
        c.setFillColor(HexColor("#cccccc"))
        subtitle = ", ".join(filter(None, [event.display_date if event else "", event.venue if event else ""]))
        c.drawString(20 * mm, page_h - 37 * mm, subtitle[:60])

        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(HexColor("#3272a8"))
        c.drawString(20 * mm, page_h - 50 * mm, ticket_type_names.get(t.ticket_type_id, "Ticket"))

        c.setFont("Helvetica", 10)
        c.setFillColor(HexColor("#ffffff"))
        c.drawString(20 * mm, page_h - 58 * mm, f"Holder: {t.holder_name}")
        c.drawString(20 * mm, page_h - 64 * mm, f"Ref: {t.id}")

        qr_size = 55 * mm
        _draw_qr(c, t.qr_code, page_w - qr_size - 20 * mm, page_h - 64 * mm - qr_size + 10 * mm, qr_size)

        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(HexColor("#3272a8"))
        c.drawCentredString(page_w - qr_size / 2 - 20 * mm, page_h - 64 * mm - qr_size + 4 * mm, t.qr_code)

        c.setFont("Helvetica", 8)
        c.setFillColor(HexColor("#888888"))
        c.drawString(20 * mm, 12 * mm, "Present this QR code at the door. One scan per ticket.")

        c.showPage()

    c.save()
    return buf.getvalue()
