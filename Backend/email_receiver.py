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
                    
                    # Extract Email Body
                    description = get_email_body(msg)
                    
                    print(f"[+] Processing Email: '{subject}' from {client_name} ({client_email})")
                    
                    # Create Ticket in QMS SQLite Database
                    ticket_in = TicketCreate(
                      client_name=client_name,
                      client_email=client_email,
                      subject=subject,
                      description=description.strip()
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
