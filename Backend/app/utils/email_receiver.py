import imaplib
import email
from email.header import decode_header
import os
import time
import socket
from dotenv import load_dotenv

from app.database import SessionLocal
from app.services.ticket import TicketService
from app.schemas.ticket import TicketCreate
from app.constants import IMAP_SOCKET_TIMEOUT, IMAP_POLL_INTERVAL, EMAIL_BACKOFF_MIN, EMAIL_BACKOFF_MAX
from app.utils.logger import email_logger

load_dotenv()

IMAP_SERVER = os.getenv("IMAP_SERVER", "imap.gmail.com")
IMAP_PORT = int(os.getenv("IMAP_PORT", "993"))
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


def safe_logout(mail):
    """Silently close and logout an IMAP connection that may already be dead."""
    if mail is None:
        return
    for fn in (mail.close, mail.logout):
        try:
            fn()
        except Exception:
            pass

def connect_imap():
    # Apply a socket-level timeout BEFORE creating the SSL connection so that
    # a hung or EOF'd socket raises a timed-out exception instead of blocking.
    socket.setdefaulttimeout(IMAP_SOCKET_TIMEOUT)
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

    email_logger.info(f"Found {len(email_ids)} new unread email(s) in inbox. Processing")
    
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
                        email_logger.debug(f"Ignoring email from system/daemon: {client_email}")
                        mail.store(e_id, "+FLAGS", "\\Seen")
                        continue

                    # Extract Email Body
                    description = get_email_body(msg)

                    # Filter: only process genuine support queries
                    if not is_valid_query(subject, description):
                        email_logger.warning(f"Rejected non-query email: '{subject}' from {client_email}")
                        try:
                            from app.utils.email_sender import send_rejection_email
                            send_rejection_email(client_email, client_name, subject)
                            email_logger.info(f"Sent rejection notification to {client_email}")
                        except Exception as err:
                            email_logger.error(f"Failed to send rejection notification: {err}")
                        mail.store(e_id, "+FLAGS", "\\Seen")
                        continue

                    email_logger.info(f"Processing email: '{subject}' from {client_name} ({client_email})")

                    # Auto-categorize based on email subject + body
                    category = categorize_email(subject, description)
                    email_logger.debug(f"Auto-categorized email as '{category}'")

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
                    email_logger.info(f"Ticket #{db_ticket.id} created for {client_email}")

            # Mark email as read/seen in Gmail so it isn't processed again
            mail.store(e_id, "+FLAGS", "\\Seen")

        except Exception as ex:
            email_logger.error(f"Error processing email ID {e_id}: {ex}")
            
    db.close()

def start_email_receiver():
    if not EMAIL_USER or not EMAIL_PASS:
        email_logger.error("EMAIL_USER or EMAIL_PASS not configured in .env. Email receiver not starting.")
        return

    email_logger.info("Email-to-Ticket ingestion service started (background daemon)")
    email_logger.info(f"Listening on Gmail account: {EMAIL_USER}")

    backoff = EMAIL_BACKOFF_MIN

    while True:
        mail = None
        try:
            email_logger.debug("Connecting to IMAP server")
            mail = connect_imap()

            # Verify the connection is alive before doing real work.
            status, _ = mail.noop()
            if status != 'OK':
                raise Exception(f"IMAP NOOP failed with status: {status}")

            check_inbox_and_create_tickets(mail)

            # Reset backoff after a successful cycle.
            backoff = EMAIL_BACKOFF_MIN

        except KeyboardInterrupt:
            email_logger.info("Stopping email receiver service")
            safe_logout(mail)
            break

        except Exception as e:
            email_logger.error(f"Error in service loop: {e}. Reconnecting in {backoff}s")
            safe_logout(mail)
            time.sleep(backoff)
            # Exponential backoff so transient outages don't hammer the server.
            backoff = min(backoff * 2, EMAIL_BACKOFF_MAX)
            continue

        finally:
            # Always cleanly close the connection at the end of each cycle.
            safe_logout(mail)

        time.sleep(IMAP_POLL_INTERVAL)

if __name__ == "__main__":
    start_email_receiver()
