from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str = "AGENT"
    is_active: bool = True

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: str

    class Config:
        from_attributes = True

class MessageBase(BaseModel):
    sender: str
    text: str

class MessageCreate(MessageBase):
    pass

class MessageResponse(MessageBase):
    id: str
    timestamp: datetime
    
    class Config:
        from_attributes = True

class TicketBase(BaseModel):
    subject: str
    customer: str
    customer_email: Optional[str] = None
    priority: str = "medium"
    status: str = "open"
    assigned_to_id: Optional[str] = None

class TicketCreate(TicketBase):
    message: Optional[str] = None

class TicketUpdate(BaseModel):
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to_id: Optional[str] = None

class TicketResponse(TicketBase):
    id: str
    created_at: datetime
    sla_deadline: Optional[datetime] = None
    
    messages: List[MessageResponse] = []
    assigned_to: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    name: str
    id: str
