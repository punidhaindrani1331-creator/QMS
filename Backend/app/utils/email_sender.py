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


def _send_email(to_email: str, subject: str, body: str):
    """Internal helper: sends a plain-text email with retries."""
    if not SMTP_USER or not SMTP_PASSWORD:
        print("SMTP_USER or SMTP_PASSWORD not configured. Skipping email.")
        return

    msg = MIMEMultipart()
    msg['From'] = SMTP_USER
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    max_retries = 3
    for attempt in range(max_retries):
        try:
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=20)
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, [to_email], msg.as_string())
            server.quit()
            print(f"[EMAIL OK] Sent to: {to_email} | Subject: {subject}")
            return
        except smtplib.SMTPRecipientsRefused as e:
            print(f"[EMAIL FAIL] Recipient refused: {e.recipients}")
            break
        except smtplib.SMTPAuthenticationError as e:
            print(f"[EMAIL FAIL] Auth error: {e}")
            break
        except Exception as e:
            print(f"[EMAIL WARNING] Attempt {attempt + 1} failed: {type(e).__name__}: {e}")
            if attempt < max_retries - 1:
                import time
                time.sleep(2)
            else:
                print(f"[EMAIL FAIL] Final attempt failed for {to_email}")


def send_ticket_confirmation(to_email: str, client_name: str, ticket_id: int, subject: str):
    """Sent when a ticket is first created (from email or frontend)."""
    email_subject = f"[Ticket #{ticket_id}] Re: {subject} - Query Submitted"
    body = f"""Dear {client_name},

Thank you for contacting us. A support ticket has been created successfully for your query.

  Ticket ID : #{ticket_id}
  Subject   : {subject}
  Status    : Pending

Our support team is reviewing your query and will respond shortly.
You will receive email updates as your ticket progresses.

Best regards,
QMS Support Team"""
    _send_email(to_email, email_subject, body)


def send_status_update_email(to_email: str, client_name: str, ticket_id: int,
                              subject: str, new_status: str,
                              estimated_wait: int = None):
    """Sent whenever staff moves a ticket to In Progress or Completed."""

    if new_status == "In Progress":
        email_subject = f"[Ticket #{ticket_id}] Your Request is Now Being Processed"
        wait_line = (
            f"  Estimated completion : ~{estimated_wait} minutes\n"
            if estimated_wait else ""
        )
        body = f"""Dear {client_name},

Great news! Your support ticket is now being actively handled by our team.

  Ticket ID : #{ticket_id}
  Subject   : {subject}
  Status    : In Progress
{wait_line}
We will notify you as soon as it is resolved. If you have additional details to share, simply reply to this email.

Best regards,
QMS Support Team"""

    elif new_status == "Completed":
        email_subject = f"[Ticket #{ticket_id}] Your Request Has Been Resolved ✓"
        body = f"""Dear {client_name},

Your support ticket has been resolved and closed.

  Ticket ID : #{ticket_id}
  Subject   : {subject}
  Status    : Completed

We hope your query was addressed satisfactorily. If you need further assistance, feel free to reply to this email or raise a new ticket.

Thank you for choosing our support service.

Best regards,
QMS Support Team"""

    else:
        # Unknown status — skip sending
        return

    _send_email(to_email, email_subject, body)


def send_reply_notification(to_email: str, client_name: str, ticket_id: int, subject: str, message_content: str, sender_name: str):
    """Sent when staff replies to a ticket."""
    email_subject = f"[Ticket #{ticket_id}] New Response from support: {subject}"
    body = f"""Dear {client_name},

A new response has been posted to your support ticket.

  Ticket ID : #{ticket_id}
  Subject   : {subject}
  From      : {sender_name} (Support Staff)

Message:
--------------------------------------------------
{message_content}
--------------------------------------------------

To respond, please log in to the QMS Hub or reply directly to this email.

Best regards,
QMS Support Team"""
    _send_email(to_email, email_subject, body)


