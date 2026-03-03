const hasFaultInfo = document.getElementById("hasFaultInfo");
const faultInfoDetail = document.getElementById("faultInfoDetail");
const partsContainer = document.getElementById("partsContainer");
const addPartBtn = document.getElementById("addPartBtn");
const reportForm = document.getElementById("reportForm");
const logoutBtn = document.getElementById("logoutBtn");
const submitBtn = document.getElementById("submitBtn");
const message = document.getElementById("message");

const apiBaseMeta = document.querySelector('meta[name="api-base-url"]');
const API_BASE_URL = apiBaseMeta?.content?.trim() || "";

function setMessage(text, color = "#b00020") {
  message.style.color = color;
  message.textContent = text;
}

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

function resetPartRows() {
  partsContainer.innerHTML = "";
  partsContainer.appendChild(createPartRow());
}

function collectParts() {
  const rows = Array.from(partsContainer.querySelectorAll(".part-row"));
  const parts = [];

  for (const row of rows) {
    const partNumberInput = row.querySelector('input[name="partNumber[]"]');
    const quantityInput = row.querySelector('input[name="partQuantity[]"]');

    const partNumber = (partNumberInput?.value ?? "").trim();
    const quantityRaw = (quantityInput?.value ?? "").trim();

    if (!partNumber && !quantityRaw) {
      continue;
    }
    if (!partNumber) {
      throw new Error("部品番号を入力してください。");
    }

    const quantity = Number(quantityRaw);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("部品の個数は1以上の整数で入力してください。");
    }

    parts.push({ part_number: partNumber, quantity });
  }

  return parts;
}

function buildPayload() {
  const customerName = document.getElementById("customerName").value.trim();
  const address = document.getElementById("address").value.trim();
  const serialNumber = document.getElementById("serialNumber").value.trim();
  const workType = document.getElementById("workType").value.trim();
  const workHoursRaw = document.getElementById("workHours").value;
  const workHours = Number(workHoursRaw);
  const hasFault = hasFaultInfo.checked;
  const faultInfo = hasFault ? faultInfoDetail.value.trim() : null;

  if (!customerName) throw new Error("顧客名を入力してください。");
  if (!address) throw new Error("住所を入力してください。");
  if (!serialNumber) throw new Error("シリアル番号を入力してください。");
  if (!workType) throw new Error("作業内容を選択してください。");
  if (!Number.isFinite(workHours) || workHours < 0) {
    throw new Error("作業時間は0以上の数値で入力してください。");
  }
  if (hasFault && !faultInfo) {
    throw new Error("フォルト情報ありの場合は内容を入力してください。");
  }

  const parts = collectParts();
  return {
    customer_name: customerName,
    address,
    serial_number: serialNumber,
    work_type: workType,
    has_fault_info: hasFault,
    fault_info: hasFault ? faultInfo : null,
    work_hours: workHours,
    parts,
  };
}

function resetForm() {
  reportForm.reset();
  hasFaultInfo.checked = false;
  faultInfoDetail.value = "";
  faultInfoDetail.disabled = true;
  faultInfoDetail.required = false;
  resetPartRows();
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

hasFaultInfo.addEventListener("change", () => {
  faultInfoDetail.disabled = !hasFaultInfo.checked;
  faultInfoDetail.required = hasFaultInfo.checked;
  if (!hasFaultInfo.checked) {
    faultInfoDetail.value = "";
  }
});

addPartBtn.addEventListener("click", () => {
  partsContainer.appendChild(createPartRow());
});

logoutBtn.addEventListener("click", async () => {
  await logout();
});

reportForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  let payload;
  try {
    payload = buildPayload();
  } catch (e) {
    setMessage(e.message);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "保存中...";
  setMessage("保存中...", "#1e3a4f");

  try {
    const response = await fetch(`${API_BASE_URL}/v1/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      window.location.href = "./index.html";
      return;
    }

    if (!response.ok) {
      let errorMessage = "保存に失敗しました。";
      try {
        const body = await response.json();
        if (body?.error) {
          errorMessage = body.error;
        }
      } catch (_parseError) {
        // Keep default message.
      }
      setMessage(errorMessage);
      return;
    }

    const saved = await response.json();
    setMessage(`保存しました（ID: ${saved.id}）`, "#0a7a22");
    resetForm();
  } catch (_error) {
    setMessage("保存APIに接続できません。");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "保存";
  }
});

resetPartRows();
ensureLoggedIn();
