const userMeta = document.getElementById("userMeta");
const logoutBtn = document.getElementById("logoutBtn");

const apiBaseMeta = document.querySelector('meta[name="api-base-url"]');
const API_BASE_URL = apiBaseMeta?.content?.trim() || "";

async function ensureLoggedIn() {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
      method: "GET",
      credentials: "include",
    });
    if (!response.ok) {
      window.location.href = "./index.html";
      return;
    }

    const data = await response.json();
    userMeta.textContent = `ログイン中: ${data.user_id} (role: ${data.role})`;
  } catch (_error) {
    window.location.href = "./index.html";
  }
}

async function logout() {
  try {
    await fetch(`${API_BASE_URL}/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } finally {
    window.location.href = "./index.html";
  }
}

logoutBtn.addEventListener("click", async () => {
  await logout();
});

ensureLoggedIn();
