import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import time
from dotenv import load_dotenv

from app.constants import EMAIL_RETRY_ATTEMPTS, EMAIL_RETRY_BACKOFF_BASE, EMAIL_SMTP_TIMEOUT
from app.utils.logger import email_logger

load_dotenv()

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")


def _send_email(to_email: str, subject: str, body: str):
    """Internal helper: sends a plain-text email with retries."""
    if not SMTP_USER or not SMTP_PASSWORD:
        email_logger.error("SMTP_USER or SMTP_PASSWORD not configured in .env")
        return

    msg = MIMEMultipart()
    msg['From'] = SMTP_USER
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    email_logger.info(f"Preparing to send email to {to_email} with subject: {subject}")

    last_error = None
    for attempt in range(EMAIL_RETRY_ATTEMPTS):
        try:
            email_logger.debug(f"Connection attempt {attempt + 1}/{EMAIL_RETRY_ATTEMPTS} to {SMTP_SERVER}:{SMTP_PORT}")
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=EMAIL_SMTP_TIMEOUT)
            server.ehlo()
            server.starttls()
            server.ehlo()
            email_logger.debug(f"Authenticating as {SMTP_USER}")
            server.login(SMTP_USER, SMTP_PASSWORD)
            email_logger.debug("Sending message")
            server.sendmail(SMTP_USER, [to_email], msg.as_string())
            server.quit()
            email_logger.info(f"Successfully sent email to {to_email}")
            return
        except smtplib.SMTPRecipientsRefused as e:
            email_logger.error(f"Recipient refused by server: {e.recipients}")
            return
        except smtplib.SMTPAuthenticationError as e:
            email_logger.error(f"SMTP authentication failed. Check SMTP_USER/SMTP_PASSWORD in .env: {e}")
            return
        except smtplib.SMTPException as e:
            last_error = e
            email_logger.warning(f"SMTP error on attempt {attempt + 1}: {type(e).__name__}: {e}")
        except OSError as e:
            last_error = e
            email_logger.warning(f"Network/socket error on attempt {attempt + 1}: {type(e).__name__}: {e}")
        except Exception as e:
            last_error = e
            email_logger.warning(f"Unexpected error on attempt {attempt + 1}: {type(e).__name__}: {e}")

        if attempt < EMAIL_RETRY_ATTEMPTS - 1:
            wait = EMAIL_RETRY_BACKOFF_BASE ** attempt
            email_logger.debug(f"Retrying in {wait}s")
            time.sleep(wait)

    email_logger.error(f"All {EMAIL_RETRY_ATTEMPTS} attempts failed to send to {to_email}. Last error: {last_error}")


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


def send_rejection_email(to_email: str, client_name: str, original_subject: str):
    """Sent when an email query is rejected because it doesn't look like a support query."""
    email_subject = f"Re: {original_subject} - Email Could Not Be Processed"
    body = f"""Dear {client_name},

We received your email with the subject "{original_subject}", but our automated system was unable to process it.

To help us route your request to the correct department, support emails must describe a service request or a technical issue.

Please send a new email containing one of the following key terms or details:
- Technical issues (e.g., "unable to login", "password reset", "error loading page", "not working", "bug")
- Service requests (e.g., "request permission", "need new account", "require software")
- Complaints or billing questions (e.g., "billing inquiry", "invoice issue", "dispute charge")

If you are a registered user, you can also log in to the QMS Hub dashboard to create a ticket directly.

Best regards,
QMS Support Team"""
    _send_email(to_email, email_subject, body)



