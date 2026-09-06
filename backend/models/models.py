from pydantic import BaseModel

class User(BaseModel):
    email: str
    password: str

class Message(BaseModel):
    user_id: int
    content: str
    role: str
    chat_id: int
    