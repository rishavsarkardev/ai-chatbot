from langchain.chat_models import init_chat_model
from dotenv import load_dotenv
import os

load_dotenv("../.env")

OPENAI_API_KEY=os.getenv("OPENAI_API_KEY")

text_model = init_chat_model("gpt-6-astra", api_key=OPENAI_API_KEY)

