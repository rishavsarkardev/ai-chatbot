from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
import os
from dotenv import load_dotenv

load_dotenv("../.env")

DB_URL = os.getenv("DB_URL")

engine = create_engine(DB_URL)
session = sessionmaker(autoflush=False, autocommit=False, bind=engine)


