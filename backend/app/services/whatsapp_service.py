import urllib.parse

def clean_phone_number(phone: str) -> str:
    cleaned = "".join(filter(str.isdigit, phone))
    if len(cleaned) == 10:
        return f"91{cleaned}"
    elif len(cleaned) == 12 and cleaned.startswith("91"):
        return cleaned
    return cleaned

def generate_invoice_whatsapp_link(
    store_name: str,
    customer_name: str,
    customer_phone: str,
    invoice_number: str,
    final_amount: float,
    paid_amount: float,
    balance_due: float,
    items_summary: str
) -> str:
    phone = clean_phone_number(customer_phone)
    text = (
        f"🙏 Namaste {customer_name},\n\n"
        f"Thank you for shopping at *{store_name}*!\n\n"
        f"📄 *Invoice No:* {invoice_number}\n"
        f"📱 *Items:* {items_summary}\n"
        f"💰 *Bill Amount:* ₹{final_amount:,.2f}\n"
        f"✅ *Paid Amount:* ₹{paid_amount:,.2f}\n"
    )
    if balance_due > 0.01:
        text += f"⚠️ *Balance Due:* ₹{balance_due:,.2f}\n"
    
    text += "\nHave a great day and visit us again!"
    encoded = urllib.parse.quote(text)
    return f"https://wa.me/{phone}?text={encoded}"

def generate_emi_reminder_whatsapp_link(
    store_name: str,
    customer_name: str,
    customer_phone: str,
    product_name: str,
    installment_no: int,
    due_date_str: str,
    emi_amount: float,
    upi_id: str | None = None
) -> str:
    phone = clean_phone_number(customer_phone)
    text = (
        f"🔔 *EMI Payment Reminder*\n\n"
        f"Namaste {customer_name},\n"
        f"This is a gentle reminder from *{store_name}* regarding your monthly EMI.\n\n"
        f"📱 *Device:* {product_name}\n"
        f"📅 *Installment:* #{installment_no}\n"
        f"💵 *Amount Due:* ₹{emi_amount:,.2f}\n"
        f"⏰ *Due Date:* {due_date_str}\n"
    )
    if upi_id:
        text += f"\n📲 Pay easily via UPI: *{upi_id}*\n"
    
    text += "\nPlease ignore if already paid. Thank you!"
    encoded = urllib.parse.quote(text)
    return f"https://wa.me/{phone}?text={encoded}"

def generate_customer_statement_whatsapp_link(
    store_name: str,
    customer_name: str,
    customer_phone: str,
    total_balance: float,
    upi_id: str | None = None
) -> str:
    phone = clean_phone_number(customer_phone)
    text = (
        f"📋 *Khata Account Statement*\n\n"
        f"Namaste {customer_name},\n"
        f"Your current outstanding balance at *{store_name}* is:\n\n"
        f"⚠️ *Total Balance Due:* ₹{total_balance:,.2f}\n"
    )
    if upi_id:
        text += f"\n📲 Google Pay / PhonePe / UPI: *{upi_id}*\n"
    
    text += "\nKindly clear the pending payment at your earliest convenience. Thank you!"
    encoded = urllib.parse.quote(text)
    return f"https://wa.me/{phone}?text={encoded}"
