from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    password = Column(String, nullable=True)
    role = Column(String, default="AGENT")  # SUPER_ADMIN, ADMIN, AGENT, CLIENT
    is_active = Column("isActive", Boolean, default=True)
    is_approved = Column("isApproved", Boolean, default=False)
    department = Column(String, nullable=True)
    reason = Column(String, nullable=True)
    phone = Column(String, nullable=True)

    # relations
    created_tickets = relationship("Ticket", foreign_keys="[Ticket.created_by_id]", back_populates="created_by")
    assigned_tickets = relationship("Ticket", foreign_keys="[Ticket.assigned_to_id]", back_populates="assigned_to")


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(String, primary_key=True, index=True)
    subject = Column(String, nullable=False)
    customer = Column(String, nullable=False)
    customer_email = Column("customerEmail", String, nullable=True)

    status = Column(String, default="open")   # open, in-progress, resolved, closed
    priority = Column(String, default="medium")  # urgent, high, medium, low

    gmail_thread_id = Column("gmailThreadId", String, nullable=True, unique=True, index=True)
    sla_deadline = Column("slaDeadline", DateTime(timezone=True), nullable=True)

    created_at = Column("createdAt", DateTime(timezone=True), server_default=func.now())
    updated_at = Column("updatedAt", DateTime(timezone=True), onupdate=func.now())
    closed_at = Column("closedAt", DateTime(timezone=True), nullable=True)

    created_by_id = Column("createdById", String, ForeignKey("users.id"))
    assigned_to_id = Column("assignedToId", String, ForeignKey("users.id"), nullable=True)

    # relations
    created_by = relationship("User", foreign_keys=[created_by_id], back_populates="created_tickets")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], back_populates="assigned_tickets")
    messages = relationship("Message", back_populates="ticket", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, index=True)
    sender = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    gmail_message_id = Column("gmailMessageId", String, nullable=True, unique=True)

    ticket_id = Column("ticketId", String, ForeignKey("tickets.id"))

    # relations
    ticket = relationship("Ticket", back_populates="messages")
