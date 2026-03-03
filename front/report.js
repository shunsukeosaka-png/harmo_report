const hasFaultCode = document.getElementById("hasFaultCode");
const faultCodeDetail = document.getElementById("faultCodeDetail");
const partsContainer = document.getElementById("partsContainer");
const addPartBtn = document.getElementById("addPartBtn");
const reportForm = document.getElementById("reportForm");
const logoutBtn = document.getElementById("logoutBtn");

const apiBaseMeta = document.querySelector('meta[name="api-base-url"]');
const API_BASE_URL = apiBaseMeta?.content?.trim() || "";

function createPartRow() {
  const row = document.createElement("div");
  row.className = "part-row";

  row.innerHTML = `
    <div>
      <label>部品番号</label>
      <input type="text" name="partNumber[]" placeholder="部品番号">
    </div>
    <div>
      <label>個数</label>
      <input type="number" name="partQuantity[]" min="1" step="1" placeholder="1">
    </div>
    <button type="button" class="remove-part">削除</button>
  `;

  const removeButton = row.querySelector(".remove-part");
  removeButton.addEventListener("click", () => {
    row.remove();
  });

  return row;
}

async function ensureLoggedIn() {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
      method: "GET",
      credentials: "include",
    });
    if (!response.ok) {
      window.location.href = "./index.html";
    }
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

hasFaultCode.addEventListener("change", () => {
  faultCodeDetail.disabled = !hasFaultCode.checked;
  if (!hasFaultCode.checked) {
    faultCodeDetail.value = "";
  }
});

addPartBtn.addEventListener("click", () => {
  partsContainer.appendChild(createPartRow());
});

logoutBtn.addEventListener("click", async () => {
  await logout();
});

reportForm.addEventListener("submit", (event) => {
  event.preventDefault();
  alert("入力内容を受け付けました（保存処理は未実装）。");
});

partsContainer.appendChild(createPartRow());
ensureLoggedIn();
