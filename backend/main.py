import os
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import RedirectResponse, HTMLResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import timedelta
import uvicorn

from database import engine, Base, get_db
import models
import schemas
import auth

# Ensure tables exist
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Support Help Desk API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────
# STARTUP — seed demo accounts
# ─────────────────────────────────────────
@app.on_event("startup")
def seed_data():
    db = next(get_db())
    if not db.query(models.User).first():
        print("🌱 Seeding demo accounts...")
        super_admin = models.User(id="usr_1", name="Super Admin", email="super@helpdesk.com",
                                   password=auth.get_password_hash("super123"), role="SUPER_ADMIN")
        admin = models.User(id="usr_2", name="Daniel Admin", email="admin@helpdesk.com",
                             password=auth.get_password_hash("admin123"), role="ADMIN")
        agent = models.User(id="usr_3", name="Sarah Agent", email="agent@helpdesk.com",
                             password=auth.get_password_hash("agent123"), role="AGENT")
        db.add_all([super_admin, admin, agent])
        db.commit()

        import uuid
        t1 = models.Ticket(id="tkt_1", subject="Order missing a part", customer="Alex Johnson",
                            customer_email="alex@example.com", status="open", priority="urgent",
                            assigned_to_id="usr_3")
        m1 = models.Message(id="msg_1", ticket_id="tkt_1", sender="customer",
                             text="I am so frustrated! My order arrived today and a part is completely missing. What am I supposed to do now?")

        t2 = models.Ticket(id="tkt_2", subject="How to reset my password?", customer="John Smith",
                            status="open", priority="medium", assigned_to_id="usr_3")
        m2 = models.Message(id="msg_2", ticket_id="tkt_2", sender="customer",
                             text="I am confused about how to reset my password. Please help.")

        db.add_all([t1, t2, m1, m2])
        db.commit()
        print("✅ Demo accounts and tickets seeded.")
    db.close()


# ─────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────
@app.post("/api/auth/token", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Incorrect email or password",
                            headers={"WWW-Authenticate": "Bearer"})
    token = auth.create_access_token(
        data={"sub": user.id},
        expires_delta=timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": token, "token_type": "bearer",
            "role": user.role, "name": user.name, "id": user.id}


# ─────────────────────────────────────────
# USERS
# ─────────────────────────────────────────
@app.get("/api/users", response_model=List[schemas.UserResponse])
def get_users(role: str = None, db: Session = Depends(get_db),
              current_user: models.User = Depends(auth.get_current_user)):
    query = db.query(models.User)
    if role:
        query = query.filter(models.User.role == role)
    users = query.all()
    result = []
    for u in users:
        d = {c.key: getattr(u, c.key) for c in u.__table__.columns}
        # rename DB column isActive → is_active
        if "isActive" in d:
            d["is_active"] = d.pop("isActive")
        d["_count"] = {"assignedTickets": len(u.assigned_tickets)}
        result.append(d)
    return result


@app.post("/api/users", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db),
                current_user: models.User = Depends(auth.get_current_user)):
    import uuid
    hashed = auth.get_password_hash(user.password)
    new_user = models.User(id=str(uuid.uuid4()), name=user.name, email=user.email,
                            password=hashed, role=user.role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.patch("/api/users")
def update_user(body: dict, db: Session = Depends(get_db),
                current_user: models.User = Depends(auth.get_current_user)):
    user = db.query(models.User).filter(models.User.id == body["id"]).first()
    if not user:
        raise HTTPException(status_code=404)
    if "isActive" in body:
        user.is_active = body["isActive"]
    db.commit()
    return {"status": "ok"}


# ─────────────────────────────────────────
# TICKETS
# ─────────────────────────────────────────
@app.get("/api/tickets")
def get_tickets(db: Session = Depends(get_db),
                current_user: models.User = Depends(auth.get_current_user)):
    tickets = db.query(models.Ticket).all()
    result = []
    for t in tickets:
        msgs = [{"id": m.id, "sender": m.sender, "text": m.text,
                 "timestamp": m.timestamp.strftime("%I:%M %p") if m.timestamp else ""
                 } for m in t.messages]
        at = {"id": t.assigned_to.id, "name": t.assigned_to.name, "email": t.assigned_to.email} if t.assigned_to else None
        result.append({
            "id": t.id,
            "subject": t.subject,
            "customer": t.customer,
            "customerEmail": t.customer_email,
            "status": t.status,
            "priority": t.priority,
            "slaDeadline": t.sla_deadline.isoformat() if t.sla_deadline else None,
            "createdAt": t.created_at.isoformat() if t.created_at else None,
            "messages": msgs,
            "assignedTo": at,
        })
    return result


@app.post("/api/tickets")
def create_ticket(ticket: schemas.TicketCreate, db: Session = Depends(get_db),
                  current_user: models.User = Depends(auth.get_current_user)):
    import uuid
    from datetime import datetime, timedelta
    new_id = str(uuid.uuid4())

    # Set SLA deadline based on priority
    sla_hours = {"urgent": 1, "high": 4, "medium": 8, "low": 24}
    hours = sla_hours.get(ticket.priority, 8)
    deadline = datetime.utcnow() + timedelta(hours=hours)

    db_ticket = models.Ticket(
        id=new_id,
        subject=ticket.subject,
        customer=ticket.customer,
        customer_email=ticket.customer_email,
        priority=ticket.priority,
        status=ticket.status,
        assigned_to_id=ticket.assigned_to_id or None,
        created_by_id=current_user.id,
        sla_deadline=deadline,
    )
    if ticket.message:
        msg = models.Message(id=str(uuid.uuid4()), ticket_id=new_id, sender="customer", text=ticket.message)
        db_ticket.messages.append(msg)

    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    return {"id": db_ticket.id, "status": "created"}


@app.patch("/api/tickets/{ticket_id}")
def update_ticket(ticket_id: str, ticket: schemas.TicketUpdate, db: Session = Depends(get_db),
                  current_user: models.User = Depends(auth.get_current_user)):
    db_ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not db_ticket:
        raise HTTPException(status_code=404)
    if ticket.priority:
        db_ticket.priority = ticket.priority
    if ticket.status:
        db_ticket.status = ticket.status
    if ticket.assigned_to_id is not None:
        db_ticket.assigned_to_id = ticket.assigned_to_id or None
    db.commit()
    return {"status": "ok"}


@app.delete("/api/tickets/{ticket_id}")
def delete_ticket(ticket_id: str, db: Session = Depends(get_db),
                  current_user: models.User = Depends(auth.get_current_user)):
    t = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404)
    db.delete(t)
    db.commit()
    return {"status": "deleted"}


# ─────────────────────────────────────────
# MESSAGES
# ─────────────────────────────────────────
@app.post("/api/tickets/{ticket_id}/messages")
def create_message(ticket_id: str, msg: schemas.MessageCreate, db: Session = Depends(get_db),
                   current_user: models.User = Depends(auth.get_current_user)):
    import uuid
    t = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404)

    new_msg = models.Message(id=str(uuid.uuid4()), ticket_id=ticket_id,
                              sender=msg.sender, text=msg.text)
    db.add(new_msg)
    db.commit()

    # Send reply via Gmail if ticket has a customer email and thread
    if t.customer_email and t.gmail_thread_id and msg.sender == "agent":
        try:
            from gmail_service import send_email_reply
            send_email_reply(
                to_email=t.customer_email,
                subject=f"Re: {t.subject}",
                body=msg.text,
                thread_id=t.gmail_thread_id
            )
        except Exception as e:
            print(f"⚠ Gmail send failed: {e}")  # Don't break the endpoint

    return {"status": "ok"}


# ─────────────────────────────────────────
# AI DRAFT
# ─────────────────────────────────────────
@app.post("/api/drafts/generate")
def generate_draft(request: dict, current_user: models.User = Depends(auth.get_current_user)):
    message = request.get("message", "").lower()
    subject = request.get("subject", "")
    history = request.get("history", "")

    # Try Gemini first
    try:
        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            prompt = f"""You are a professional customer support agent. 
Analyze this conversation and generate a helpful, empathetic email reply.

Ticket subject: {subject}
Conversation:
{history}

Please respond with ONLY a JSON object (no markdown) in this format:
{{
  "sentiment": "Frustrated|Confused|Pleased|Neutral",
  "draft": "the full reply text here",
  "suggestedActions": ["action1", "action2"]
}}"""
            resp = model.generate_content(prompt)
            import json
            text = resp.text.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            return json.loads(text.strip())
    except Exception as e:
        print(f"Gemini error: {e}")

    # Fallback mock
    if "frustrat" in message or "angry" in message or "broken" in message or "missing" in message:
        return {"sentiment": "Frustrated",
                "draft": f"Dear [Customer Name],\n\nI sincerely apologize for the trouble you've experienced with your [Order/Issue]. I completely understand your frustration and I'm making this my top priority right now.\n\nCould you please confirm your [Order Number] so I can look into this immediately?\n\nBest regards,\nSupport Team",
                "suggestedActions": ["Offer Refund", "Escalate to Manager", "Create Replacement Order"]}
    elif "how to" in message or "confused" in message or "help" in message:
        return {"sentiment": "Confused",
                "draft": f"Hi [Customer Name],\n\nThank you for reaching out! I'd be happy to walk you through this step by step.\n\nTo [resolve your issue], please follow these steps:\n1. [Step 1]\n2. [Step 2]\n\nPlease let me know if you need any further assistance.\n\nKind regards,\nSupport Team",
                "suggestedActions": ["Link FAQ Article", "Schedule Call", "Send Tutorial"]}
    else:
        return {"sentiment": "Neutral",
                "draft": f"Dear [Customer Name],\n\nThank you for contacting us. I've received your message and I'm looking into it right away.\n\nCould you provide your [Account ID / Order Number] so I can better assist you?\n\nKind regards,\nSupport Team",
                "suggestedActions": ["Request More Info", "Check Account"]}


# ─────────────────────────────────────────
# GMAIL INTEGRATION
# ─────────────────────────────────────────
@app.get("/api/gmail/authorize")
def gmail_authorize():
    """Visit this URL in a browser to authorize Gmail access (one-time setup)."""
    try:
        from gmail_service import get_authorization_url
        url = get_authorization_url()
        return RedirectResponse(url)
    except Exception as e:
        return HTMLResponse(f"<p>Error: {e}</p>")


@app.get("/api/gmail/callback")
def gmail_callback(code: str, request: Request):
    """OAuth2 callback — saves token.json and redirects back to dashboard."""
    try:
        from gmail_service import exchange_code_for_token
        exchange_code_for_token(code)
        return HTMLResponse("<html><body><h2>✅ Gmail authorised successfully!</h2><p>You can close this tab. The helpdesk can now read and send emails from your inbox.</p></body></html>")
    except Exception as e:
        return HTMLResponse(f"<p>❌ Error: {e}</p>")


@app.post("/api/gmail/sync")
def gmail_sync(db: Session = Depends(get_db),
               current_user: models.User = Depends(auth.get_current_user)):
    """
    Pull new unread emails from Gmail and create helpdesk tickets or
    add messages to existing threads.
    """
    try:
        from gmail_service import fetch_new_emails, mark_as_read
    except ImportError:
        raise HTTPException(status_code=503, detail="Gmail service not available")

    try:
        emails = fetch_new_emails(max_results=20)
    except RuntimeError as e:
        raise HTTPException(status_code=401, detail=str(e))

    import uuid
    from datetime import datetime, timedelta

    created = 0
    updated = 0

    for email in emails:
        # Check if thread already exists
        existing_ticket = db.query(models.Ticket).filter(
            models.Ticket.gmail_thread_id == email["gmail_thread_id"]
        ).first()

        if existing_ticket:
            # Just add the new message to the thread
            already_exists = db.query(models.Message).filter(
                models.Message.gmail_message_id == email["gmail_message_id"]
            ).first()
            if not already_exists and email["body"]:
                new_msg = models.Message(
                    id=str(uuid.uuid4()),
                    ticket_id=existing_ticket.id,
                    sender="customer",
                    text=email["body"],
                    gmail_message_id=email["gmail_message_id"],
                )
                db.add(new_msg)
                # Reopen if resolved
                if existing_ticket.status in ("resolved", "closed"):
                    existing_ticket.status = "open"
                db.commit()
                updated += 1
        else:
            # New thread — create a new ticket
            if email["body"]:
                priority = "medium"
                sla_hours = {"urgent": 1, "high": 4, "medium": 8, "low": 24}
                deadline = datetime.utcnow() + timedelta(hours=sla_hours[priority])

                ticket_id = str(uuid.uuid4())
                new_ticket = models.Ticket(
                    id=ticket_id,
                    subject=email["subject"],
                    customer=email["from_name"] or email["from_email"],
                    customer_email=email["from_email"],
                    status="open",
                    priority=priority,
                    gmail_thread_id=email["gmail_thread_id"],
                    sla_deadline=deadline,
                )
                first_msg = models.Message(
                    id=str(uuid.uuid4()),
                    ticket_id=ticket_id,
                    sender="customer",
                    text=email["body"],
                    gmail_message_id=email["gmail_message_id"],
                )
                new_ticket.messages.append(first_msg)
                db.add(new_ticket)
                db.commit()
                created += 1

        try:
            mark_as_read(email["gmail_message_id"])
        except Exception:
            pass

    return {"created": created, "updated": updated, "total_fetched": len(emails)}
