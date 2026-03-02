const form = document.getElementById("loginForm");
const message = document.getElementById("message");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const userId = document.getElementById("userId").value.trim();
  const password = document.getElementById("password").value;

  if (!userId || !password) {
    message.style.color = "#b00020";
    message.textContent = "IDとPasswordを入力してください。";
    return;
  }

  if (userId === "9999" && password === "9999") {
    window.location.href = "./report.html";
    return;
  }

  message.style.color = "#b00020";
  message.textContent = "IDまたはPasswordが違います。";
});
