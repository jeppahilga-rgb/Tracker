window.ChartsModule = {
  renderStatusChart(containerId, quotations) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const counts = {};
    quotations.forEach(q => {
      counts[q.status] = (counts[q.status] || 0) + 1;
    });

    const rows = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => `
        <div class="chart-row">
          <div class="chart-label">${Utils.escapeHtml(label)}</div>
          <div class="chart-bar-wrap">
            <div class="chart-bar" style="width:${Math.max(value * 20, 20)}px;"></div>
          </div>
          <div class="chart-value">${value}</div>
        </div>
      `).join("");

    container.innerHTML = rows || "<p>No chart data.</p>";
  }
};