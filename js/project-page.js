(function () {
    function esc(v) {
        return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }
    function tagList(items) {
        return items.map(function (t) {
            return '<span class="text-xs px-3 py-1 rounded-full glass text-slate-600 dark:text-gray-300">' + esc(t) + "</span>";
        }).join(" ");
    }
    function render(p) {
        document.title = p.name + " | Victor Edem";
        var meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute("content", p.tagline + " " + p.summary);

        var media = p.video
            ? '<video controls playsinline preload="metadata" class="w-full h-full object-cover" src="' + esc(p.video) + '"></video>'
            : '<img src="assets/projects/' + esc(p.id) + '-cover.jpg" alt="' + esc(p.name) + '" class="w-full h-full object-cover" onerror="this.parentElement.remove()">';
        var features = p.features.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("");
        var results = p.results.length
            ? '<ul class="space-y-2 text-slate-600 dark:text-gray-300">' + p.results.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul>"
            : '<p class="text-slate-500 dark:text-gray-500">Results will be added soon.</p>';
        var btn = "px-5 sm:px-6 py-3 rounded-xl font-bold glass text-slate-900 dark:text-white hover:opacity-90 text-center";
        var actions = "";
        if (p.live) actions += '<a href="' + esc(p.live) + '" target="_blank" rel="noopener" class="px-5 sm:px-6 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 text-center">' + esc(p.liveLabel || "Live demo") + "</a>";
        if (p.repo) actions += '<a href="' + esc(p.repo) + '" target="_blank" rel="noopener" class="' + btn + '">' + esc(p.repoLabel || "GitHub") + "</a>";
        if (p.source) actions += '<a href="source.html?file=' + esc(p.source) + '" class="' + btn + '">View Source Code</a>';
        actions += '<button id="copy-link" type="button" class="' + btn + '">Copy link</button>';
        var status = p.status ? '<span class="text-sm font-semibold text-indigo-600 dark:text-indigo-400">' + esc(p.status) + (p.statusNote ? " · " + esc(p.statusNote) : "") + "</span>" : "";
        var date = p.date ? '<span class="text-sm text-slate-500 dark:text-gray-500">' + esc(p.date) + "</span>" : "";

        document.getElementById("project-root").innerHTML =
            '<section class="grid md:grid-cols-2 gap-8 md:gap-10 items-center mb-12 md:mb-14">' +
                '<div class="h-60 sm:h-72 md:h-96 relative rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-700 shadow-2xl">' + media + "</div>" +
                "<div>" +
                    '<div class="flex flex-wrap gap-2 mb-4">' + tagList(p.tags) + "</div>" +
                    '<h1 class="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-3">' + esc(p.name) + "</h1>" +
                    '<p class="text-base md:text-lg text-indigo-600 dark:text-indigo-400 font-semibold mb-4">' + esc(p.tagline) + "</p>" +
                    '<div class="flex flex-wrap items-center gap-3 mb-6">' + status + date + "</div>" +
                    '<div class="flex flex-col sm:flex-row flex-wrap gap-3">' + actions + "</div>" +
                "</div>" +
            "</section>" +
            '<section class="grid lg:grid-cols-3 gap-6 md:gap-8">' +
                '<div class="lg:col-span-2 space-y-6 md:space-y-8">' +
                    '<div class="glass rounded-3xl p-6 md:p-8"><h2 class="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3">Overview</h2><p class="text-slate-600 dark:text-gray-400 leading-relaxed">' + esc(p.summary) + "</p></div>" +
                    '<div class="glass rounded-3xl p-6 md:p-8"><h2 class="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3">My role</h2><p class="text-slate-600 dark:text-gray-400 leading-relaxed">' + esc(p.role) + "</p></div>" +
                    '<div class="glass rounded-3xl p-6 md:p-8"><h2 class="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3">Key features</h2><ul class="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-slate-600 dark:text-gray-300">' + features + "</ul></div>" +
                "</div>" +
                '<aside class="space-y-6 md:space-y-8">' +
                    '<div class="glass rounded-3xl p-6 md:p-8"><h2 class="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3">Tech used</h2><div class="flex flex-wrap gap-2">' + tagList(p.tech) + "</div></div>" +
                    '<div class="glass rounded-3xl p-6 md:p-8"><h2 class="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3">Results</h2>' + results + "</div>" +
                    '<a href="index.html#projects" class="block text-center px-6 py-3 rounded-xl font-bold glass text-slate-900 dark:text-white hover:opacity-90">See all projects</a>' +
                "</aside>" +
            "</section>";

        var copy = document.getElementById("copy-link");
        copy.addEventListener("click", function () {
            var url = window.location.href;
            var done = function () { copy.textContent = "Link copied"; };
            if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, done);
            else copy.textContent = url;
        });
        if (window.lucide) window.lucide.createIcons();
    }

    document.addEventListener("DOMContentLoaded", function () {
        var root = document.getElementById("project-root");
        var id = new URLSearchParams(window.location.search).get("id");
        var list = window.PROJECTS || [];
        var p = null;
        for (var i = 0; i < list.length; i++) if (list[i].id === id) p = list[i];
        if (!p) {
            root.innerHTML = '<div class="text-center py-24"><h1 class="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">Project not found</h1><p class="text-slate-600 dark:text-gray-400 mb-8">This link may be out of date.</p><a href="index.html#projects" class="inline-block px-6 py-3 rounded-xl font-bold bg-indigo-600 text-white">See all projects</a></div>';
            if (window.lucide) window.lucide.createIcons();
            return;
        }
        render(p);
    });
})();
