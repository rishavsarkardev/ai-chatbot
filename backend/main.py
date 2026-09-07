from fastapi import FastAPI, Depends
from prompt_handlers.text_handler import generate_response, generate_text_summary
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from database_session import session
import models.database_models as database_models
from models.database_models import Base
from database_session import engine
from models.models import User, Message
from langchain.messages import HumanMessage, AIMessage, SystemMessage
import logging

import urllib.parse

app = FastAPI()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uvicorn")

Base.metadata.create_all(bind=engine)
with engine.begin() as connection:
    connection.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS chat_id INTEGER"))
    connection.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS chat_title VARCHAR(255)"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = session()
    try:
        yield db
    finally:
        db.close()


@app.post("/login")
def login(user: User, db: Session = Depends(get_db)):
    db_user = db.query(database_models.User).filter(database_models.User.email == user.email).first()
    if not db_user or db_user.password != user.password:
        return {"message": "Invalid email or password"}
    
    return {"message": "Login successful", "user_id": db_user.id}


@app.post("/create_account")
def create_account(user: User, db: Session = Depends(get_db)):
    db_user = database_models.User(**user.model_dump())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    db.add(database_models.Message(user_id=db_user.id, content="You are a helpful assistant", role="system", chat_id=1, chat_title="New chat"))
    db.commit()
    return {"message": "Account created successfully", "user_id": db_user.id}


@app.post("/newchat")
def new_chat(user_id: int, db: Session = Depends(get_db)):
    last_chat_id = db.query(database_models.Message).filter(
        database_models.Message.user_id == user_id,
    ).order_by(database_models.Message.chat_id.desc()).first()

    if not last_chat_id or last_chat_id.chat_id is None: new_chat_id = 1
    else: new_chat_id = last_chat_id.chat_id + 1

    db.add(database_models.Message(user_id=user_id, content="You are a helpful assistant", role="system", chat_id=new_chat_id, chat_title=f"New chat"))
    db.commit()

    return {"message": "New chat created successfully", "chat_id": urllib.parse.quote(str(new_chat_id))}


# Fetches messages for a specific user and chat_id, decoding the parameters to ensure proper handling of special characters.
@app.get("/messages")
def get_messages(user_id: int, chat_id: int, db: Session = Depends(get_db)):
    messages = db.query(database_models.Message).filter(
        database_models.Message.user_id == user_id,
        database_models.Message.chat_id == chat_id
    ).all()

    return messages

@app.post("/")
def read_root(request: Message, db: Session = Depends(get_db)):
    messages = db.query(database_models.Message).filter(
        database_models.Message.user_id == request.user_id,
        database_models.Message.chat_id == request.chat_id
    ).all()[::-1]
     

    chat_history = []

    for msg in messages:
        if msg.role == "user":
            chat_history.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            chat_history.append(AIMessage(content=msg.content))
        elif msg.role == "system":
            chat_history.append(SystemMessage(content=msg.content))

    response = generate_response(request.content, chat_history)
    
    generated_summary =  "New chat"

    if len(chat_history) == 1:
        generated_summary = generate_text_summary(request.content)
    elif len(chat_history) > 1:
        generated_summary = messages[-1].chat_title

    # Save the user's message
    db.add(database_models.Message(
        user_id=request.user_id, 
        content=request.content, 
        role='user', 
        chat_id=request.chat_id,
        chat_title=generated_summary
    ))
    
    # Save the assistant's message
    db.add(database_models.Message(
        user_id=request.user_id, 
        role="assistant", 
        content=response, 
        chat_id=request.chat_id,
        chat_title=generated_summary
    ))
    
    db.commit()

    
    # Fetch and return the messages
    return db.query(database_models.Message).filter(
        database_models.Message.user_id == request.user_id, 
        database_models.Message.chat_id == request.chat_id
    ).all()[::-1]


@app.delete("/delete_chat")
def delete_chat(user_id: int, chat_id: int, db: Session = Depends(get_db)):
    db.query(database_models.Message).filter(
        database_models.Message.user_id == user_id,
        database_models.Message.chat_id == chat_id
    ).delete()
    db.commit()
    return {"message": "Chat deleted successfully"}