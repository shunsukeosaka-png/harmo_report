const userMeta = document.getElementById("userMeta");
const logoutBtn = document.getElementById("logoutBtn");
const reportEntryLink = document.getElementById("reportEntryLink");

const apiBaseMeta = document.querySelector('meta[name="api-base-url"]');
const API_BASE_URL = apiBaseMeta?.content?.trim() || "";
const REPORT_WRITE_ROLES = new Set([0, 1, 9]);
const ROLE_LABELS = {
  0: "作業者",
  1: "作業者",
  2: "閲覧者",
  9: "管理者",
};

function canWriteReports(role) {
  return REPORT_WRITE_ROLES.has(Number(role));
}

function getRoleLabel(role) {
  const normalizedRole = Number(role);
  return ROLE_LABELS[normalizedRole] ?? `不明(${role})`;
}

function setReportEntryEnabled(enabled) {
  if (enabled) {
    reportEntryLink.classList.remove("is-disabled");
    reportEntryLink.removeAttribute("aria-disabled");
    reportEntryLink.removeAttribute("tabindex");
    return;
  }
  reportEntryLink.classList.add("is-disabled");
  reportEntryLink.setAttribute("aria-disabled", "true");
  reportEntryLink.setAttribute("tabindex", "-1");
}

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
    userMeta.textContent = `ログイン中: ${data.user_id} (${getRoleLabel(data.role)})`;
    setReportEntryEnabled(canWriteReports(data.role));
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
