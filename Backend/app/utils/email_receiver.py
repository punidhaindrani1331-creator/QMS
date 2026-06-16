import imaplib
import email
from email.header import decode_header
import os
import time
import sys
from dotenv import load_dotenv


from app.database import SessionLocal
from app.services.ticket import TicketService
from app.schemas.ticket import TicketCreate

load_dotenv()

IMAP_SERVER = "imap.gmail.com"
IMAP_PORT = 993
EMAIL_USER = os.getenv("SMTP_USER")
EMAIL_PASS = os.getenv("SMTP_PASSWORD")

def clean_text(text):
    # Decode email subject or body correctly
    if isinstance(text, bytes):
        return text.decode('utf-8', errors='ignore')
    return text

def parse_sender(from_header):
    # Extract name and email from "Name <email@example.com>" header
    name = "External Client"
    email_addr = ""
    
    parsed = email.utils.parseaddr(from_header)
    if parsed[0]:
        name = clean_text(parsed[0])
    if parsed[1]:
        email_addr = parsed[1]
        
    return name, email_addr

def get_email_body(msg):
    # Extract plain text content from the email body
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))
            if content_type == "text/plain" and "attachment" not in content_disposition:
                return clean_text(part.get_payload(decode=True))
    else:
        return clean_text(msg.get_payload(decode=True))
    return "No plain text body found."

# --- Spam / irrelevant email filter ---
SPAM_KEYWORDS = [
    # Advertisements & promotions
    'unsubscribe', 'click here', 'buy now', 'limited offer', 'sale', 'discount',
    'offer expires', 'free gift', 'win a', 'you have won', 'congratulations',
    'earn money', 'make money', 'work from home', 'crypto', 'investment opportunity',
    'Nigerian', 'lottery', 'prize', 'claim your', 'act now', 'exclusive deal',
    'newsletter', 'subscribe', 'promo code', 'coupon', 'marketing',
    # Spam signals
    'viagra', 'casino', 'betting', 'loan offer', 'insurance offer',
    'auto-reply', 'no-reply', 'do not reply', 'noreply',
]

QUERY_KEYWORDS = [
    # Technical issues
    'unable to', 'can\'t', 'cannot', 'not working', 'not loading', 'error',
    'issue', 'problem', 'bug', 'crash', 'slow', 'failed', 'failure',
    'login', 'password', 'reset', 'access', 'blocked', 'locked',
    # Service requests
    'request', 'please provide', 'need', 'require', 'create account',
    'new user', 'permission', 'software', 'hardware', 'allocation',
    # Bug reports
    'not displaying', 'incorrect', 'wrong', 'missing', 'blank', 'broken',
    # Complaints
    'complaint', 'charged', 'billing', 'invoice', 'defect', 'poor service',
    'dispute', 'refund', 'overcharged',
    # General inquiries
    'inquiry', 'enquiry', 'update', 'status', 'information', 'clarification',
    'question', 'how to', 'ticket', 'follow up', 'followup',
]

def is_valid_query(subject: str, body: str) -> bool:
    """Returns True only if email looks like a genuine support query."""
    text = (subject + ' ' + body).lower()

    # Reject if spam keywords found
    for kw in SPAM_KEYWORDS:
        if kw.lower() in text:
            return False

    # Accept if any query keyword found
    for kw in QUERY_KEYWORDS:
        if kw.lower() in text:
            return True

    # Reject if no query signal found at all
    return False


# --- Keyword maps for auto-categorization ---
CATEGORY_KEYWORDS = {
    'Billing': [
        'billing', 'invoice', 'payment', 'charge', 'charged', 'refund',
        'overcharged', 'receipt', 'subscription', 'fee', 'price', 'cost',
        'transaction', 'statement', 'account balance', 'dispute',
    ],
    'Complaint': [
        'complaint', 'unhappy', 'disappointed', 'frustrated', 'poor service',
        'unacceptable', 'terrible', 'worst', 'bad experience', 'rude',
        'not satisfied', 'defect', 'broken product', 'misleading',
    ],
    'Bug': [
        'bug', 'error', 'crash', 'not working', 'not loading', 'broken',
        'not displaying', 'issue', 'problem', 'failed', 'failure', 'glitch',
        'incorrect', 'wrong result', 'missing data', 'blank page', 'slow',
    ],
    'Request': [
        'request', 'please provide', 'need', 'require', 'create account',
        'new user', 'permission', 'access', 'software', 'hardware',
        'allocation', 'how to', 'question', 'inquiry', 'enquiry',
        'update', 'information', 'clarification', 'follow up', 'followup',
    ],
}

def categorize_email(subject: str, body: str) -> str:
    """
    Returns the best-matching category for the email based on keyword scoring.
    Defaults to 'Request' if no strong match found.
    """
    text = (subject + ' ' + body).lower()
    scores = {cat: 0 for cat in CATEGORY_KEYWORDS}
    for cat, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in text:
                scores[cat] += 1
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else 'Request'

def connect_imap():
    mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)
    mail.login(EMAIL_USER, EMAIL_PASS)
    mail.select("inbox")
    return mail

def check_inbox_and_create_tickets(mail):
    # Search for unseen/unread emails
    status, response = mail.search(None, "UNSEEN")
    if status != 'OK':
        raise Exception(f"IMAP search failed with status: {status}")
    
    if response[0]:
        email_ids = response[0].split()
    else:
        email_ids = []
    
    if not email_ids:
        # No new emails
        return
        
    print(f"[*] Found {len(email_ids)} new unread email(s) in inbox. Processing...")
    
    db = SessionLocal()
    
    for e_id in email_ids:
        try:
            # Fetch full email message contents
            status, msg_data = mail.fetch(e_id, "(RFC822)")
            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email.message_from_bytes(response_part[1])
                    
                    # Extract and decode Subject
                    subject, encoding = decode_header(msg["Subject"])[0]
                    if isinstance(subject, bytes):
                        subject = subject.decode(encoding or "utf-8", errors="ignore")
                    subject = clean_text(subject or "No Subject")
                    
                    # Extract Sender Name and Email Address
                    from_header = msg.get("From")
                    client_name, client_email = parse_sender(from_header)
                    
                    # Prevent loops: Ignore emails from the system itself or mailer daemons
                    if not client_email or client_email.lower() == EMAIL_USER.lower() or "mailer-daemon" in client_email.lower() or "postmaster" in client_email.lower():
                        print(f"[-] Ignoring email from system/daemon: {client_email}")
                        mail.store(e_id, "+FLAGS", "\\Seen")
                        continue
                    
                    # Extract Email Body
                    description = get_email_body(msg)

                    # Filter: only process genuine support queries
                    if not is_valid_query(subject, description):
                        print(f"[-] Rejected non-query email: '{subject}' from {client_email}")
                        mail.store(e_id, "+FLAGS", "\\Seen")
                        continue

                    print(f"[+] Processing Email: '{subject}' from {client_name} ({client_email})")
                    
                    # Auto-categorize based on email subject + body
                    category = categorize_email(subject, description)
                    print(f"[~] Auto-categorized as '{category}'")

                    # Create Ticket in QMS Database
                    ticket_in = TicketCreate(
                      client_name=client_name,
                      client_email=client_email,
                      subject=subject,
                      description=description.strip(),
                      category=category
                    )
                    
                    db_ticket = TicketService.create_ticket(
                      db=db,
                      ticket_in=ticket_in
                    )
                    print(f"[✓] Ticket #{db_ticket.id} created for {client_email}")
                    
            # Mark email as read/seen in Gmail so it isn't processed again
            mail.store(e_id, "+FLAGS", "\\Seen")
            
        except Exception as ex:
            print(f"[-] Error processing email ID {e_id}: {ex}")
            
    db.close()

def start_email_receiver():
    if not EMAIL_USER or not EMAIL_PASS:
        print("[-] EMAIL_USER or EMAIL_PASS not configured in .env. Exiting.")
        return
        
    print("[*] QMS Real-time Email-to-Ticket Ingestion service started in background...")
    print(f"[*] Listening on Gmail account: {EMAIL_USER}")
    
    mail = None
    while True:
        try:
            if mail is None:
                print("[*] Connecting to IMAP server...")
                mail = connect_imap()
                
            status, response = mail.noop()
            if status != 'OK':
                raise Exception(f"IMAP NOOP failed with status: {status}")
            check_inbox_and_create_tickets(mail)
            time.sleep(60)
            
        except KeyboardInterrupt:
            print("\n[*] Stopping service.")
            if mail:
                try:
                    mail.close()
                    mail.logout()
                except:
                    pass
            break
        except Exception as e:
            print(f"[-] Error in service loop: {e}. Reconnecting in 10s...")
            mail = None
            time.sleep(10)

if __name__ == "__main__":
    start_email_receiver()
