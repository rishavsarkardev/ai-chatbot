import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from langchain.messages import HumanMessage, AIMessage, SystemMessage
from api.ai import text_model

def generate_response(user_input, chat_history):
    content = []
    content.extend(chat_history)
    content.append(HumanMessage(content=user_input))
    return text_model.invoke(content).content


# print(generate_response("Hello, how are you?", []))

