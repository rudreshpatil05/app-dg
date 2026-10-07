import datetime
import io
import csv
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from openpyxl import Workbook
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.database import get_db
from app.models.auth import User
from app.models.sale import Sale, SaleItem, SalePayment
from app.models.product import Product, SerialNumber, Category
from app.models.party import Customer
from app.models.finance import Expense
from app.services.accounting_service import calculate_comprehensive_profit_loss
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"], dependencies=[Depends(require_role(["OWNER", "MANAGER", "ACCOUNTANT"]))])

@router.get("/sales-summary")
def get_sales_report(
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
    category_id: Optional[int] = None,
    brand: Optional[str] = None,
    product_search: Optional[str] = None,
    customer_search: Optional[str] = None,
    payment_method: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    biz_id = current_user.business_id
    today = datetime.date.today()
    s_date = start_date or (today - datetime.timedelta(days=30))
    e_date = end_date or today

    sales_query = db.query(Sale).filter(
        Sale.business_id == biz_id,
        Sale.status == "COMPLETED",
        Sale.invoice_date >= s_date,
        Sale.invoice_date <= e_date
    )

    if category_id or brand or product_search:
        sales_query = sales_query.join(SaleItem, SaleItem.sale_id == Sale.id).join(Product, Product.id == SaleItem.product_id)
        if category_id:
            sales_query = sales_query.filter(Product.category_id == category_id)
        if brand:
            sales_query = sales_query.filter(Product.brand == brand)
        if product_search:
            product_term = f"%{product_search}%"
            sales_query = sales_query.filter(
                or_(Product.name.ilike(product_term), Product.model.ilike(product_term), Product.sku.ilike(product_term))
            )
        sales_query = sales_query.distinct()
    if customer_search:
        customer_term = f"%{customer_search}%"
        sales_query = sales_query.filter(or_(Sale.customer_name.ilike(customer_term), Sale.customer_phone.ilike(customer_term)))
    if payment_method:
        if payment_method.upper() == "EMI":
            sales_query = sales_query.filter(Sale.payment_type == "EMI")
        else:
            sales_query = sales_query.join(SalePayment, SalePayment.sale_id == Sale.id).filter(SalePayment.payment_method == payment_method.upper()).distinct()

    sales = sales_query.order_by(Sale.invoice_date.desc(), Sale.id.desc()).all()

    total_revenue = sum(s.grand_total for s in sales)
    total_tax = sum(s.total_tax for s in sales)
    total_discount = sum(s.discount_amount for s in sales)
    total_invoices = len(sales)

    payment_breakdown = {}
    for sale in sales:
        if sale.payment_type == "EMI":
            payment_breakdown["EMI"] = payment_breakdown.get("EMI", 0.0) + sale.final_payable
        else:
            for payment in sale.payments:
                payment_breakdown[payment.payment_method] = payment_breakdown.get(payment.payment_method, 0.0) + payment.amount

    category_breakdown = {}
    product_breakdown = {}
    brand_breakdown = {}
    total_items = 0
    for sale in sales:
        for item in sale.items:
            total_items += item.quantity
            category_name = item.product.category.name if item.product and item.product.category else "Other"
            category = category_breakdown.setdefault(category_name, {"category": category_name, "quantity": 0, "revenue": 0.0})
            category["quantity"] += item.quantity
            category["revenue"] += item.total
            product_key = item.product_id
            product = product_breakdown.setdefault(product_key, {
                "product_id": product_key,
                "product": item.product_name,
                "model": item.model,
                "brand": item.brand or "Other",
                "category": category_name,
                "quantity": 0,
                "revenue": 0.0
            })
            product["quantity"] += item.quantity
            product["revenue"] += item.total
            brand = brand_breakdown.setdefault(item.brand or "Other", {"brand": item.brand or "Other", "units": 0, "revenue": 0.0})
            brand["units"] += item.quantity
            brand["revenue"] += item.total

    for row in category_breakdown.values():
        row["revenue"] = round(row["revenue"], 2)
    for row in product_breakdown.values():
        row["revenue"] = round(row["revenue"], 2)
        row["average_selling_price"] = round(row["revenue"] / row["quantity"], 2) if row["quantity"] else 0.0
    for row in brand_breakdown.values():
        row["revenue"] = round(row["revenue"], 2)

    user_ids = {sale.user_id for sale in sales if sale.user_id}
    users = {user.id: user.full_name for user in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}
    transactions = [
        {
            "id": sale.id,
            "invoice_number": sale.invoice_number,
            "date": sale.invoice_date.isoformat(),
            "customer": sale.customer_name,
            "products": ", ".join(f"{item.product_name} x{item.quantity}" for item in sale.items),
            "quantity": sum(item.quantity for item in sale.items),
            "discount": round(sale.discount_amount, 2),
            "tax": round(sale.total_tax, 2),
            "final_amount": round(sale.final_payable, 2),
            "payment_methods": ", ".join(sorted({payment.payment_method for payment in sale.payments})),
            "staff": users.get(sale.user_id, "Unknown")
        }
        for sale in sales
    ]

    return {
        "period": {"start": s_date.isoformat(), "end": e_date.isoformat()},
        "total_revenue": round(total_revenue, 2),
        "total_tax_collected": round(total_tax, 2),
        "total_discount_given": round(total_discount, 2),
        "invoices_count": total_invoices,
        "total_items_sold": total_items,
        "total_paid": round(sum(s.paid_amount for s in sales), 2),
        "total_due": round(sum(s.balance_due for s in sales), 2),
        "total_emi_sales": round(sum(s.final_payable for s in sales if s.payment_type == "EMI"), 2),
        "payment_methods": payment_breakdown,
        "cash_sales": round(payment_breakdown.get("CASH", 0.0), 2),
        "upi_sales": round(payment_breakdown.get("UPI", 0.0), 2),
        "card_bank_sales": round(payment_breakdown.get("CARD", 0.0) + payment_breakdown.get("BANK", 0.0), 2),
        "brands": list(brand_breakdown.values()),
        "categories": list(category_breakdown.values()),
        "products": list(product_breakdown.values()),
        "transactions": transactions
    }

@router.get("/profit-loss")
def get_profit_loss_report(
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role and current_user.role.code == "STAFF":
        raise HTTPException(status_code=403, detail="Staff members are not authorized to view Profit & Loss reports.")

    today = datetime.date.today()
    s_date = start_date or today.replace(day=1) # First day of current month
    e_date = end_date or today

    return calculate_comprehensive_profit_loss(db, current_user.business_id, s_date, e_date)

@router.get("/gst-summary")
def get_gst_summary_report(
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    GSTR-1 compliant summary: Taxable Turnover, CGST, SGST, IGST, and HSN-wise tax breakdown.
    """
    biz_id = current_user.business_id
    today = datetime.date.today()
    s_date = start_date or today.replace(day=1)
    e_date = end_date or today

    sales = db.query(Sale).filter(
        Sale.business_id == biz_id,
        Sale.status == "COMPLETED",
        Sale.is_gst_invoice == True,
        Sale.invoice_date >= s_date,
        Sale.invoice_date <= e_date
    ).all()

    taxable_turnover = sum(s.taxable_amount for s in sales)
    cgst_total = sum(s.cgst_amount for s in sales)
    sgst_total = sum(s.sgst_amount for s in sales)
    igst_total = sum(s.igst_amount for s in sales)
    total_tax = sum(s.total_tax for s in sales)

    # HSN breakdown
    hsn_query = db.query(
        SaleItem.hsn_code,
        SaleItem.gst_rate,
        func.sum(SaleItem.taxable_value),
        func.sum(SaleItem.cgst),
        func.sum(SaleItem.sgst),
        func.sum(SaleItem.total)
    ).join(Sale, SaleItem.sale_id == Sale.id).filter(
        Sale.business_id == biz_id,
        Sale.status == "COMPLETED",
        Sale.is_gst_invoice == True,
        Sale.invoice_date >= s_date,
        Sale.invoice_date <= e_date
    ).group_by(SaleItem.hsn_code, SaleItem.gst_rate).all()

    hsn_breakdown = [
        {
            "hsn_code": h[0],
            "gst_rate": h[1],
            "taxable_value": round(float(h[2]), 2),
            "cgst": round(float(h[3]), 2),
            "sgst": round(float(h[4]), 2),
            "total": round(float(h[5]), 2)
        }
        for h in hsn_query
    ]

    return {
        "period": {"start": s_date.isoformat(), "end": e_date.isoformat()},
        "taxable_turnover": round(taxable_turnover, 2),
        "cgst_amount": round(cgst_total, 2),
        "sgst_amount": round(sgst_total, 2),
        "igst_amount": round(igst_total, 2),
        "total_tax": round(total_tax, 2),
        "invoices_count": len(sales),
        "hsn_summary": hsn_breakdown
    }

@router.get("/stock-valuation")
def get_stock_valuation_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role and current_user.role.code == "STAFF":
        raise HTTPException(status_code=403, detail="Staff members are not authorized to view stock valuation.")

    biz_id = current_user.business_id

    # Serialized mobiles & devices
    serialized_in_stock = db.query(SerialNumber).filter(
        SerialNumber.business_id == biz_id,
        SerialNumber.status == "IN_STOCK"
    ).all()
    serialized_val = sum(s.purchase_cost for s in serialized_in_stock)

    # Non-serialized accessories
    non_ser = db.query(Product).filter(
        Product.business_id == biz_id,
        Product.is_serialized == False,
        Product.is_active == True
    ).all()
    non_ser_val = sum(p.purchase_cost * p.current_stock for p in non_ser)
    non_ser_qty = sum(p.current_stock for p in non_ser)

    total_value = serialized_val + non_ser_val
    total_items = len(serialized_in_stock) + non_ser_qty

    return {
        "total_stock_value": round(total_value, 2),
        "total_items_count": total_items,
        "smartphones_and_devices": {
            "count": len(serialized_in_stock),
            "value": round(serialized_val, 2)
        },
        "accessories": {
            "count": non_ser_qty,
            "value": round(non_ser_val, 2)
        }
    }

@router.get("/export/csv")
def export_csv(
    report_type: str = Query(..., pattern="^(sales|customers|inventory|expenses)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    biz_id = current_user.business_id
    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == "sales":
        writer.writerow(["Invoice Number", "Date", "Customer Name", "Customer Phone", "Grand Total", "Paid Amount", "Balance Due", "Status"])
        sales = db.query(Sale).filter(Sale.business_id == biz_id).order_by(Sale.id.desc()).all()
        for s in sales:
            writer.writerow([s.invoice_number, s.invoice_date, s.customer_name, s.customer_phone, s.grand_total, s.paid_amount, s.balance_due, s.status])

    elif report_type == "customers":
        writer.writerow(["Name", "Phone", "City", "Current Balance (Due)", "Total Purchases", "Total Paid"])
        custs = db.query(Customer).filter(Customer.business_id == biz_id).all()
        for c in custs:
            writer.writerow([c.name, c.phone, c.city, c.current_balance, c.total_purchases, c.total_paid])

    elif report_type == "inventory":
        writer.writerow(["Product Name", "Brand", "Model", "Current Stock", "Selling Price", "HSN Code", "GST %"])
        prods = db.query(Product).filter(Product.business_id == biz_id).all()
        for p in prods:
            writer.writerow([p.name, p.brand, p.model, p.current_stock, p.selling_price, p.hsn_code, p.gst_rate])

    elif report_type == "expenses":
        writer.writerow(["Category", "Amount", "Date", "Payment Method", "Vendor", "Notes"])
        exps = db.query(Expense).filter(Expense.business_id == biz_id).order_by(Expense.expense_date.desc()).all()
        for e in exps:
            cat_name = e.category.name if e.category else ""
            writer.writerow([cat_name, e.amount, e.expense_date, e.payment_method, e.vendor or "", e.notes or ""])

    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=dg_retail_{report_type}_{datetime.date.today()}.csv"}
    )


@router.get("/sales-summary/pdf")
def export_sales_summary_pdf(
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
    category_id: Optional[int] = None,
    brand: Optional[str] = None,
    product_search: Optional[str] = None,
    customer_search: Optional[str] = None,
    payment_method: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    report = get_sales_report(
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        brand=brand,
        product_search=product_search,
        customer_search=customer_search,
        payment_method=payment_method,
        db=db,
        current_user=current_user
    )
    styles = getSampleStyleSheet()
    title_style = styles["Title"]
    body_style = styles["BodyText"]
    body_style.fontSize = 8
    body_style.leading = 10
    buffer = io.BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=landscape(A4), rightMargin=12 * mm, leftMargin=12 * mm, topMargin=12 * mm, bottomMargin=12 * mm)
    story = [
        Paragraph("DG-Retail OS - Sales Analytics", title_style),
        Paragraph(f"Period: {report['period']['start']} to {report['period']['end']}", body_style),
        Spacer(1, 5 * mm),
    ]

    summary_rows = [
        ["Total Sales", "Bills", "Items", "Discount", "GST", "Paid", "Due", "EMI Sales"],
        [f"Rs. {report['total_revenue']:,.2f}", str(report["invoices_count"]), str(report["total_items_sold"]), f"Rs. {report['total_discount_given']:,.2f}", f"Rs. {report['total_tax_collected']:,.2f}", f"Rs. {report['total_paid']:,.2f}", f"Rs. {report['total_due']:,.2f}", f"Rs. {report['total_emi_sales']:,.2f}"]
    ]
    story.append(Table(summary_rows, repeatRows=1, style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
        ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("PADDING", (0, 0), (-1, -1), 5),
    ])))
    story.append(Spacer(1, 5 * mm))

    def add_section(heading, headers, rows):
        story.append(Paragraph(heading, styles["Heading3"]))
        table_rows = [headers] + rows if rows else [headers, ["No matching records"] + [""] * (len(headers) - 1)]
        story.append(Table(table_rows, repeatRows=1, style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("PADDING", (0, 0), (-1, -1), 4),
        ])))
        story.append(Spacer(1, 4 * mm))

    add_section("Payment Summary", ["Cash", "UPI", "Card / Bank", "EMI"], [[
        f"Rs. {report['cash_sales']:,.2f}", f"Rs. {report['upi_sales']:,.2f}", f"Rs. {report['card_bank_sales']:,.2f}", f"Rs. {report['total_emi_sales']:,.2f}"
    ]])
    add_section("Category-wise Sales", ["Category", "Quantity", "Sales Amount"], [[row["category"], str(row["quantity"]), f"Rs. {row['revenue']:,.2f}"] for row in report["categories"]])
    add_section("Product-wise Sales", ["Product", "Brand", "Category", "Quantity", "Sales Amount", "Average Price"], [[row["product"], row["brand"], row["category"], str(row["quantity"]), f"Rs. {row['revenue']:,.2f}", f"Rs. {row['average_selling_price']:,.2f}"] for row in report["products"]])
    add_section("Brand-wise Sales", ["Brand", "Units", "Sales Amount"], [[row["brand"], str(row["units"]), f"Rs. {row['revenue']:,.2f}"] for row in report["brands"]])
    add_section("Matching Transactions", ["Invoice", "Date", "Customer", "Products", "Qty", "Final", "Payment", "Staff"], [[row["invoice_number"], row["date"], row["customer"], row["products"], str(row["quantity"]), f"Rs. {row['final_amount']:,.2f}", row["payment_methods"] or "-", row["staff"]] for row in report["transactions"]])
    document.build(story)
    filename = f"dg_retail_sales_{report['period']['start']}_to_{report['period']['end']}.pdf"
    return Response(content=buffer.getvalue(), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={filename}"})


@router.get("/sales-summary/xlsx")
def export_sales_summary_xlsx(
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
    category_id: Optional[int] = None,
    brand: Optional[str] = None,
    product_search: Optional[str] = None,
    customer_search: Optional[str] = None,
    payment_method: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    report = get_sales_report(
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        brand=brand,
        product_search=product_search,
        customer_search=customer_search,
        payment_method=payment_method,
        db=db,
        current_user=current_user
    )
    workbook = Workbook()
    summary = workbook.active
    summary.title = "Summary"
    summary.append(["Sales Analytics", f"{report['period']['start']} to {report['period']['end']}"])
    summary.append([])
    summary.append(["Metric", "Value"])
    for label, value in [
        ("Total Sales", report["total_revenue"]), ("Bills", report["invoices_count"]),
        ("Items Sold", report["total_items_sold"]), ("Discount", report["total_discount_given"]),
        ("GST", report["total_tax_collected"]), ("Paid", report["total_paid"]),
        ("Credit / Due", report["total_due"]), ("EMI Sales", report["total_emi_sales"]),
        ("Cash Sales", report["cash_sales"]), ("UPI Sales", report["upi_sales"]),
        ("Card / Bank Sales", report["card_bank_sales"])
    ]:
        summary.append([label, value])

    def add_sheet(title, headers, rows):
        sheet = workbook.create_sheet(title)
        sheet.append(headers)
        for row in rows:
            sheet.append(row)
        sheet.freeze_panes = "A2"
        sheet.auto_filter.ref = sheet.dimensions
        for cell in sheet[1]:
            cell.font = cell.font.copy(bold=True)
        for column in sheet.columns:
            width = min(max(len(str(cell.value or "")) for cell in column) + 2, 42)
            sheet.column_dimensions[column[0].column_letter].width = width

    add_sheet("Categories", ["Category", "Quantity Sold", "Sales Amount"], [[row["category"], row["quantity"], row["revenue"]] for row in report["categories"]])
    add_sheet("Products", ["Product", "Brand", "Category", "Quantity Sold", "Sales Amount", "Average Selling Price"], [[row["product"], row["brand"], row["category"], row["quantity"], row["revenue"], row["average_selling_price"]] for row in report["products"]])
    add_sheet("Brands", ["Brand", "Units Sold", "Sales Amount"], [[row["brand"], row["units"], row["revenue"]] for row in report["brands"]])
    add_sheet("Transactions", ["Invoice", "Date", "Customer", "Products", "Quantity", "Discount", "Tax", "Final Amount", "Payment Method", "Staff"], [[row["invoice_number"], row["date"], row["customer"], row["products"], row["quantity"], row["discount"], row["tax"], row["final_amount"], row["payment_methods"], row["staff"]] for row in report["transactions"]])

    output = io.BytesIO()
    workbook.save(output)
    filename = f"dg_retail_sales_{report['period']['start']}_to_{report['period']['end']}.xlsx"
    return Response(content=output.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename={filename}"})
