import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv

load_dotenv()

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

def send_ticket_confirmation(to_email: str, client_name: str, ticket_id: int, subject: str):
    if not SMTP_USER or not SMTP_PASSWORD:
        print("SMTP_USER or SMTP_PASSWORD not configured. Skipping email sending.")
        return

    msg = MIMEMultipart()
    msg['From'] = SMTP_USER
    msg['To'] = to_email
    msg['Subject'] = f"[Ticket #{ticket_id}] Re: {subject} - Query Submitted"

    body = f"""
    Dear {client_name},
    
    Thank you for contacting us. A support ticket has been created successfully for your query.
    
    Ticket ID: #{ticket_id}
    Subject: {subject}
    Status: Open
    
    Our support team is reviewing your query and will respond shortly.
    
    Best regards,
    QMS Support Team
    """
    
    msg.attach(MIMEText(body, 'plain'))
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=20)
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            text = msg.as_string()
            server.sendmail(SMTP_USER, [to_email], text)
            server.quit()
            print(f"[EMAIL OK] Ticket #{ticket_id} sent to: {to_email}")
            return  # Success, exit the loop
        except smtplib.SMTPRecipientsRefused as e:
            print(f"[EMAIL FAIL] Recipient refused for ticket #{ticket_id}: {e.recipients}")
            break  # No point in retrying if recipient is refused
        except smtplib.SMTPAuthenticationError as e:
            print(f"[EMAIL FAIL] Auth error for ticket #{ticket_id}: {e}")
            break  # No point in retrying if authentication fails
        except Exception as e:
            print(f"[EMAIL WARNING] Attempt {attempt + 1} failed for ticket #{ticket_id} to {to_email}: {type(e).__name__}: {e}")
            if attempt < max_retries - 1:
                import time
                time.sleep(2)  # Wait 2 seconds before retrying
            else:
                print(f"[EMAIL FAIL] Final attempt failed for ticket #{ticket_id} to {to_email}")
