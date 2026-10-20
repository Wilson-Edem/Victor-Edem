(function () {
  var page = window.location.pathname + window.location.search;
  fetch("/api/visit?page=" + encodeURIComponent(page), {
    method: "GET",
    credentials: "same-origin",
    keepalive: true
  }).catch(function () {});
})();
