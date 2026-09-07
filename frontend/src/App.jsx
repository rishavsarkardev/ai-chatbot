import { useEffect, useRef, useState } from "react";

const API_URL = "http://localhost:8000";

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) setUser(JSON.parse(saved));
  }, []);

  function handleLogin(email, userId) {
    const userData = { email, userId };
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  }

  function handleLogout() {
    localStorage.removeItem("user");
    setUser(null);
  }

  return (
    <>
      <GlobalStyles />
      {!user ? (
        <AuthPage onLogin={handleLogin} />
      ) : (
        <ChatPage user={user} onLogout={handleLogout} />
      )}
    </>
  );
}

function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = mode === "login" ? "/login" : "/create_account";

    try {
      const res = await fetch(API_URL + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.user_id !== undefined && data.user_id !== null) {
        onLogin(email, data.user_id);
      } else {
        setError(data.message || "Something went wrong");
      }
    } catch (err) {
      setError("Could not reach server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2 className="auth-title">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h2>
        <p className="auth-subtitle">
          {mode === "login"
            ? "Log in to continue your chats"
            : "Just an email and password to get started"}
        </p>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </label>

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
        </button>

        <p className="switch-text">
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button type="button" className="link-btn" onClick={() => setMode("signup")}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" className="link-btn" onClick={() => setMode("login")}>
                Log in
              </button>
            </>
          )}
        </p>
      </form>
    </div>
  );
}

function ChatPage({ user, onLogout }) {
  const [chats, setChats] = useState(() => loadChats(user.userId));
  const [activeChatId, setActiveChatId] = useState(() => chats[0]?.id || 1);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const threadEndRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      if (!activeChatId) return; // Prevent fetching if there is no active chat
      setLoadingMessages(true);
      try {
        const res = await fetch(
          `${API_URL}/messages?user_id=${user.userId}&chat_id=${activeChatId}`
        );
        const data = await res.json();

        if (!cancelled) {
          if (Array.isArray(data) && data.length > 0) {
            setMessages(data);

            const loadedTitle = data[data.length - 1]?.chat_title || data[0]?.chat_title;
            if (loadedTitle && loadedTitle !== "New chat") {
              updateChatTitle(activeChatId, loadedTitle);
            }
          } else {
            setMessages([]);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }

    loadMessages();
    return () => {
      cancelled = true;
    };
  }, [user.userId, activeChatId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function updateChatTitle(id, newTitle) {
    setChats((prevChats) => {
      const updated = prevChats.map((c) =>
        c.id === id ? { ...c, title: newTitle } : c
      );
      saveChats(user.userId, updated);
      return updated;
    });
  }

  async function handleNewChat() {
    try {
      const res = await fetch(`${API_URL}/newchat?user_id=${user.userId}`, {
        method: "POST",
      });
      const data = await res.json();
      const newChatId = Number(decodeURIComponent(data.chat_id));

      const newChat = { id: newChatId, title: "New chat" };
      const nextChats = [newChat, ...chats];

      setChats(nextChats);
      saveChats(user.userId, nextChats);
      setActiveChatId(newChatId);
    } catch (err) {
      console.error(err);
    }
  }

  // 🌟 NEW DELETE FUNCTION 🌟
  async function handleDeleteChat(e, chatIdToDelete) {
    e.stopPropagation(); // Prevents clicking the chat button itself

    try {
      const res = await fetch(
        `${API_URL}/delete_chat?user_id=${user.userId}&chat_id=${chatIdToDelete}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        // Remove the chat from our local state
        const updatedChats = chats.filter((c) => c.id !== chatIdToDelete);
        
        if (updatedChats.length === 0) {
          // If user deleted their last chat, automatically create a new blank one
          const fallbackChat = { id: 1, title: "New chat" };
          setChats([fallbackChat]);
          saveChats(user.userId, [fallbackChat]);
          setActiveChatId(1);
          setMessages([]);
        } else {
          setChats(updatedChats);
          saveChats(user.userId, updatedChats);

          // If the active chat was deleted, switch to the next available chat
          if (activeChatId === chatIdToDelete) {
            setActiveChatId(updatedChats[0].id);
          }
        }
      }
    } catch (err) {
      console.error("Failed to delete chat", err);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!draft.trim() || sending) return;

    const content = draft;
    setDraft("");
    setSending(true);

    setMessages((prev) => [...prev, { role: "user", content }]);

    const currentChat = chats.find((c) => c.id === activeChatId);
    const chatTitleToSend = currentChat?.title || "New chat";

    try {
      const payload = {
        user_id: user.userId,
        chat_id: activeChatId,
        role: "user",
        content: content,
        chat_title: chatTitleToSend,
      };

      const res = await fetch(`${API_URL}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        const chronMessages = [...data].reverse();
        setMessages(chronMessages);

        const updatedTitle = data[0].chat_title; 
        if (updatedTitle && updatedTitle !== "New chat" && updatedTitle !== currentChat?.title) {
          updateChatTitle(activeChatId, updatedTitle);
        }
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  }

  const currentChat = chats.find((c) => c.id === activeChatId);

  return (
    <div className="chat-page">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="app-name">Rishav ka Bot</span>
          <button className="new-chat-btn" onClick={handleNewChat}>
            + New chat
          </button>
        </div>

        <div className="chat-list">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`chat-list-item-wrapper ${
                chat.id === activeChatId ? "active" : ""
              }`}
            >
              <button
                className="chat-list-item"
                onClick={() => setActiveChatId(chat.id)}
              >
                {chat.title}
              </button>
              <button
                className="delete-chat-btn"
                title="Delete Chat"
                onClick={(e) => handleDeleteChat(e, chat.id)}
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <span className="user-email" title={user.email}>
            {user.email}
          </span>
          <button className="link-btn" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="chat-main">
        <header className="chat-header">
          <h3>{currentChat ? currentChat.title : `Chat ${activeChatId}`}</h3>
        </header>

        <div className="thread">
          {loadingMessages && <p className="status-text">Loading messages...</p>}

          {!loadingMessages && messages.length === 0 && (
            <p className="status-text">No messages yet. Say hello!</p>
          )}

          {messages
            .filter((m) => m.role !== "system")
            .map((m, i) => (
              <div key={i} className={`bubble-row ${m.role === "user" ? "right" : "left"}`}>
                <div className={`bubble ${m.role === "user" ? "user" : "ai"}`}>
                  {m.content}
                </div>
              </div>
            ))}
          <div ref={threadEndRef} />
        </div>

        <form className="composer" onSubmit={handleSend}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message..."
          />
          <button type="submit" disabled={sending || !draft.trim()}>
            {sending ? "..." : "Send"}
          </button>
        </form>
      </main>
    </div>
  );
}

// --------------------------------------------------------
// LocalStorage helpers 
// --------------------------------------------------------
function loadChats(userId) {
  try {
    const raw = localStorage.getItem(`chats_${userId}`);
    const data = raw ? JSON.parse(raw) : [];

    if (data.length > 0) {
      if (typeof data[0] === "number") {
        return data.map((id) => ({ id, title: `Chat ${id}` }));
      }
      return data;
    }
    return [{ id: 1, title: "New chat" }];
  } catch {
    return [{ id: 1, title: "New chat" }];
  }
}

function saveChats(userId, chatsArray) {
  localStorage.setItem(`chats_${userId}`, JSON.stringify(chatsArray));
}

function GlobalStyles() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f7; }
      .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #6c63ff, #4834d4); }
      .auth-card { background: #fff; padding: 2.5rem; border-radius: 12px; width: 100%; max-width: 360px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15); }
      .auth-title { margin: 0 0 0.25rem; font-size: 1.5rem; color: #222; }
      .auth-subtitle { margin: 0 0 1.5rem; color: #777; font-size: 0.9rem; }
      .field { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem; font-size: 0.85rem; color: #444; }
      .field input { padding: 0.65rem 0.75rem; border-radius: 8px; border: 1px solid #ddd; font-size: 0.95rem; }
      .field input:focus { outline: none; border-color: #6c63ff; }
      .primary-btn { width: 100%; padding: 0.7rem; border: none; border-radius: 8px; background: #6c63ff; color: #fff; font-size: 0.95rem; font-weight: 600; cursor: pointer; margin-top: 0.25rem; }
      .primary-btn:hover:not(:disabled) { background: #574fd6; }
      .primary-btn:disabled { opacity: 0.6; cursor: default; }
      .switch-text { text-align: center; font-size: 0.85rem; color: #666; margin: 1rem 0 0; }
      .link-btn { background: none; border: none; color: #6c63ff; font-weight: 600; cursor: pointer; padding: 0; font-size: inherit; }
      .error-text { color: #e74c3c; font-size: 0.85rem; margin: -0.5rem 0 0.75rem; }
      .chat-page { display: flex; height: 100vh; }
      .sidebar { width: 260px; background: #202123; color: #ececec; display: flex; flex-direction: column; padding: 1rem; }
      .sidebar-header { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem; }
      .app-name { font-size: 1.1rem; font-weight: 700; }
      .new-chat-btn { background: #343541; color: #fff; border: 1px solid #4d4d4f; border-radius: 8px; padding: 0.6rem; cursor: pointer; font-size: 0.9rem; }
      .new-chat-btn:hover { background: #40414f; }
      .chat-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.25rem; padding-right: 0.25rem; }
      
      /* Updated CSS for the chat list items to support the delete button */
      .chat-list-item-wrapper { display: flex; align-items: center; border-radius: 6px; }
      .chat-list-item-wrapper:hover { background: #2b2c2f; }
      .chat-list-item-wrapper.active { background: #343541; }
      .chat-list-item { flex: 1; text-align: left; background: none; border: none; color: #cfcfcf; padding: 0.6rem 0.7rem; cursor: pointer; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .chat-list-item-wrapper.active .chat-list-item { color: #fff; }
      
      .delete-chat-btn { background: none; border: none; color: #888; font-size: 1.1rem; cursor: pointer; padding: 0 0.5rem; margin-right: 0.2rem; border-radius: 4px; display: none; }
      .chat-list-item-wrapper:hover .delete-chat-btn { display: block; }
      .delete-chat-btn:hover { color: #e74c3c; background: #40414f; }

      .sidebar-footer { border-top: 1px solid #3a3a3a; padding-top: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
      .user-email { font-size: 0.8rem; color: #aaa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sidebar-footer .link-btn { color: #cfcfcf; text-decoration: underline; text-align: left; }
      .chat-main { flex: 1; display: flex; flex-direction: column; background: #fff; }
      .chat-header { padding: 1rem 1.5rem; border-bottom: 1px solid #eee; }
      .chat-header h3 { margin: 0; font-size: 1rem; color: #333; }
      .thread { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; }
      .status-text { color: #999; font-size: 0.9rem; text-align: center; margin-top: 2rem; }
      .bubble-row { display: flex; margin-bottom: 0.6rem; }
      .bubble-row.right { justify-content: flex-end; }
      .bubble-row.left { justify-content: flex-start; }
      .bubble { max-width: 65%; padding: 0.6rem 0.9rem; border-radius: 14px; font-size: 0.95rem; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }
      .bubble.user { background: #6c63ff; color: #fff; border-bottom-right-radius: 4px; }
      .bubble.ai { background: #f0f0f0; color: #222; border-bottom-left-radius: 4px; }
      .composer { display: flex; gap: 0.6rem; padding: 1rem 1.5rem; border-top: 1px solid #eee; }
      .composer input { flex: 1; padding: 0.7rem 0.9rem; border-radius: 20px; border: 1px solid #ddd; font-size: 0.95rem; }
      .composer input:focus { outline: none; border-color: #6c63ff; }
      .composer button { padding: 0 1.25rem; border: none; border-radius: 20px; background: #6c63ff; color: #fff; font-weight: 600; cursor: pointer; }
      .composer button:hover:not(:disabled) { background: #574fd6; }
      .composer button:disabled { opacity: 0.6; cursor: default; }
    `}</style>
  );
}
