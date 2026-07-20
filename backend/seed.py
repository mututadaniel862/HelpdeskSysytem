from database import get_db, engine, Base
import models
import auth

print("Dropping tables and recreating cleanly...")
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

db = next(get_db())

print("Seeding demo accounts and tickets...")
super_admin = models.User(id="usr_1", name="Super Admin", email="super@helpdesk.com",
                            password=auth.get_password_hash("super123"), role="SUPER_ADMIN")
admin = models.User(id="usr_2", name="Daniel Admin", email="admin@helpdesk.com",
                        password=auth.get_password_hash("admin123"), role="ADMIN", is_active=True)
agent = models.User(id="usr_3", name="Sarah Agent", email="agent@helpdesk.com",
                        password=auth.get_password_hash("agent123"), role="AGENT", is_active=True)

db.add_all([super_admin, admin, agent])
db.commit()

from datetime import datetime, timedelta

def date_back(hours):
    return datetime.utcnow() - timedelta(hours=hours)
def date_forward(hours):
    return datetime.utcnow() + timedelta(hours=hours)

t1 = models.Ticket(id="tkt_1", subject="Order missing a part", customer="Alex Johnson",
                    customer_email="alex@example.com", status="open", priority="urgent",
                    assigned_to_id="usr_3", sla_deadline=date_forward(1), created_at=date_back(1))
m1 = models.Message(id="msg_1", ticket_id="tkt_1", sender="customer",
                        text="I am so frustrated! My order arrived today and a part is completely missing. What am I supposed to do now?", timestamp=date_back(1))

t2 = models.Ticket(id="tkt_2", subject="How to reset my password?", customer="John Smith",
                    status="open", priority="medium", assigned_to_id="usr_3", sla_deadline=date_forward(8), created_at=date_back(2))
m2 = models.Message(id="msg_2", ticket_id="tkt_2", sender="customer",
                        text="I am confused about how to reset my password. Please help.", timestamp=date_back(2))

t3 = models.Ticket(id="tkt_3", subject="Invoice for last month", customer="Acme Corp",
                    customer_email="billing@acme.com", status="resolved", priority="low",
                    assigned_to_id="usr_2", sla_deadline=date_back(48) if False else date_back(10), created_at=date_back(48))

m3 = models.Message(id="msg_3", ticket_id="tkt_3", sender="customer", text="Could you provide the invoice?", timestamp=date_back(48))
m4 = models.Message(id="msg_4", ticket_id="tkt_3", sender="agent", text="Here is your invoice. Let us know if you need anything else.", timestamp=date_back(42))

db.add_all([t1, t2, t3, m1, m2, m3, m4])
db.commit()

print("✅ Data successfully seeded into the Neon database!")
