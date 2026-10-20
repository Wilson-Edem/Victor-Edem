(function () {
    var saved = null;
    try { saved = localStorage.getItem("theme"); } catch (e) {}
    document.documentElement.classList.toggle("dark", saved !== "light");
    document.addEventListener("click", function (e) {
        if (!e.target.closest(".theme-toggle")) return;
        var dark = document.documentElement.classList.toggle("dark");
        try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch (err) {}
    });
})();
