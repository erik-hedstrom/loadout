"""Regenerates the binary and generated inputs of the C2 fixtures.

    python3 -B bench/fixtures/c2/make_inputs.py

Written with Python 3.13, python-docx 1.2.0, openpyxl 3.1.5, python-pptx 1.0.2
and reportlab 5.0.1; other versions may change bytes. Output is deterministic
(fixed seeds, fixed zip timestamps, invariant PDF), so a rerun changes no bytes.
Everything in here is invented: names, companies and numbers are fictional.
"""
import csv
import datetime as dt
import json
import random
import re
import shutil
import tempfile
import zipfile
from pathlib import Path

import openpyxl
from docx import Document
from pptx import Presentation
from pptx.util import Inches, Pt
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent
FIXED = dt.datetime(2026, 1, 1, 0, 0, 0)
SEEDS = {"budget": 11, "sales": 7, "experiment": 23, "orders": 8, "access_log": 3}


def out(task: str, name: str) -> Path:
    d = ROOT / task
    d.mkdir(exist_ok=True)
    return d / name


def freeze_zip(path: Path) -> None:
    """Office files are zips whose entries carry the time they were written."""
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d) / "x.zip"
        with zipfile.ZipFile(path) as src, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as dst:
            for info in sorted(src.infolist(), key=lambda i: i.filename):
                clone = zipfile.ZipInfo(info.filename, FIXED.timetuple()[:6])
                clone.compress_type = zipfile.ZIP_DEFLATED
                clone.external_attr = 0o644 << 16
                data = src.read(info.filename)
                if info.filename == "docProps/core.xml":
                    # openpyxl stamps the save time into the file.
                    data = re.sub(rb"(<dcterms:modified[^>]*>)[^<]*", rb"\g<1>2026-01-01T00:00:00Z", data)
                dst.writestr(clone, data)
        shutil.move(str(tmp), path)


def lease() -> None:
    doc = Document()
    doc.core_properties.created = doc.core_properties.modified = FIXED
    doc.core_properties.author = "Harlow Property Group"
    doc.add_heading("Commercial Lease Renewal (Draft v3)", level=1)
    doc.add_paragraph(
        'This Lease Renewal ("Lease") is made on 2 March 2026 between Harlow Property Group LLC '
        '("Landlord") and Fenwick & Reed Design Studio LLC ("Tenant").'
    )
    clauses = [
        ("1. Premises", "Suite 210, 48 Alder Lane, Fairmont (the \"Premises\"), about 1,150 square feet."),
        ("2. Term", "Thirty-six (36) months, commencing 1 April 2026 and ending 31 March 2029."),
        ("3. Base Rent", "Four thousand two hundred dollars ($4,200.00) per month, due on the first day of each month."),
        ("4. Annual Adjustment",
         "On each anniversary of the commencement date, Base Rent shall increase by the greater of "
         "(a) five percent (5%) or (b) the percentage increase in the Consumer Price Index (CPI-U) over the "
         "preceding twelve months. The resulting rent for each year is shown in Exhibit A."),
        ("5. Security Deposit", "Tenant's existing deposit of $8,400.00 (two months' Base Rent) continues to be held by Landlord."),
        ("6. Maintenance and Repairs",
         "Tenant shall maintain and repair the interior of the Premises and shall replace the heating and cooling "
         "equipment serving the Premises when needed. Tenant shall also be responsible for repairs to the roof, "
         "foundation, exterior walls and other structural elements of the Building."),
        ("7. Use", "General office and design studio use. No retail sales to the public."),
        ("8. Insurance", "Tenant shall carry commercial general liability insurance of at least $1,000,000 per occurrence."),
        ("9. Renewal",
         "This Lease shall automatically renew for successive terms of thirty-six (36) months each unless Tenant "
         "delivers written notice of non-renewal to Landlord not less than one hundred eighty (180) days before the "
         "end of the then-current term."),
        ("10. Default", "Failure to pay rent within ten (10) days after written notice is a default."),
        ("11. Guaranty", "Dana Whitfield shall personally guarantee Tenant's obligations under this Lease."),
        ("12. Governing Law", "The laws of the State of Oregon govern this Lease."),
    ]
    for head, body in clauses:
        p = doc.add_paragraph()
        p.add_run(head + ". ").bold = True
        p.add_run(body)
    doc.add_heading("Exhibit A: Rent Schedule", level=2)
    table = doc.add_table(rows=1, cols=3)
    table.style = "Table Grid"
    for cell, text in zip(table.rows[0].cells, ["Lease year", "Monthly rent", "Increase"]):
        cell.text = text
    for year, rent, inc in [("Year 1", "$4,200.00", "-"), ("Year 2", "$4,410.00", "5%"), ("Year 3", "$4,630.50", "5%")]:
        row = table.add_row().cells
        row[0].text, row[1].text, row[2].text = year, rent, inc
    doc.add_paragraph("\nLandlord: ______________________    Tenant: ______________________")
    path = out("docx-lease-amendment", "lease.docx")
    doc.save(path)
    freeze_zip(path)


def budget() -> None:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Export"
    wb.properties.created = wb.properties.modified = FIXED
    ws["A1"] = "Accounting export: FY26 operating expenses (run 2026-07-03)"
    ws.merge_cells("A1:E1")
    ws.append([])
    ws.append(["Dept", "Category", "Month", "Amount", "Memo"])
    rng = random.Random(SEEDS["budget"])
    depts = ["Marketing", "Mktg", "marketing ", "Engineering", "Eng", "Sales", "Operations", "Ops"]
    cats = ["Software", "Travel", "Contractors", "Events", "Hardware", "Training"]
    months = [dt.datetime(2026, m, 1) for m in range(1, 7)]
    rows = []
    for _ in range(54):
        d, c = rng.choice(depts), rng.choice(cats)
        m = rng.choice(months)
        amt = round(rng.uniform(80, 9000), 2)
        month = m if rng.random() < 0.6 else m.strftime("%Y-%m")
        if rng.random() < 0.25:
            shown = f"${amt:,.2f}"
        elif rng.random() < 0.15:
            shown = f"({amt / 4:,.2f})"
        else:
            shown = amt
        rows.append([d, c, month, shown, rng.choice(["", "", "annual plan", "PO pending", "reimbursed"])])
    rows.insert(20, list(rows[19]))
    rows.insert(41, list(rows[40]))
    rows.insert(30, [None] * 5)
    rows.insert(47, [None] * 5)
    for r in rows:
        ws.append(r)
    ws.append(["TOTAL", None, None, 187432.10, "from source system"])
    for row in ws.iter_rows(min_row=4, min_col=3, max_col=3):
        if isinstance(row[0].value, dt.datetime):
            row[0].number_format = "mmm-yy"
    path = out("xlsx-budget-cleanup", "budget.xlsx")
    wb.save(path)
    freeze_zip(path)


def invoices() -> None:
    data = [
        ("INV-1042", "Northgate Paper Supply", "2026-05-02", "Net 30",
         [("A4 copy paper, 5000 sheets", 12, 38.50), ("Toner cartridge TC-55", 3, 112.00), ("Binder clips, box of 100", 10, 2.75)], 0.0, 0.0),
        ("INV-2217", "Kestrel Print & Pack", "2026-05-09", "Net 15",
         [("Shipping cartons 12x9x6", 200, 0.84), ("Packing tape, 6 roll pack", 8, 14.20), ("Custom label run", 1, 245.00)], 0.0, 100.0),
        ("INV-0388", "Brightway Janitorial", "2026-05-14", "Due on receipt",
         [("Monthly office cleaning, May", 1, 640.00), ("Window cleaning (quarterly)", 1, 180.00), ("Supplies surcharge", 1, 35.00)], 0.07, 0.0),
    ]
    path = out("pdf-invoice-extract", "invoices.pdf")
    c = canvas.Canvas(str(path), pagesize=letter, pageCompression=0, invariant=1)
    c.setTitle("Supplier invoices, May 2026")
    for number, supplier, date, terms, items, tax_rate, error in data:
        y = 740
        c.setFont("Helvetica-Bold", 16)
        c.drawString(54, y, supplier)
        c.setFont("Helvetica", 10)
        c.drawString(54, y - 16, "Invoice " + number)
        c.drawString(54, y - 30, "Date: " + date + "    Terms: " + terms)
        c.drawString(54, y - 44, "Bill to: Fenwick & Reed Design Studio LLC, 48 Alder Lane, Fairmont")
        y -= 80
        c.setFont("Helvetica-Bold", 10)
        for x, h in [(54, "Description"), (330, "Qty"), (390, "Unit price"), (480, "Amount")]:
            c.drawString(x, y, h)
        c.setFont("Helvetica", 10)
        subtotal = 0.0
        for desc, qty, price in items:
            y -= 18
            line = round(qty * price, 2)
            subtotal += line
            c.drawString(54, y, desc)
            c.drawRightString(350, y, str(qty))
            c.drawRightString(445, y, f"{price:,.2f}")
            c.drawRightString(540, y, f"{line:,.2f}")
        tax = round(subtotal * tax_rate, 2)
        y -= 30
        c.drawString(390, y, "Subtotal")
        c.drawRightString(540, y, f"{subtotal:,.2f}")
        if tax_rate:
            y -= 16
            c.drawString(390, y, f"Tax ({tax_rate:.0%})")
            c.drawRightString(540, y, f"{tax:,.2f}")
        y -= 16
        c.setFont("Helvetica-Bold", 10)
        c.drawString(390, y, "Total due")
        c.drawRightString(540, y, f"{subtotal + tax + error:,.2f}")
        c.showPage()
    c.save()


def deck() -> None:
    prs = Presentation()
    prs.core_properties.created = prs.core_properties.modified = FIXED
    # The template's lastModifiedBy is a real person's name.
    prs.core_properties.author = prs.core_properties.last_modified_by = "Operations"
    title = prs.slides.add_slide(prs.slide_layouts[0])
    title.shapes.title.text = "Operations Update, Q3 2026"
    title.placeholders[1].text = "Team all-hands, 8 October"
    bullets = {
        "Where we landed": [
            "Revenue closed the quarter at $4.82M against a plan of $4.60M, up 9% on Q2 ($4.42M)",
            "Gross margin held at 61%, down one point from Q2 because of the carrier rate increase in August",
            "Headcount is 58, three under plan; the two open support roles are the hardest to fill",
            "We signed 14 new accounts and lost 5, so net new accounts were 9; 3 of the 5 losses were price-driven",
            "Cash on hand is $2.1M, which covers about 7 months of current spend",
        ],
        "Support": [
            "Median first response time fell from 4h 10m to 2h 35m after the August triage change",
            "Tickets opened: 3,940 (Q2: 3,610); tickets closed within SLA: 92% (Q2: 88%)",
            "CSAT is 4.4 out of 5 on 1,120 responses, with refunds and shipping delays the main complaints",
            "The weekend rota is covered by two contractors until the open roles are filled",
        ],
        "Fulfilment": [
            "On-time delivery was 94.5% (target 95%), with the only misses in the two weeks of the carrier switch",
            "Average pick-and-pack time dropped from 41 to 33 minutes after the warehouse layout change",
            "Damage rate is 0.8% of orders, flat on Q2, and we still want it under 0.5%",
            "The second carrier contract gives us a backup for peak season at a 4% higher per-parcel rate",
        ],
        "Risks and asks": [
            "Peak season starts 15 November and the forecast is 30% over last year's volume",
            "We need approval for 4 temporary warehouse staff (about $38k for the season)",
            "The ERP renewal is due in December with a 12% price increase quoted; we are getting two alternatives",
            "Two key people hold the carrier relationships; we want a written handover plan by year end",
        ],
        "Next quarter": [
            "Hire the two support roles and one warehouse lead",
            "Bring the damage rate under 0.5% with a packaging supplier change (trial in October)",
            "Decide on the ERP renewal by 15 November",
            "Report on-time delivery weekly through peak season, with a rollback plan if it falls below 92%",
        ],
    }
    for head, items in bullets.items():
        s = prs.slides.add_slide(prs.slide_layouts[1])
        s.shapes.title.text = head
        body = s.placeholders[1].text_frame
        body.text = items[0]
        for t in items[1:]:
            body.add_paragraph().text = t
        for p in body.paragraphs:
            p.font.size = Pt(16)
    s = prs.slides.add_slide(prs.slide_layouts[5])
    s.shapes.title.text = "Quarter in numbers"
    rows = [("Metric", "Q2", "Q3"), ("Revenue", "$4.42M", "$4.82M"), ("Gross margin", "62%", "61%"),
            ("Net new accounts", "7", "9"), ("Median first response", "4h 10m", "2h 35m"),
            ("On-time delivery", "95.1%", "94.5%"), ("CSAT (of 5)", "4.3", "4.4")]
    table = s.shapes.add_table(len(rows), 3, Inches(0.8), Inches(1.8), Inches(8.4), Inches(3.5)).table
    for r, row in enumerate(rows):
        for ci, text in enumerate(row):
            table.cell(r, ci).text = text
    path = out("pptx-board-deck", "update.pptx")
    prs.save(path)
    freeze_zip(path)


def sales() -> None:
    rng = random.Random(SEEDS["sales"])
    regions = ["North", "South", "East", "West"]
    skus = {"SKU-100": 14.5, "SKU-205": 32.0, "SKU-310": 8.75, "SKU-415": 120.0, "SKU-520": 54.9, "SKU-630": 19.99}
    rows = []
    for i in range(1, 331):
        day = dt.date(2026, 7, 1) + dt.timedelta(days=rng.randrange(92))
        sku = rng.choice(list(skus))
        date = day.isoformat() if rng.random() < 0.8 else day.strftime("%m/%d/%Y")
        region = rng.choice(regions)
        if rng.random() < 0.08:
            region = rng.choice([region.lower(), " " + region, ""])
        price = skus[sku]
        shown = f"{price:.2f}" if rng.random() < 0.85 else f"${price:.2f}"
        qty = rng.randint(1, 12)
        status = rng.choice(["shipped"] * 8 + ["pending", "cancelled"])
        rows.append([f"ORD-{1000 + i}", date, region, sku, qty, shown, rng.choice([0, 0, 0, 5, 10, 15]), status])
    for i in (40, 41, 42):
        rows[i][4] = -rng.randint(1, 3)
        rows[i][7] = "refunded"
    rows[120][4] = -2
    rows[210][4] = 0
    rows[88][5] = "1450.00"
    rows[199][5] = "0.00"
    rows[250][6] = 95
    for i in (30, 77, 150, 151, 222, 300):
        rows.append(list(rows[i]))
    rng.shuffle(rows)
    path = out("data-sales-clean", "sales.csv")
    with path.open("w", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(["order_id", "order_date", "region", "sku", "qty", "unit_price", "discount_pct", "status"])
        w.writerows(rows)


def experiment() -> None:
    rng = random.Random(SEEDS["experiment"])
    base = {"desktop": 0.060, "mobile": 0.025}
    effect = {"A": 1.0, "B": 0.965}
    mix = {"A": {"desktop": 0.40, "mobile": 0.60}, "B": {"desktop": 0.62, "mobile": 0.38}}
    path = out("data-ab-test", "experiment.csv")
    with path.open("w", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(["day", "variant", "device", "visitors", "conversions"])
        for d in range(14):
            day = (dt.date(2026, 9, 1) + dt.timedelta(days=d)).isoformat()
            total = rng.randint(3800, 4400)
            b_share = 0.5 if d < 7 else 0.36
            for variant in ("A", "B"):
                n = int(total * (b_share if variant == "B" else 1 - b_share))
                for device in ("desktop", "mobile"):
                    v = int(n * mix[variant][device])
                    p = base[device] * effect[variant]
                    conv = sum(rng.random() < p for _ in range(v))
                    w.writerow([day, variant, device, v, conv])


def orders() -> None:
    rng = random.Random(SEEDS["orders"])
    first = ["Ada", "Ben", "Chen", "Dara", "Eli", "Fay", "Gus", "Hana", "Ivo", "Jun", "Kai", "Lena", "Milo", "Nora", "Omar", "Pia", "Quinn", "Rosa", "Sam", "Tess"]
    last = ["Alder", "Brook", "Cole", "Dunn", "Ellis", "Frost", "Grant", "Hale", "Ito", "Joyce", "Kerr", "Lowe"]
    catalog = [("MUG-01", "Stoneware mug", 1800), ("TEE-02", "Logo tee", 2400), ("TOTE-03", "Canvas tote", 1500),
               ("NOTE-04", "Notebook set", 1200), ("CAP-05", "Wool cap", 2900), ("BTL-06", "Steel bottle", 3200)]
    customers = []
    for i in range(1, 41):
        name = f"{rng.choice(first)} {rng.choice(last)}"
        email = f"{name.lower().replace(' ', '.')}{i}@example.com"
        cust = {"id": f"C{i:03d}", "name": name, "email": email, "orders": []}
        for k in range(rng.choice([1, 1, 2, 2, 3, 4, 6])):
            when = dt.date(2025, 1, 1) + dt.timedelta(days=rng.randrange(540))
            items = [{"sku": s, "name": n, "qty": rng.randint(1, 3), "unit_price_cents": p}
                     for s, n, p in rng.sample(catalog, rng.randint(1, 3))]
            order = {"id": f"O{i:03d}-{k + 1}", "placed_at": when.isoformat(), "status": "paid", "items": items}
            if rng.random() < 0.12:
                order["status"] = "refunded"
                order["refund"] = {"amount_cents": items[0]["qty"] * items[0]["unit_price_cents"],
                                   "refunded_at": (when + dt.timedelta(days=rng.randint(2, 20))).isoformat(),
                                   "reason": rng.choice(["damaged", "wrong size", "late"])}
            cust["orders"].append(order)
        customers.append(cust)
    for src, dst in ((3, 38), (11, 39)):
        local, domain = customers[src]["email"].split("@")
        customers[dst]["name"] = customers[src]["name"]
        customers[dst]["email"] = local.upper() + "@" + domain
    doc = {"exported_at": "2026-07-01T06:00:00Z", "currency": "USD", "customers": customers}
    out("data-orders-sqlite", "orders.json").write_text(json.dumps(doc, separators=(",", ":")) + "\n")


def access_log() -> None:
    rng = random.Random(SEEDS["access_log"])
    paths = ["/", "/api/items", "/api/items/17", "/login", "/static/app.js", "/healthz", "/api/orders", "/admin"]
    ips = [f"203.0.113.{n}" for n in (4, 9, 17, 23, 58, 120)] + ["198.51.100.7", "198.51.100.88"]
    start = dt.datetime(2026, 3, 8, 22, 0, 0)
    lines = []
    for i in range(70):
        when = start + dt.timedelta(minutes=47 * i + rng.randrange(40))
        status = rng.choice([200] * 12 + [301, 304, 304, 404, 404, 401, 500, 502, 503])
        size = "-" if status in (301, 304) else str(rng.randrange(120, 9000))
        path = rng.choice(paths)
        if path == "/api/items":
            path += rng.choice(["", "?page=2", "?q=boots"])
        stamp = when.strftime("%d/%b/%Y:%H:%M:%S +0000")
        lines.append(f'{rng.choice(ips)} - - [{stamp}] "GET {path} HTTP/1.1" {status} {size} "-" "Mozilla/5.0"')
    lines.insert(25, "-- logrotate: rotated at 2026-03-09 06:25 --")
    out("code-logsum-flags", "access.log").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    for fn in (lease, budget, invoices, deck, sales, experiment, orders, access_log):
        fn()
