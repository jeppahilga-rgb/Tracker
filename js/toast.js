window.Toast = {
  show(message, type = "info", duration = 2600) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);

    setTimeout(() => {
      el.remove();
    }, duration);
  }
};