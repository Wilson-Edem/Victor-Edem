(function () {
    var html = document.documentElement;
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var START_YEAR = 2021;
    
    function $(s, c) { return (c || document).querySelector(s); }
    function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
    function esc(v) {
        return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }
    function store(k, v) {
        try {
            if (v === undefined) return localStorage.getItem(k);
            localStorage.setItem(k, v);
        } catch (e) { return null; }
        return v;
    }
    function icons() { if (window.lucide) window.lucide.createIcons(); }

    function applyTheme(dark) {
        html.classList.toggle("dark", dark);
        $$(".theme-toggle").forEach(function (b) {
            b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
        });
    }
    var savedTheme = store("theme");
    applyTheme(savedTheme !== "light");

    document.addEventListener("click", function (e) {
        if (!e.target.closest(".theme-toggle")) return;
        var dark = !html.classList.contains("dark");
        applyTheme(dark);
        store("theme", dark ? "dark" : "light");
        store("theme-prompt-seen", "1");
        hidePrompt();
    });

    var prompt = $("#theme-prompt");
    function showPrompt() {
        if (!prompt) return;
        requestAnimationFrame(function () { requestAnimationFrame(function () { prompt.classList.add("show"); }); });
    }
    function hidePrompt() { if (prompt) prompt.classList.remove("show"); }
    if (prompt && !savedTheme && !store("theme-prompt-seen")) {
        setTimeout(function () {
            if (!store("theme") && !store("theme-prompt-seen")) showPrompt();
        }, 15000);
    }
    $("#tp-light").addEventListener("click", function () {
        applyTheme(false); store("theme", "light"); store("theme-prompt-seen", "1"); hidePrompt();
    });
    $("#tp-dark").addEventListener("click", function () {
        applyTheme(true); store("theme", "dark"); store("theme-prompt-seen", "1"); hidePrompt();
    });

    var menuBtn = $("#mobile-menu-btn"), menu = $("#mobile-menu");
    menuBtn.addEventListener("click", function () {
        var open = menu.classList.toggle("hidden") === false;
        menuBtn.setAttribute("aria-expanded", String(open));
    });
    $$("a", menu).forEach(function (a) {
        a.addEventListener("click", function () {
            menu.classList.add("hidden");
            menuBtn.setAttribute("aria-expanded", "false");
        });
    });

    var navbar = $("#navbar"), bar = $("#progress"), ticking = false;
    function onScroll() {
        navbar.classList.toggle("scrolled", window.scrollY > 10);
        var max = html.scrollHeight - window.innerHeight;
        bar.style.transform = "scaleX(" + (max > 0 ? Math.min(window.scrollY / max, 1) : 0) + ")";
        ticking = false;
    }
    window.addEventListener("scroll", function () {
        if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();

    var navLinks = $$("nav a.nav-link");
    if ("IntersectionObserver" in window) {
        var navIo = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) return;
                navLinks.forEach(function (a) {
                    a.setAttribute("aria-current", a.getAttribute("href") === "#" + en.target.id ? "true" : "false");
                });
            });
        }, { rootMargin: "-45% 0px -50% 0px" });
        ["projects", "about", "skills", "contact"].forEach(function (id) {
            var s = document.getElementById(id);
            if (s) navIo.observe(s);
        });
    }

    var typed = $("[data-typed]");
    if (typed) {
        var text = typed.getAttribute("data-typed");
        if (reduced) {
            typed.textContent = text;
        } else {
            var i = 0;
            typed.textContent = "";
            var tick = function () {
                typed.textContent = text.slice(0, ++i);
                if (i < text.length) setTimeout(tick, 100);
            };
            setTimeout(tick, 600);
        }
    }

    function runCounter(el) {
        var raw = el.getAttribute("data-count");
        var target = raw === "years" ? Math.max(0, new Date().getFullYear() - START_YEAR) : Number(raw);
        var suffix = el.getAttribute("data-suffix") || (raw === "years" ? "+" : "");
        if (reduced || !target) { el.textContent = target + suffix; return; }
        var start = null, dur = 1300;
        function frame(ts) {
            if (start === null) start = ts;
            var p = Math.min((ts - start) / dur, 1);
            el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
            if (p < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    function setDelays(scope) {
        $$(".reveal", scope || document).forEach(function (el) {
            if (el.style.getPropertyValue("--delay")) return;
            var parent = el.parentElement;
            var idx = parent ? Array.prototype.indexOf.call(parent.children, el) : 0;
            el.style.setProperty("--delay", Math.min(idx, 4) * 0.08 + "s");
        });
    }
    setDelays();

    if ("IntersectionObserver" in window && !reduced) {
        var rio = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) return;
                en.target.classList.add("in");
                rio.unobserve(en.target);
                $$("[data-count]", en.target).forEach(runCounter);
            });
        }, { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });
        $$(".reveal").forEach(function (el) { rio.observe(el); });

        var cio = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) { runCounter(en.target); cio.unobserve(en.target); }
            });
        }, { threshold: 0.6 });
        $$("[data-count]").forEach(function (el) { if (!el.closest(".reveal")) cio.observe(el); });
    } else {
        $$(".reveal").forEach(function (el) { el.classList.add("in"); });
        $$("[data-count]").forEach(runCounter);
    }

    var grid = $("#project-grid");
    var projects = window.PROJECTS || [];
    var ordered = projects.slice().sort(function (a, b) { return Number(b.featured) - Number(a.featured); });
    var activeFilter = "All";
    var expanded = false;

    function cardHtml(p, isFeatured) {
        var tags = p.tags.map(function (t) {
            return '<span class="text-xs px-3 py-1 rounded-full glass text-slate-600 dark:text-gray-300">' + esc(t) + "</span>";
        }).join("");
        var live = p.live ? '<a href="' + esc(p.live) + '" target="_blank" rel="noopener" class="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" aria-label="Live demo of ' + esc(p.name) + '"><i data-lucide="external-link" class="w-4 h-4"></i></a>' : "";
        var repo = p.repo ? '<a href="' + esc(p.repo) + '" target="_blank" rel="noopener" class="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" aria-label="Source of ' + esc(p.name) + '"><i data-lucide="github" class="w-4 h-4"></i></a>' : "";
        return (
            '<article class="project-card reveal glass rounded-3xl overflow-hidden cursor-pointer flex flex-col' + (isFeatured ? "" : " is-extra") + '" data-id="' + esc(p.id) + '" data-tags="' + esc(p.tags.join("|")) + '" data-featured="' + (isFeatured ? "1" : "0") + '" tabindex="0" role="button" aria-label="Open ' + esc(p.name) + '">' +
                '<div class="h-44 sm:h-48 relative overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-700">' +
                    '<img src="assets/projects/' + esc(p.id) + '-cover.jpg" alt="" loading="lazy" class="cover-img absolute inset-0 w-full h-full object-cover" onerror="this.remove()">' +
                    '<div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>' +
                    '<div class="absolute bottom-0 left-0 p-5 sm:p-6"><h4 class="text-xl sm:text-2xl font-bold text-white drop-shadow-md">' + esc(p.name) + "</h4></div>" +
                "</div>" +
                '<div class="p-6 sm:p-8 flex flex-col flex-1">' +
                    '<p class="text-slate-600 dark:text-gray-400 text-sm mb-5 leading-relaxed">' + esc(p.tagline) + "</p>" +
                    '<div class="flex flex-wrap gap-2 mb-6">' + tags + "</div>" +
                    '<div class="mt-auto flex items-center justify-between pt-5 border-t border-slate-200/70 dark:border-white/5">' +
                        '<span class="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">View project <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i></span>' +
                        '<div class="flex items-center gap-3">' + live + repo + "</div>" +
                    "</div>" +
                "</div>" +
            "</article>"
        );
    }

    function refreshVisibility() {
        $$(".project-card", grid).forEach(function (card) {
            var featured = card.getAttribute("data-featured") === "1";
            var tags = card.getAttribute("data-tags").split("|");
            var hiddenByCollapse = !expanded && !featured;
            var hiddenByFilter = activeFilter !== "All" && tags.indexOf(activeFilter) === -1;
            card.classList.toggle("is-collapsed", hiddenByCollapse);
            card.classList.toggle("is-filtered", hiddenByFilter);
        });
    }

    if (grid) {
        grid.innerHTML = ordered.map(function (p, idx) { return cardHtml(p, Boolean(p.featured)); }).join("");
        $$(".project-card", grid).forEach(function (el, idx) {
            el.style.setProperty("--delay", Math.min(idx % 3, 2) * 0.1 + "s");
        });
        refreshVisibility();
        icons();
        if ("IntersectionObserver" in window && !reduced) {
            var pio = new IntersectionObserver(function (entries) {
                entries.forEach(function (en) {
                    if (en.isIntersecting) { en.target.classList.add("in"); pio.unobserve(en.target); }
                });
            }, { threshold: 0.1 });
            $$(".project-card", grid).forEach(function (el) { pio.observe(el); });
        } else {
            $$(".project-card", grid).forEach(function (el) { el.classList.add("in"); });
        }
    }

    $$(".filter-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            activeFilter = btn.getAttribute("data-filter");
            $$(".filter-btn").forEach(function (b) { b.classList.toggle("active", b === btn); });
            refreshVisibility();
        });
    });

    var seeAll = $("#see-all");
    function renderSeeAll() {
        seeAll.innerHTML = '<span>' + (expanded ? "Show fewer projects" : "See all projects") + '</span> <i data-lucide="' + (expanded ? "chevron-up" : "chevron-down") + '" class="w-4 h-4"></i>';
        seeAll.setAttribute("aria-expanded", String(expanded));
        icons();
    }
    renderSeeAll();
    seeAll.addEventListener("click", function () {
        expanded = !expanded;
        renderSeeAll();
        refreshVisibility();
        if (expanded) {
            $$(".project-card.is-extra", grid).forEach(function (el, idx) {
                if (el.classList.contains("is-collapsed") || el.classList.contains("is-filtered")) return;
                el.classList.remove("in");
                setTimeout(function () { el.classList.add("in"); }, 60 + idx * 80);
            });
        } else {
            var section = document.getElementById("projects");
            if (section) section.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
        }
    });

    var dialog = $("#project-dialog"), dbody = $("#project-dialog-body");

    function findProject(id) {
        for (var i = 0; i < projects.length; i++) if (projects[i].id === id) return projects[i];
        return null;
    }

    function dialogHtml(p) {
        var media = p.video
            ? '<video controls playsinline preload="metadata" class="w-full h-full object-cover" src="' + esc(p.video) + '"></video>'
            : '<img src="assets/projects/' + esc(p.id) + '-cover.jpg" alt="' + esc(p.name) + '" class="w-full h-full object-cover" onerror="this.parentElement.remove()">';
        var features = p.features.map(function (f) {
            return '<li class="flex gap-2"><span class="text-indigo-500">&bull;</span><span>' + esc(f) + "</span></li>";
        }).join("");
        var results = p.results.length
            ? '<div class="mt-6"><h4 class="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-2">Results</h4><ul class="space-y-2 text-slate-600 dark:text-gray-300">' + p.results.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul></div>"
            : "";
        var tech = p.tech.map(function (t) {
            return '<span class="text-xs px-3 py-1 rounded-full glass text-slate-600 dark:text-gray-300">' + esc(t) + "</span>";
        }).join(" ");
        var status = p.status ? '<span class="text-sm font-semibold text-indigo-600 dark:text-indigo-400">' + esc(p.status) + (p.statusNote ? " · " + esc(p.statusNote) : "") + "</span>" : "";
        var btn = "px-5 sm:px-6 py-3 rounded-xl font-bold glass text-slate-900 dark:text-white hover:opacity-90 text-center";
        var actions = '<a href="project.html?id=' + esc(p.id) + '" class="px-5 sm:px-6 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 text-center">View project</a>';
        if (p.live) actions += '<a href="' + esc(p.live) + '" target="_blank" rel="noopener" class="' + btn + '">' + esc(p.liveLabel || "Live demo") + "</a>";
        if (p.repo) actions += '<a href="' + esc(p.repo) + '" target="_blank" rel="noopener" class="' + btn + '">' + esc(p.repoLabel || "GitHub") + "</a>";
        if (p.source) actions += '<a href="source.html?file=' + esc(p.source) + '" class="' + btn + '">View Source Code</a>';
        return (
            '<div class="h-52 sm:h-64 md:h-72 relative bg-gradient-to-br from-indigo-600 to-purple-700 overflow-hidden">' + media + "</div>" +
            '<div class="p-5 sm:p-6 md:p-8">' +
                '<h2 id="pd-title" class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-1">' + esc(p.name) + "</h2>" +
                '<p class="text-indigo-600 dark:text-indigo-400 font-semibold mb-4">' + esc(p.tagline) + "</p>" +
                '<div class="flex flex-wrap items-center gap-3 mb-4">' + status + (p.date ? '<span class="text-sm text-slate-500 dark:text-gray-500">' + esc(p.date) + "</span>" : "") + "</div>" +
                '<p class="text-slate-600 dark:text-gray-400 leading-relaxed mb-6">' + esc(p.summary) + "</p>" +
                '<h4 class="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-2">My role</h4>' +
                '<p class="text-slate-600 dark:text-gray-300 mb-6">' + esc(p.role) + "</p>" +
                '<h4 class="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-2">Key features</h4>' +
                '<ul class="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-slate-600 dark:text-gray-300 mb-2">' + features + "</ul>" +
                results +
                '<div class="mt-6"><h4 class="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-2">Tech used</h4><div class="flex flex-wrap gap-2">' + tech + "</div></div>" +
                '<div class="flex flex-col sm:flex-row flex-wrap gap-3 mt-8">' + actions + "</div>" +
            "</div>"
        );
    }

    function openProject(id) {
        var p = findProject(id);
        if (!p || !dialog) return;
        dbody.innerHTML = dialogHtml(p);
        dbody.scrollTop = 0;
        icons();
        if (!dialog.open) dialog.showModal();
        if (location.hash !== "#project-" + id) history.pushState({ project: id }, "", "#project-" + id);
    }

    if (grid && dialog) {
        grid.addEventListener("click", function (e) {
            if (e.target.closest("a")) return;
            var card = e.target.closest("[data-id]");
            if (card) openProject(card.getAttribute("data-id"));
        });
        grid.addEventListener("keydown", function (e) {
            var card = e.target.closest && e.target.closest("[data-id]");
            if (card && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                openProject(card.getAttribute("data-id"));
            }
        });
        $("#dialog-close").addEventListener("click", function () { dialog.close(); });
        dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
        dialog.addEventListener("close", function () {
            $$("video", dbody).forEach(function (v) { v.pause(); });
            if (location.hash.indexOf("#project-") === 0) history.back();
        });
        window.addEventListener("popstate", function () {
            if (location.hash.indexOf("#project-") !== 0 && dialog.open) dialog.close();
        });
    }

    var cta = $("#mobile-cta"), hero = $("#home"), contact = $("#contact");
    if (cta && hero && contact && "IntersectionObserver" in window) {
        var heroIn = true, contactIn = false;
        var syncCta = function () {
            var show = !heroIn && !contactIn;
            cta.classList.toggle("hidden", !show);
            cta.classList.toggle("show", show);
        };
        new IntersectionObserver(function (en) { heroIn = en[0].isIntersecting; syncCta(); }, { threshold: 0.2 }).observe(hero);
        new IntersectionObserver(function (en) { contactIn = en[0].isIntersecting; syncCta(); }, { threshold: 0.2 }).observe(contact);
    }

    var form = $("#contact-form");
    if (form) {
        var status = $("#form-status"), submit = $("#contact-submit");
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            status.textContent = "";
            status.className = "text-sm min-h-[1.25rem]";
            if (!form.checkValidity()) {
                status.textContent = "Please check the highlighted fields.";
                status.classList.add("text-red-500");
                form.reportValidity();
                return;
            }
            submit.disabled = true;
            submit.textContent = "Sending...";
            fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: $("#c-name").value,
                    email: $("#c-email").value,
                    message: $("#c-message").value,
                    company: $("#c-company").value
                })
            }).then(function (res) {
                return res.json().catch(function () { return { ok: false }; }).then(function (json) {
                    return { ok: res.ok && json.ok, error: json.error };
                });
            }).then(function (r) {
                if (r.ok) { window.location.href = "thank-you.html"; return; }
                status.textContent = r.error || "Something went wrong. Please try again.";
                status.classList.add("text-red-500");
            }).catch(function () {
                status.textContent = "Network error. Please try again.";
                status.classList.add("text-red-500");
            }).then(function () {
                submit.disabled = false;
                submit.textContent = "Send Message";
            });
        });
    }

    var year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());
    icons();
})();
