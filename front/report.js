const hasFaultCode = document.getElementById("hasFaultCode");
const faultCodeDetail = document.getElementById("faultCodeDetail");
const partsContainer = document.getElementById("partsContainer");
const addPartBtn = document.getElementById("addPartBtn");
const reportForm = document.getElementById("reportForm");

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

hasFaultCode.addEventListener("change", () => {
  faultCodeDetail.disabled = !hasFaultCode.checked;
  if (!hasFaultCode.checked) {
    faultCodeDetail.value = "";
  }
});

addPartBtn.addEventListener("click", () => {
  partsContainer.appendChild(createPartRow());
});

reportForm.addEventListener("submit", (event) => {
  event.preventDefault();
  alert("入力内容を受け付けました（保存処理は未実装）。");
});

partsContainer.appendChild(createPartRow());
