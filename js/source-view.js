(function () {
  var FILES = {
    demoport: { title: "Interactive Demo Portfolio: source code", path: "source/demoport.html" },
    dashboard: { title: "Analytics Dashboard: source code", path: "source/dashboard.html" }
  };
  document.addEventListener("DOMContentLoaded", function () {
    var key = new URLSearchParams(window.location.search).get("file");
    var title = document.getElementById("source-title");
    var status = document.getElementById("source-status");
    var code = document.getElementById("source-code");
    var entry = FILES[key];
    if (!entry) {
      title.textContent = "Source not found";
      status.textContent = "Choose a project from the portfolio to view its source code.";
      return;
    }
    title.textContent = entry.title;
    fetch(entry.path).then(function (res) {
      if (!res.ok) throw new Error("missing");
      return res.text();
    }).then(function (text) {
      code.textContent = text;
      status.textContent = "Read-only view. Copy any part you need.";
    }).catch(function () {
      status.textContent = "The source file could not be loaded.";
    });
  });
})();
