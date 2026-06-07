const albums = [
    {
        name: "Blue Banisters",
        artist: "Lana Del Rey",
        date: "2026-06-01",
        releaseDate: "2021-10-22",
        durationMs: 3699000,
        coverJpg: "../assets/images/albums/blue-banisters.jpg",
        coverAvifMd: "../assets/images/albums/blue-banisters-md.avif",
        coverAvifSm: "../assets/images/albums/blue-banisters-sm.avif",
        spotify: "https://open.spotify.com/album/2wwCc6fcyhp1tfY3J6Javr",
        blurb: "This week I decided to go with an album that is pretty special to me. I listened to a lot of different music in high school, but this album specifically stuck with me. I am really fond of music with strong vocals, and what this album lacks in lyricism and interesting storytelling, it definitely makes up for in the voice department. While some may call me performative, I really connected with Lana\u2019s music growing up, and this album is probably my favorite out of all of hers. From <i>Arcadia</i> to <i>Cherry Blossom</i>, this whole project has so many different comforting songs that are genuinely just <i>Beautiful</i> to me."
    },
    {
        name: "Hurry Up Tomorrow",
        artist: "The Weeknd",
        date: "2026-05-25",
        releaseDate: "2025-01-31",
        durationMs: 5064000,
        coverJpg: "../assets/images/albums/hurryuptomorrow.jpg",
        coverAvifMd: "../assets/images/albums/hurryuptomorrow-md.avif",
        coverAvifSm: "../assets/images/albums/hurryuptomorrow-sm.avif",
        spotify: "https://open.spotify.com/album/3OxfaVgvTxUTy7276t7SPU",
        blurb: "This week's pick is an album that suffers from some serious recency bias. It is no question one of The Weeknd's best (and longest) albums to date. While this album has some seriously amazing songs like Big Sleep and Hurry Up Tomorrow, it definitely has some stinkers too. I'd say this is definitely worth a listen, especially for those who still think The Weeknd is \"co-worker music.\""
    }
];

const listEl = document.getElementById("album-list");
const emptyEl = document.getElementById("empty-state");
let currentField = "date";
let currentDir = "desc";

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
                '<source srcset="' + esc(album.coverAvifSm) + '" media="(max-width: 640px)" type="image/avif">' +
                '<source srcset="' + esc(album.coverAvifMd) + '" type="image/avif">' +
                '<img alt="' + esc(album.name) + ' album cover" class="w-full h-full object-cover" src="' + esc(album.coverJpg) + '" width="320" height="320">' +
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
                '<p class="font-body-lg text-body-lg text-on-surface-variant leading-relaxed blurb-preview line-clamp-2">' + esc(album.blurb) + '</p>' +
                '<p class="font-body-lg text-body-lg text-on-surface-variant leading-relaxed blurb-full hidden">' + esc(album.blurb) + '</p>' +
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

function renderAlbums(sortedAlbums) {
    const loadingEl = document.getElementById("album-list-loading");
    if (loadingEl) loadingEl.remove();
    listEl.innerHTML = "";
    if (sortedAlbums.length === 0) {
        emptyEl.classList.remove("hidden");
        return;
    }
    emptyEl.classList.add("hidden");
    for (let i = 0; i < sortedAlbums.length; i++) {
        listEl.appendChild(buildAlbumCard(sortedAlbums[i]));
    }
    wireReadMoreButtons();
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

function sortAlbums() {
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
    renderAlbums(sorted);
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
        updateSortUI();
        sortAlbums();
    });
}

const dirToggle = document.getElementById("sort-dir-toggle");
if (dirToggle) {
    dirToggle.addEventListener("click", function () {
        currentDir = currentDir === "asc" ? "desc" : "asc";
        updateSortUI();
        sortAlbums();
    });
}

updateSortUI();
sortAlbums();
