"""
Gmail Service — reads emails from inbox and sends replies.

HOW IT WORKS:
  - On first run, opening http://localhost:8000/api/gmail/authorize in a browser
    will trigger the Google consent screen.  Accept it once.
  - token.json is saved and reused for all future requests.
  - When an email arrives at your Gmail inbox, GET /api/gmail/sync
    will pull it in and create a helpdesk ticket automatically.
  - When an agent replies in the dashboard, POST /tickets/{id}/messages
    with send_email=True will use this service to reply directly to the
    original email thread.
"""

import os
import base64
import re
from email.mime.text import MIMEText
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]
CLIENT_SECRETS_FILE = os.path.join(os.path.dirname(__file__), "client_secret.json")
TOKEN_FILE = os.path.join(os.path.dirname(__file__), "token.json")
REDIRECT_URI = "http://localhost:8000/api/gmail/callback"


def get_gmail_service():
    """Return an authenticated Gmail API client. Raises if token.json missing."""
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            _save_token(creds)
        else:
            raise RuntimeError("Gmail not authorised. Open http://localhost:8000/api/gmail/authorize in a browser first.")
    return build("gmail", "v1", credentials=creds)


def get_authorization_url() -> str:
    """Step 1 of OAuth flow — return the URL to redirect the browser to."""
    flow = Flow.from_client_secrets_file(CLIENT_SECRETS_FILE, scopes=SCOPES, redirect_uri=REDIRECT_URI)
    auth_url, _ = flow.authorization_url(access_type="offline", prompt="consent")
    return auth_url


def exchange_code_for_token(code: str) -> None:
    """Step 2 of OAuth flow — exchange code for token and save it."""
    flow = Flow.from_client_secrets_file(CLIENT_SECRETS_FILE, scopes=SCOPES, redirect_uri=REDIRECT_URI)
    flow.fetch_token(code=code)
    _save_token(flow.credentials)


def _save_token(creds: Credentials):
    with open(TOKEN_FILE, "w") as f:
        f.write(creds.to_json())


def _decode_body(payload: dict) -> str:
    """Recursively extract plain-text body from a Gmail message payload."""
    body = ""
    if payload.get("mimeType") == "text/plain":
        data = payload.get("body", {}).get("data", "")
        if data:
            body = base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="ignore")
    elif "parts" in payload:
        for part in payload["parts"]:
            body += _decode_body(part)
    return body


def _strip_quoted_reply(text: str) -> str:
    """Remove quoted previous emails from a reply body."""
    marker = re.search(r"\r?\n>|\r?\nOn .* wrote:", text)
    if marker:
        text = text[:marker.start()]
    return text.strip()


def fetch_new_emails(max_results: int = 20) -> list[dict]:
    """
    Fetch unread emails from the inbox.
    Returns a list of dicts:
      { gmail_message_id, gmail_thread_id, from_name, from_email, subject, body, date }
    """
    service = get_gmail_service()

    result = service.users().messages().list(
        userId="me",
        labelIds=["INBOX", "UNREAD"],
        maxResults=max_results,
    ).execute()

    messages = result.get("messages", [])
    emails = []

    for m in messages:
        msg = service.users().messages().get(userId="me", id=m["id"], format="full").execute()
        headers = {h["name"].lower(): h["value"] for h in msg["payload"].get("headers", [])}
        from_raw = headers.get("from", "")
        # Parse "Name <email@example.com>" or just "email@example.com"
        from_match = re.match(r"(.*?)\s*<(.+?)>", from_raw)
        if from_match:
            from_name = from_match.group(1).strip().strip('"')
            from_email = from_match.group(2)
        else:
            from_name = from_raw
            from_email = from_raw

        body = _strip_quoted_reply(_decode_body(msg["payload"]))

        emails.append({
            "gmail_message_id": m["id"],
            "gmail_thread_id": msg["threadId"],
            "from_name": from_name,
            "from_email": from_email,
            "subject": headers.get("subject", "(no subject)"),
            "body": body,
            "date": headers.get("date", ""),
        })

    return emails


def send_email_reply(
    to_email: str,
    subject: str,
    body: str,
    thread_id: str = None,
) -> None:
    """Send an email (reply) via Gmail API."""
    service = get_gmail_service()

    msg = MIMEText(body)
    msg["to"] = to_email
    msg["subject"] = subject

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    send_body = {"raw": raw}
    if thread_id:
        send_body["threadId"] = thread_id

    service.users().messages().send(userId="me", body=send_body).execute()


def mark_as_read(gmail_message_id: str) -> None:
    """Remove UNREAD label after we've ingested the message."""
    service = get_gmail_service()
    service.users().messages().modify(
        userId="me",
        id=gmail_message_id,
        body={"removeLabelIds": ["UNREAD"]},
    ).execute()
