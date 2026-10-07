import datetime
from sqlalchemy.orm import Session
from app.models.sale import Sale, SaleItem, SalePayment
from app.models.product import Product, ProductVariant, SerialNumber, StockMovement
from app.models.party import Customer, CustomerLedger
from app.models.finance import Account, AccountTransaction
from app.models.emi import EmiPlan
from app.models.specialized import ExchangeDevice, WarrantyRecord
from app.models.audit import AuditLog
from app.services.emi_service import calculate_emi_plan_details, create_emi_installments

def generate_invoice_number(db: Session, business_id: int, prefix: str = "INV") -> str:
    """
    Generates a sequential daily invoice number: INV-YYYYMMDD-XXXX
    """
    today_str = datetime.date.today().strftime("%Y%m%d")
    count_today = db.query(Sale).filter(
        Sale.business_id == business_id,
        Sale.invoice_number.like(f"{prefix}-{today_str}-%")
    ).count()
    return f"{prefix}-{today_str}-{count_today + 1:04d}"

def process_pos_sale(
    db: Session,
    business_id: int,
    user_id: int,
    user_name: str,
    user_role: str,
    customer_data: dict,
    items_data: list[dict],
    discount_amount: float = 0.0,
    is_gst_invoice: bool = True,
    exchange_device_data: dict | None = None,
    payments_data: list[dict] | None = None,
    emi_details: dict | None = None,
    notes: str | None = None
) -> Sale:
    """
    Executes an atomic POS transaction connecting Sales, Inventory, IMEI, Accounting, Khata, and EMI.
    """
    if not items_data:
        raise ValueError("Cart cannot be empty")

    # 1. Resolve or Create Customer
    customer = None
    customer_phone = customer_data.get("phone", "").strip()
    customer_name = customer_data.get("name", "Walk-in Customer").strip()
    
    if customer_phone:
        customer = db.query(Customer).filter(
            Customer.business_id == business_id,
            Customer.phone == customer_phone
        ).first()
        
        if not customer:
            customer = Customer(
                business_id=business_id,
                name=customer_name,
                phone=customer_phone,
                email=customer_data.get("email"),
                address=customer_data.get("address"),
                city=customer_data.get("city", "Pune"),
                state=customer_data.get("state", "Maharashtra"),
                gstin=customer_data.get("gstin")
            )
            db.add(customer)
            db.flush()

    # 2. Verify all Serialized/IMEI items are IN_STOCK and prevent duplicate selling
    checked_serial_ids = set()
    total_cogs = 0.0
    subtotal = 0.0
    total_tax = 0.0
    cgst_total = 0.0
    sgst_total = 0.0
    igst_total = 0.0
    total_item_discounts = 0.0

    prepared_items = []
    
    for item in items_data:
        product_id = item["product_id"]
        product = db.query(Product).filter(Product.id == product_id, Product.business_id == business_id).first()
        if not product:
            raise ValueError(f"Product ID {product_id} not found")

        quantity = item.get("quantity", 1)
        if not isinstance(quantity, int) or quantity < 1:
            raise ValueError("Quantity must be at least 1")
        unit_price = item.get("unit_price", product.selling_price)
        unit_mrp = item.get("unit_mrp", product.mrp or unit_price)
        item_discount = item.get("discount", 0.0)
        gst_rate = item.get("gst_rate", product.gst_rate)

        if unit_price < 0 or unit_mrp < 0 or item_discount < 0 or not 0 <= gst_rate <= 100:
            raise ValueError("Invalid price, discount, or GST value")
        if item_discount > unit_price * quantity:
            raise ValueError(f"Discount cannot exceed the value of {product.name}")
        
        serial_number_id = item.get("serial_number_id")
        serial_obj = None
        imei1 = item.get("imei1")
        imei2 = item.get("imei2")
        serial_num = item.get("serial_number")

        item_purchase_cost = product.purchase_cost

        if product.is_serialized:
            if not serial_number_id and imei1:
                serial_obj = db.query(SerialNumber).filter(
                    SerialNumber.business_id == business_id,
                    SerialNumber.imei1 == imei1
                ).first()
                if serial_obj:
                    serial_number_id = serial_obj.id

            if not serial_number_id:
                raise ValueError(f"IMEI/Serial is required for {product.name}")

            if serial_number_id in checked_serial_ids:
                raise ValueError(f"Duplicate IMEI selected in same transaction: {imei1}")
            checked_serial_ids.add(serial_number_id)

            if not serial_obj:
                serial_obj = db.query(SerialNumber).filter(
                    SerialNumber.id == serial_number_id,
                    SerialNumber.business_id == business_id
                ).first()

            if not serial_obj:
                raise ValueError(f"Serial record {serial_number_id} not found")

            if serial_obj.product_id != product.id:
                raise ValueError("Serial record does not belong to the selected product")

            if serial_obj.status != "IN_STOCK":
                raise ValueError(f"Device with IMEI {serial_obj.imei1 or serial_obj.serial_number} is already {serial_obj.status}!")

            item_purchase_cost = serial_obj.purchase_cost or product.purchase_cost
            imei1 = serial_obj.imei1
            imei2 = serial_obj.imei2
            serial_num = serial_obj.serial_number
            quantity = 1  # Serialized devices are sold 1-by-1 per IMEI
        else:
            if product.current_stock < quantity:
                raise ValueError(f"Insufficient stock for {product.name}")

        # GST Calculations (Indian Retail: prices are inclusive of GST at POS counter)
        item_subtotal = (unit_price * quantity) - item_discount
        if is_gst_invoice and gst_rate > 0:
            # Reverse calculate taxable value from GST inclusive amount
            taxable_val = round(item_subtotal / (1 + (gst_rate / 100.0)), 2)
            item_tax = round(item_subtotal - taxable_val, 2)
            cgst = round(item_tax / 2.0, 2)
            sgst = round(item_tax - cgst, 2) # ensure exact sum
            igst = 0.0 # Same state (intra-state standard)
        else:
            taxable_val = item_subtotal
            item_tax = 0.0
            cgst = 0.0
            sgst = 0.0
            igst = 0.0

        subtotal += (unit_price * quantity)
        total_tax += item_tax
        cgst_total += cgst
        sgst_total += sgst
        igst_total += igst
        total_cogs += (item_purchase_cost * quantity)
        total_item_discounts += item_discount

        prepared_items.append({
            "product": product,
            "product_id": product.id,
            "variant_id": item.get("variant_id"),
            "serial_obj": serial_obj,
            "serial_number_id": serial_number_id,
            "product_name": product.name,
            "brand": product.brand,
            "model": product.model,
            "imei1": imei1,
            "imei2": imei2,
            "serial_number": serial_num,
            "hsn_code": product.hsn_code,
            "quantity": quantity,
            "unit_mrp": unit_mrp,
            "unit_price": unit_price,
            "purchase_cost": item_purchase_cost,
            "discount": item_discount,
            "gst_rate": gst_rate,
            "taxable_value": taxable_val,
            "cgst": cgst,
            "sgst": sgst,
            "igst": igst,
            "total": item_subtotal,
            "warranty_months": product.warranty_months
        })

    # 3. Handle Exchange Phone Deduction
    exchange_deduction = 0.0
    exchange_device_obj = None
    if exchange_device_data and exchange_device_data.get("final_exchange_value", 0) > 0:
        exchange_deduction = float(exchange_device_data["final_exchange_value"])

    # 4. Final Totals
    effective_discount = total_item_discounts + discount_amount
    if effective_discount > subtotal + 0.01:
        raise ValueError("Total discount cannot exceed the sale subtotal")
    grand_total = max(0.0, round(subtotal - effective_discount, 2))
    final_payable = max(0.0, round(grand_total - exchange_deduction, 2))

    # 5. Process Payments & Balance Due
    total_paid = 0.0
    payment_records = []
    if payments_data:
        for p in payments_data:
            amt = float(p.get("amount", 0.0))
            if amt > 0:
                total_paid += amt
                payment_records.append(p)

    balance_due = max(0.0, round(final_payable - total_paid, 2))

    if total_paid > final_payable + 0.01:
        raise ValueError("Total payments cannot exceed the sale total")

    if emi_details and emi_details.get("number_of_installments", 0) > 0:
        months = int(emi_details.get("number_of_installments", 0))
        interest_rate = float(emi_details.get("interest_rate", 0.0))
        processing_fee = float(emi_details.get("processing_fee", 0.0))
        if not customer:
            raise ValueError("A customer with a valid phone number is required for EMI")
        if total_paid < 0 or total_paid > final_payable + 0.01:
            raise ValueError("Down payment must be between zero and the sale total")
        if months not in {3, 6, 9, 12, 15, 18, 24}:
            raise ValueError("EMI duration must be 3, 6, 9, 12, 15, 18, or 24 months")
        if interest_rate < 0 or processing_fee < 0:
            raise ValueError("Interest rate and processing fee cannot be negative")
    
    # Determine Payment Type & Status
    payment_status = "PAID" if balance_due <= 0.01 else ("PARTIAL" if total_paid > 0 else "UNPAID")
    
    if emi_details and emi_details.get("number_of_installments", 0) > 0:
        payment_type = "EMI"
    elif balance_due > 0.01:
        payment_type = "CREDIT"
    elif len(payment_records) > 1:
        payment_type = "SPLIT"
    else:
        payment_type = payment_records[0].get("payment_method", "FULL") if payment_records else "FULL"

    # 6. Calculate Gross Profit
    # Profit = (final_payable - total_tax) - total_cogs
    gross_profit = round((grand_total - (total_tax if is_gst_invoice else 0.0)) - total_cogs, 2)

    # 7. Create Sale
    inv_number = generate_invoice_number(db, business_id)
    sale = Sale(
        business_id=business_id,
        customer_id=customer.id if customer else None,
        user_id=user_id,
        invoice_number=inv_number,
        invoice_date=datetime.date.today(),
        is_gst_invoice=is_gst_invoice,
        customer_name=customer.name if customer else customer_name,
        customer_phone=customer.phone if customer else customer_phone,
        customer_gstin=customer.gstin if customer else customer_data.get("gstin"),
        customer_address=customer.address if customer else customer_data.get("address"),
        subtotal=subtotal,
        discount_amount=effective_discount,
        taxable_amount=round(grand_total - total_tax, 2) if is_gst_invoice else grand_total,
        cgst_amount=cgst_total,
        sgst_amount=sgst_total,
        igst_amount=igst_total,
        total_tax=total_tax,
        grand_total=grand_total,
        exchange_deduction=exchange_deduction,
        final_payable=final_payable,
        paid_amount=total_paid,
        balance_due=balance_due,
        payment_status=payment_status,
        payment_type=payment_type,
        status="COMPLETED",
        total_cogs=total_cogs,
        gross_profit=gross_profit,
        notes=notes
    )
    db.add(sale)
    db.flush()

    # 8. Create Sale Items, Update Inventory, Update Serial Status, Create Warranty
    for p_item in prepared_items:
        sale_item = SaleItem(
            business_id=business_id,
            sale_id=sale.id,
            product_id=p_item["product_id"],
            variant_id=p_item["variant_id"],
            serial_number_id=p_item["serial_number_id"],
            product_name=p_item["product_name"],
            brand=p_item["brand"],
            model=p_item["model"],
            imei1=p_item["imei1"],
            imei2=p_item["imei2"],
            serial_number=p_item["serial_number"],
            hsn_code=p_item["hsn_code"],
            quantity=p_item["quantity"],
            unit_mrp=p_item["unit_mrp"],
            unit_price=p_item["unit_price"],
            purchase_cost=p_item["purchase_cost"],
            discount=p_item["discount"],
            gst_rate=p_item["gst_rate"],
            taxable_value=p_item["taxable_value"],
            cgst=p_item["cgst"],
            sgst=p_item["sgst"],
            igst=p_item["igst"],
            total=p_item["total"],
            warranty_months=p_item["warranty_months"]
        )
        db.add(sale_item)

        # Update stock
        prod = p_item["product"]
        prev_stock = prod.current_stock
        prod.current_stock = max(0, prod.current_stock - p_item["quantity"])

        # Update Serial Number status to SOLD
        if p_item["serial_obj"]:
            s_obj = p_item["serial_obj"]
            s_obj.status = "SOLD"
            s_obj.sale_id = sale.id
            s_obj.selling_price = p_item["unit_price"]
            s_obj.warranty_start = datetime.date.today()
            s_obj.warranty_end = datetime.date.today() + datetime.timedelta(days=p_item["warranty_months"] * 30)

        # Record Stock Movement
        stk_mov = StockMovement(
            business_id=business_id,
            product_id=prod.id,
            serial_number_id=p_item["serial_number_id"],
            movement_type="SALE",
            quantity=p_item["quantity"],
            previous_stock=prev_stock,
            current_stock=prod.current_stock,
            reference_id=sale.id,
            reference_type="sale",
            notes=f"Sold via Invoice #{sale.invoice_number}"
        )
        db.add(stk_mov)

        # Register Warranty Record
        warranty_record = WarrantyRecord(
            business_id=business_id,
            sale_id=sale.id,
            customer_id=customer.id if customer else None,
            product_id=prod.id,
            serial_number_id=p_item["serial_number_id"],
            imei=p_item["imei1"] or p_item["serial_number"],
            product_name=prod.name,
            customer_name=sale.customer_name,
            customer_phone=sale.customer_phone,
            purchase_date=datetime.date.today(),
            warranty_months=p_item["warranty_months"],
            warranty_start=datetime.date.today(),
            warranty_end=datetime.date.today() + datetime.timedelta(days=p_item["warranty_months"] * 30),
            status="ACTIVE"
        )
        db.add(warranty_record)

    # 9. Register Exchange Device if present
    if exchange_device_data and exchange_deduction > 0:
        exchange_device_obj = ExchangeDevice(
            business_id=business_id,
            sale_id=sale.id,
            customer_id=customer.id if customer else None,
            brand=exchange_device_data.get("brand", "Unknown"),
            model=exchange_device_data.get("model", "Unknown"),
            imei=exchange_device_data.get("imei"),
            ram=exchange_device_data.get("ram"),
            storage=exchange_device_data.get("storage"),
            color=exchange_device_data.get("color"),
            age_months=exchange_device_data.get("age_months", 12),
            screen_condition=exchange_device_data.get("screen_condition", "Good"),
            body_condition=exchange_device_data.get("body_condition", "Good"),
            battery_health=exchange_device_data.get("battery_health", "Above 80%"),
            accessories_included=exchange_device_data.get("accessories_included", ""),
            estimated_value=exchange_device_data.get("estimated_value", exchange_deduction),
            final_exchange_value=exchange_deduction,
            status="RECEIVED",
            notes=f"Trade-in for Sale #{sale.invoice_number}"
        )
        db.add(exchange_device_obj)

    # 10. Process Payment Entries & Update Cash/Bank
    for p_record in payment_records:
        method = p_record.get("payment_method", "CASH").upper()
        amt = float(p_record.get("amount", 0.0))
        ref_no = p_record.get("reference_number")

        acc_type = "CASH" if method == "CASH" else "BANK"
        account = db.query(Account).filter(
            Account.business_id == business_id,
            Account.account_type == acc_type,
            Account.is_active == True
        ).first()

        sale_pay = SalePayment(
            business_id=business_id,
            sale_id=sale.id,
            customer_id=customer.id if customer else None,
            account_id=account.id if account else None,
            amount=amt,
            payment_method=method,
            reference_number=ref_no,
            notes=f"POS payment for {sale.invoice_number}"
        )
        db.add(sale_pay)

        if account:
            account.current_balance += amt
            ac_txn = AccountTransaction(
                business_id=business_id,
                account_id=account.id,
                txn_type="CREDIT",
                amount=amt,
                balance_after=account.current_balance,
                reference_type="SALE",
                reference_id=sale.id,
                payment_method=method,
                notes=f"Sale #{sale.invoice_number} from {sale.customer_name}"
            )
            db.add(ac_txn)

    # 11. Customer Khata / Credit Update
    if customer:
        customer.total_purchases += final_payable
        customer.total_paid += total_paid

        if balance_due > 0.01:
            customer.current_balance += balance_due

        # Record Ledger Entry for Sale
        cust_ledger = CustomerLedger(
            business_id=business_id,
            customer_id=customer.id,
            entry_type="SALE",
            debit=final_payable,
            credit=total_paid,
            balance=customer.current_balance,
            payment_method=payment_type,
            reference_id=sale.id,
            reference_type="sale",
            notes=f"Invoice #{sale.invoice_number} ({'Full' if balance_due <= 0.01 else f'Due ₹{balance_due:,.2f}'})"
        )
        db.add(cust_ledger)

    # 12. Create Store-Financed EMI Plan if selected
    if emi_details and emi_details.get("number_of_installments", 0) > 0 and customer:
        months = int(emi_details.get("number_of_installments", 6))
        interest_rate = float(emi_details.get("interest_rate", 0.0))
        processing_fee = float(emi_details.get("processing_fee", 0.0))
        down_pmt = total_paid

        financed_amt = balance_due
        emi_calc = calculate_emi_plan_details(
            financed_principal=financed_amt,
            annual_interest_rate=interest_rate,
            months=months,
            processing_fee=processing_fee
        )

        emi_notes = emi_details.get("notes")
        finance_provider = emi_details.get("finance_provider")
        if finance_provider:
            provider_note = f"Finance provider: {finance_provider}"
            emi_notes = f"{provider_note}; {emi_notes}" if emi_notes else provider_note

        emi_plan = EmiPlan(
            business_id=business_id,
            sale_id=sale.id,
            customer_id=customer.id,
            product_name=prepared_items[0]["product_name"] if prepared_items else "Electronics",
            imei=prepared_items[0].get("imei1"),
            total_sale_amount=final_payable,
            down_payment=down_pmt,
            financed_principal=financed_amt,
            interest_rate=interest_rate,
            interest_amount=emi_calc["interest_amount"],
            processing_fee=processing_fee,
            total_repayable=emi_calc["total_repayable"],
            emi_amount=emi_calc["base_emi"],
            number_of_installments=months,
            emi_frequency="MONTHLY",
            first_due_date=datetime.date.today() + datetime.timedelta(days=30),
            total_paid=0.0,
            balance_remaining=emi_calc["total_repayable"],
            status="ACTIVE",
            notes=emi_notes
        )
        db.add(emi_plan)
        db.flush()

        create_emi_installments(db, emi_plan, datetime.date.today())

    # 13. Audit Log
    audit = AuditLog(
        business_id=business_id,
        user_id=user_id,
        user_name=user_name,
        role=user_role,
        action="CREATE_SALE",
        entity_type="Sale",
        entity_id=sale.id,
        new_values={
            "invoice_number": sale.invoice_number,
            "final_payable": final_payable,
            "paid_amount": total_paid,
            "balance_due": balance_due,
            "payment_type": payment_type,
            "items_count": len(prepared_items)
        },
        notes=f"POS Sale created for {sale.customer_name}"
    )
    db.add(audit)

    db.commit()
    db.refresh(sale)
    return sale
