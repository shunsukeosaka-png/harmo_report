const form = document.getElementById("loginForm");
const message = document.getElementById("message");

const apiBaseMeta = document.querySelector('meta[name="api-base-url"]');
const API_BASE_URL = apiBaseMeta?.content?.trim() || "";

async function checkAlreadyLoggedIn() {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
      method: "GET",
      credentials: "include",
    });
    if (response.ok) {
      window.location.href = "./report.html";
    }
  } catch (_error) {
    // Ignore and keep login form.
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = document.getElementById("userId").value.trim();
  const password = document.getElementById("password").value;

  if (!id || !password) {
    message.style.color = "#b00020";
    message.textContent = "IDとPasswordを入力してください。";
    return;
  }

  message.style.color = "#1e3a4f";
  message.textContent = "ログイン中...";

  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ id, password }),
    });

    if (!response.ok) {
      message.style.color = "#b00020";
      message.textContent = "IDまたはPasswordが違います。";
      return;
    }

    window.location.href = "./report.html";
  } catch (_error) {
    message.style.color = "#b00020";
    message.textContent = "ログインAPIに接続できません。";
  }
});

checkAlreadyLoggedIn();
