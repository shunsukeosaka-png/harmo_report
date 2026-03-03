const logoutBtn = document.getElementById("logoutBtn");
const filterForm = document.getElementById("filterForm");
const clearBtn = document.getElementById("clearBtn");
const serialFilter = document.getElementById("serialFilter");
const workTypeFilter = document.getElementById("workTypeFilter");
const hasFaultFilter = document.getElementById("hasFaultFilter");
const createdByFilter = document.getElementById("createdByFilter");
const reportsTbody = document.getElementById("reportsTbody");
const pagination = document.getElementById("pagination");
const message = document.getElementById("message");

const apiBaseMeta = document.querySelector('meta[name="api-base-url"]');
const API_BASE_URL = apiBaseMeta?.content?.trim() || "";
const PAGE_SIZE = 50;

const state = {
  page: 1,
  totalPages: 0,
};

function setMessage(text, color = "#b00020") {
  message.style.color = color;
  message.textContent = text;
}

function createCell(value) {
  const td = document.createElement("td");
  td.textContent = value ?? "";
  return td;
}

function createPartsCell(parts) {
  const td = document.createElement("td");
  td.className = "parts-cell";

  if (!Array.isArray(parts) || parts.length === 0) {
    td.textContent = "-";
    return td;
  }

  const details = document.createElement("details");
  details.className = "parts-details";

  const summary = document.createElement("summary");
  summary.textContent = `${parts.length}件`;
  details.appendChild(summary);

  const ul = document.createElement("ul");
  for (const part of parts) {
    const li = document.createElement("li");
    li.textContent = `${part.part_number} x ${part.quantity}`;
    ul.appendChild(li);
  }
  details.appendChild(ul);

  td.appendChild(details);
  return td;
}

function renderRows(items) {
  reportsTbody.innerHTML = "";
  for (const item of items) {
    const tr = document.createElement("tr");

    tr.appendChild(createCell(item.customer_name));
    tr.appendChild(createCell(item.address));
    tr.appendChild(createCell(item.serial_number));
    tr.appendChild(createCell(item.work_type));
    tr.appendChild(createPartsCell(item.parts));

    const faultFlagTd = createCell(item.has_fault_info ? "あり" : "なし");
    faultFlagTd.className = item.has_fault_info ? "fault-yes" : "fault-no";
    tr.appendChild(faultFlagTd);

    tr.appendChild(createCell(item.fault_info ?? ""));
    tr.appendChild(createCell(item.work_hours));
    tr.appendChild(createCell(item.created_by));
    tr.appendChild(createCell(item.created_at));

    reportsTbody.appendChild(tr);
  }
}

function buildPageTokens(totalPages, currentPage) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let p = start; p <= end; p += 1) {
    pages.push(p);
  }
  pages.push(totalPages);

  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const tokens = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const value = sorted[i];
    if (i > 0 && value - sorted[i - 1] > 1) {
      tokens.push("...");
    }
    tokens.push(value);
  }
  return tokens;
}

function renderPagination() {
  pagination.innerHTML = "";
  if (state.totalPages <= 1) {
    return;
  }

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.textContent = "前へ";
  prevBtn.disabled = state.page <= 1;
  prevBtn.addEventListener("click", () => loadReports(state.page - 1));
  pagination.appendChild(prevBtn);

  const tokens = buildPageTokens(state.totalPages, state.page);
  for (const token of tokens) {
    if (token === "...") {
      const span = document.createElement("span");
      span.className = "dots";
      span.textContent = "...";
      pagination.appendChild(span);
      continue;
    }

    const pageBtn = document.createElement("button");
    pageBtn.type = "button";
    pageBtn.textContent = String(token);
    if (token === state.page) {
      pageBtn.classList.add("active");
      pageBtn.disabled = true;
    }
    pageBtn.addEventListener("click", () => loadReports(token));
    pagination.appendChild(pageBtn);
  }

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.textContent = "次へ";
  nextBtn.disabled = state.page >= state.totalPages;
  nextBtn.addEventListener("click", () => loadReports(state.page + 1));
  pagination.appendChild(nextBtn);
}

function buildSearchParams(page) {
  const params = new URLSearchParams();
  const serial = serialFilter.value.trim();
  const workType = workTypeFilter.value.trim();
  const hasFault = hasFaultFilter.value.trim();
  const createdBy = createdByFilter.value.trim();

  if (serial) params.set("serial", serial);
  if (workType) params.set("work_type", workType);
  if (hasFault) params.set("has_fault_info", hasFault);
  if (createdBy) params.set("created_by", createdBy);

  params.set("page", String(page));
  params.set("page_size", String(PAGE_SIZE));
  return params;
}

async function ensureLoggedIn() {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
      method: "GET",
      credentials: "include",
    });
    if (!response.ok) {
      window.location.href = "./index.html";
      return false;
    }
    return true;
  } catch (_error) {
    window.location.href = "./index.html";
    return false;
  }
}

async function loadReports(page = 1) {
  setMessage("読み込み中...", "#1e3a4f");

  try {
    const params = buildSearchParams(page);
    const response = await fetch(`${API_BASE_URL}/v1/reports?${params.toString()}`, {
      method: "GET",
      credentials: "include",
    });

    if (response.status === 401) {
      window.location.href = "./index.html";
      return;
    }

    if (!response.ok) {
      let errorMessage = "一覧取得に失敗しました。";
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

    const data = await response.json();
    const items = data.items ?? [];
    const pageInfo = data.pagination ?? {};
    state.page = pageInfo.page ?? page;
    state.totalPages = pageInfo.total_pages ?? 0;

    renderRows(items);
    renderPagination();

    if (items.length === 0) {
      setMessage("データがありません。", "#355268");
    } else {
      setMessage(`${pageInfo.total ?? items.length}件中 ${items.length}件を表示`, "#355268");
    }
  } catch (_error) {
    setMessage("一覧APIに接続できません。");
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

filterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await loadReports(1);
});

clearBtn.addEventListener("click", async () => {
  serialFilter.value = "";
  workTypeFilter.value = "";
  hasFaultFilter.value = "";
  createdByFilter.value = "";
  await loadReports(1);
});

logoutBtn.addEventListener("click", async () => {
  await logout();
});

(async () => {
  const ok = await ensureLoggedIn();
  if (!ok) return;
  await loadReports(1);
})();
