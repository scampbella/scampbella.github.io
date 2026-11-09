// Album archive: data lives in assets/data/albums.json (one entry per album),
// newest-first ordering is a sort, not an assumption about file order.
const listEl = document.getElementById("album-list");
const emptyEl = document.getElementById("empty-state");
const PAGE_SIZE = 10;
let albums = [];
let currentField = "date";
let currentDir = "desc";
let visibleCount = PAGE_SIZE;  // how many of the sorted list is currently rendered

function fmtDate(dateStr) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric"
    });
}

function fmtDuration(ms) {
    if (!ms) return "";
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return m + ":" + (s < 10 ? "0" : "") + s;
}

function esc(s) { return s.replace(/"/g, "&quot;"); }

function buildAlbumCard(album) {
    const article = document.createElement("article");
    article.className = "flex flex-col md:flex-row items-start p-8 gap-10 album-card border-2 border-on-surface/20 rounded-[32px]";

    article.innerHTML =
        '<div class="w-full md:w-[320px] aspect-square flex-shrink-0 rounded-2xl overflow-hidden bg-primary-container">' +
            '<picture class="w-full h-full block">' +
                '<img alt="' + esc(album.name) + ' album cover" class="w-full h-full object-cover" src="' + esc("../assets/images/albums/" + album.slug + "-md.avif") + '" width="320" height="320" loading="lazy">' +
            '</picture>' +
        '</div>' +
        '<div class="flex flex-col justify-center flex-grow min-w-0">' +
            '<div class="flex items-center gap-3 mb-4">' +
                '<time class="font-label-sm text-label-sm text-primary uppercase tracking-widest" datetime="' + album.date + '">' + fmtDate(album.date) + '</time>' +
                '<span class="w-1 h-1 rounded-full bg-outline-variant"></span>' +
                '<span class="font-label-sm text-label-sm text-on-surface-variant">Album of the Week</span>' +
            '</div>' +
            '<h2 class="font-headline-lg text-headline-lg md:text-[36px] text-on-surface mb-1 leading-tight">' + esc(album.name) + '</h2>' +
            '<p class="text-on-surface-variant font-body-md italic text-lg mb-2">by ' + esc(album.artist) + '</p>' +
            '<p class="font-label-sm text-on-surface-variant/70 mb-6">Released ' + fmtDate(album.releaseDate) + ' &middot; ' + fmtDuration(album.durationMs) + '</p>' +
            '<div class="blurb-container mb-6">' +
                '<p class="font-body-lg text-body-lg text-on-surface-variant leading-relaxed whitespace-pre-line blurb-preview line-clamp-2">' + album.blurb + '</p>' +
                '<p class="font-body-lg text-body-lg text-on-surface-variant leading-relaxed whitespace-pre-line blurb-full hidden">' + album.blurb + '</p>' +
                '<button class="read-more-btn flex items-center gap-1.5 font-label-sm text-label-sm text-primary hover:underline mt-2 transition-colors" aria-expanded="false">' +
                    '<span class="read-more-text">Read more</span>' +
                    '<span class="material-symbols-outlined text-[16px] read-more-icon">expand_more</span>' +
                '</button>' +
            '</div>' +
            '<div class="flex flex-wrap items-center gap-4">' +
                '<a class="flex items-center gap-2 font-label-md text-primary hover:underline group w-fit" href="' + esc(album.spotify) + '" target="_blank" rel="noopener noreferrer">' +
                    'Listen on Spotify' +
                    '<span class="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>' +
                '</a>' +
            '</div>' +
        '</div>';
    return article;
}

function sortedAlbums() {
    const sorted = albums.slice();
    const dir = currentDir === "asc" ? 1 : -1;
    if (currentField === "name") {
        sorted.sort((a, b) => dir * a.name.localeCompare(b.name));
    } else if (currentField === "date") {
        sorted.sort((a, b) => dir * (new Date(a.date) - new Date(b.date)));
    } else if (currentField === "releaseDate") {
        sorted.sort((a, b) => dir * (new Date(a.releaseDate) - new Date(b.releaseDate)));
    } else if (currentField === "durationMs") {
        sorted.sort((a, b) => dir * ((a.durationMs || 0) - (b.durationMs || 0)));
    } else if (currentField === "artist") {
        sorted.sort((a, b) => dir * a.artist.localeCompare(b.artist));
    }
    return sorted;
}

// Renders the first `visibleCount` entries of the current sort. Cards are
// replaced wholesale on sort changes; "Load more" only appends, so expanded
// blurbs on already-visible cards survive it.
function renderAlbums() {
    const sorted = sortedAlbums();
    if (sorted.length === 0) {
        emptyEl.classList.remove("hidden");
        listEl.innerHTML = "";
        updatePageUI(0, 0);
        return;
    }
    emptyEl.classList.add("hidden");
    listEl.innerHTML = "";
    const shown = Math.min(visibleCount, sorted.length);
    for (let i = 0; i < shown; i++) {
        listEl.appendChild(buildAlbumCard(sorted[i]));
    }
    wireReadMoreButtons();
    updatePageUI(shown, sorted.length);
}

function appendAlbums(from, to) {
    const sorted = sortedAlbums();
    for (let i = from; i < Math.min(to, sorted.length); i++) {
        listEl.appendChild(buildAlbumCard(sorted[i]));
    }
    wireReadMoreButtons();
    updatePageUI(Math.min(visibleCount, sorted.length), sorted.length);
}

function updatePageUI(shown, total) {
    const info = document.getElementById("page-info");
    if (info) info.textContent = "Showing " + shown + " of " + total;
    const loadMore = document.getElementById("load-more-btn");
    if (loadMore) {
        loadMore.classList.toggle("hidden", shown >= total);
        loadMore.classList.toggle("flex", shown < total);
    }
}

function wireReadMoreButtons() {
    const buttons = document.querySelectorAll(".read-more-btn");
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener("click", function () {
            const container = this.closest(".blurb-container");
            const preview = container.querySelector(".blurb-preview");
            const full = container.querySelector(".blurb-full");
            const text = this.querySelector(".read-more-text");
            const icon = this.querySelector(".read-more-icon");
            const expanded = this.getAttribute("aria-expanded") === "true";

            if (expanded) {
                preview.classList.remove("hidden");
                full.classList.add("hidden");
                text.textContent = "Read more";
                icon.textContent = "expand_more";
                this.setAttribute("aria-expanded", "false");
            } else {
                preview.classList.add("hidden");
                full.classList.remove("hidden");
                text.textContent = "Read less";
                icon.textContent = "expand_less";
                this.setAttribute("aria-expanded", "true");
            }
        });
    }
}

function updateSortUI() {
    const fieldBtns = document.querySelectorAll(".sort-field-btn");
    for (let i = 0; i < fieldBtns.length; i++) {
        const btn = fieldBtns[i];
        if (btn.dataset.field === currentField) {
            btn.classList.add("active-sort-field");
        } else {
            btn.classList.remove("active-sort-field");
        }
    }
    const icon = document.querySelector(".sort-dir-icon");
    if (icon) icon.textContent = currentDir === "asc" ? "arrow_upward" : "arrow_downward";
}

const fieldBtns = document.querySelectorAll(".sort-field-btn");
for (let i = 0; i < fieldBtns.length; i++) {
    fieldBtns[i].addEventListener("click", function () {
        if (currentField === this.dataset.field) {
            currentDir = currentDir === "asc" ? "desc" : "asc";
        } else {
            currentField = this.dataset.field;
        }
        visibleCount = PAGE_SIZE;
        updateSortUI();
        renderAlbums();
    });
}

const dirToggle = document.getElementById("sort-dir-toggle");
if (dirToggle) {
    dirToggle.addEventListener("click", function () {
        currentDir = currentDir === "asc" ? "desc" : "asc";
        visibleCount = PAGE_SIZE;
        updateSortUI();
        renderAlbums();
    });
}

const loadMoreBtn = document.getElementById("load-more-btn");
if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", function () {
        const from = visibleCount;
        visibleCount = Math.min(visibleCount + PAGE_SIZE, albums.length);
        appendAlbums(from, visibleCount);
    });
}

fetch("../assets/data/albums.json")
    .then(r => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
    })
    .then(data => {
        albums = data;
        updateSortUI();
        renderAlbums();
    })
    .catch(err => {
        const loadingEl = document.getElementById("album-list-loading");
        if (loadingEl) loadingEl.textContent = "Failed to load albums (" + err.message + ").";
    });
