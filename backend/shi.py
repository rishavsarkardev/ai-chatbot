import streamlit as st


# 1. Add a title and some text
st.title("My First Streamlit App 🎈")
st.write("Welcome to this simple interactive dashboard!")

# 2. Add an interactive text input
name = st.text_input("What is your name?", "World")
st.write(f"Hello, **{name}**!")

# 3. Add an interactive slider
age = st.slider("How old are you?", min_value=0, max_value=100, value=25)
st.write(f"You are {age} years old.")