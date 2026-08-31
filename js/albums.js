const albums = [
    {
        name: "Thursday",
        artist: "The Weeknd",
        date: "2026-08-31",
        releaseDate: "2011-08-18",
        durationMs: 3019000,
        coverAvif: "../assets/images/albums/thursday-md.avif",
        spotify: "https://open.spotify.com/album/6F87lH0I09qlrzvCCKc7lz?si=222ab87da3e846c5",
        blurb: "I recently moved, and I have this wall of all of The Weeknd's albums. While putting it back up, it inspired me to pick Thursday as the album this week (I know I missed last week — I was moving). This album is pretty freaky and is for sure up there when it comes to sexual content, but I really like the instrumentation and beats here. This is back when he was still finding his sound, and I really like a lot of the funky, trap-style beats mixed in with some straight acoustic guitar as well. The abusive and tragic lyrics really help set a pretty unique and dark vibe for this album, and I really like it. I love a lot of the Trilogy songs, so it's hard for me to pick just two favorites like I normally do — instead, I picked four. My favorites here are Thursday, Rolling Stone, Heaven or Las Vegas, and Valerie (on the Trilogy version)."
    },
    {
        name: "Lost Weekend",
        artist: "Phoebe Bridgers",
        date: "2026-08-17",
        releaseDate: "2026-08-14",
        durationMs: 3162000,
        coverAvif: "../assets/images/albums/lost-weekend-md.avif",
        spotify: "https://open.spotify.com/album/2NSzwyYvQvdOQAoEjrlw9c?si=4daW4S1EQOqNw8sh9KMQGw",
        blurb: "Lost Weekend released this past Friday and after giving it a listen a couple times, I feel confident that we got another banger from Phoebe Bridgers. It kinda feels to me like Punisher with a new coat of paint. I really like the vibe, I don't have any definite favorites yet I don't think, but the songs I've been enjoying the most recently are Lost Boys and Kill Me."
    },
    {
        name: "Kiss Land",
        artist: "The Weeknd",
        date: "2026-08-10",
        releaseDate: "2013-09-10",
        durationMs: 3339000,
        coverAvif: "../assets/images/albums/kiss-land-md.avif",
        spotify: "https://open.spotify.com/album/2FgMWuwMeTgJArP2RF3upF?si=35L-ptxnQ02y2qSkw3dEyQ",
        blurb: "While it is The Weeknd's least streamed album, Kissland is in my top 3 for sure. This album has such a unique ambience that cannot be matched. I will admit there is a lot of weird lyrics and experimental bullshit going on here. Belong To The World is a complete mess but that's the kinda thing that gives this album its charm. Put on some good headphones and disappear for a while. Favorites here are Professional and The Town."
    },
    {
        name: "Blonde",
        artist: "Frank Ocean",
        date: "2026-08-04",
        releaseDate: "2016-08-20",
        durationMs: 3600000,
        coverAvif: "../assets/images/albums/blonde-md.avif",
        spotify: "https://open.spotify.com/album/3mH6qwIy9crq0I9YQbOuDf?si=qNjKN6miQSKC8mWuzOlCrw",
        blurb: "Blonde is my favorite album of all time. Just listen to it, I have nothing else to say. Favorite song is Self Control."
    },
    {
        name: "Sprained Ankle",
        artist: "Julien Baker",
        date: "2026-07-28",
        releaseDate: "2015-10-23",
        durationMs: 2013000,
        coverAvif: "../assets/images/albums/sprained-ankle-md.avif",
        spotify: "https://open.spotify.com/album/3DvUGOMZgAr6PaToI7Vwwl?si=b8c0qRXNSCKiBNDzg3aueg",
        blurb: "This is one of those albums I put on any time I really need to cry. Sprained Ankle is full of songs about religious trauma which really speak to me for some reason. I've never been religious myself but I find that this kinda music just sounds heavenly and I love that vibe. The little one will always be my favorite boygenius member (I'm not a larper guys, my sister is gay). Favorite songs here are Blacktop and Rejoice."
    },
    {
        name: "Oh yeah?",
        artist: "Steve Lacy",
        date: "2026-07-21",
        releaseDate: "2026-07-17",
        durationMs: 2394000,
        coverAvif: "../assets/images/albums/oh-yeah-md.avif",
        spotify: "https://open.spotify.com/album/289GZwycrFReuNB706obBx",
        blurb: "Oh yeah? released last friday and it did not dissapoint in my opinion. Steve Lacy is starting to become one of the goats and this is a great next step. Favorite songs are is it cool? and show you me."
    },
    {
        name: "Chip Chrome & The Mono-Tones",
        artist: "The Neighbourhood",
        date: "2026-07-13",
        releaseDate: "2020-09-25",
        durationMs: 1901000,
        coverAvif: "../assets/images/albums/chip-chrome-the-mono-tones-md.avif",
        spotify: "https://open.spotify.com/album/4uNgt1uQs6wZRm4giB3shX",
        blurb: "This is one of those albums where I didn't realize I loved it until I noticed I had every single song liked and in one of my playlists. I never would've considered myself a fan of The Neighbourhood until listening to this album in full. Genuinely some great stuff. My personal favorites on this album are Devil's Advocate and Tobacco Sunburst."
    },
    {
        name: "Ctrl",
        artist: "SZA",
        date: "2026-07-07",
        releaseDate: "2017-06-09",
        durationMs: 2941000,
        coverAvif: "../assets/images/albums/ctrl-md.avif",
        spotify: "https://open.spotify.com/album/76290XdXVF9rPzGdNRWdCh",
        blurb: "Ctrl is without a doubt one of the best R\&B albums of the last decade. SZA's vocals are angelic and a force to be reckoned with. This is genuinely a no-skip album in my opinion. My personal favorite songs are Prom and 20 Something."
    },
    {
        name: "Discovery",
        artist: "Daft Punk",
        date: "2026-06-30",
        releaseDate: "2001-03-12",
        durationMs: 3650000,
        coverAvif: "../assets/images/albums/discovery-md.avif",
        spotify: "https://open.spotify.com/album/2noRn2Aes5aoNVsU6iWThc",
        blurb: "I only recently discovered this album but every single song is masterfully produced. I am not really one for electro-pop or anything like that, but these songs are genre defining and simply interesting to listen to. My personal favorites are Veridis Quo and Face to Face."
    },
    {
        name: "My Dear Melancholy,",
        artist: "The Weeknd",
        date: "2026-06-16",
        releaseDate: "2018-03-30",
        durationMs: 1536000,
        coverAvif: "../assets/images/albums/my-dear-melancholy-md.avif",
        spotify: "https://open.spotify.com/album/4qZBW3f2Q8y0k1A84d4iAO?si=YQCIzAuVRGGLI60anQUztg",
        blurb: "My Dear Melancholy, is not only my favorite album by The Weeknd, but it\u2019s his favorite album of his as stated in an interview on a press tour for his recent movie (I do not recommend watching it, it\u2019s straight garbage). This album is just 25 minutes of straight heat. The production is also magnificent and it genuinely feels like a treat every time I get to listen to it on good speakers. My personal favorite songs on this album are Try Me and Privilege."
    },
    {
        name: "Nothing Happens",
        artist: "Wallows",
        date: "2026-06-11",
        releaseDate: "2019-03-22",
        durationMs: 2327000,
        coverAvif: "../assets/images/albums/nothing-happens-md.avif",
        spotify: "https://open.spotify.com/album/7eed9MBclFPjjjvotfR2e9",
        blurb: "Nothing Happens is the Wallows' debut album and man is it good. I honestly had not listened to the full thing until last week while studying for finals but I'm really glad I did. I have always loved their funky little boyband aesthetic, they kinda remind me of a more pop-ish boygenius but with actual boys. I don't really have any nuanced takes on this one or anything profound to say since I haven't listened to it very many times, but the whole album of the week thing is just for me to share my favorite music at the current time. My personal favorite song here is Do Not Wait. The topic to me seems kinda vague which is a plus for me because I like to imagine myself in all sorts of different scenarios when I listen to music. I also really love the melody in the back and the slow creeping up of the vocals."
    },
    {
        name: "Blue Banisters",
        artist: "Lana Del Rey",
        date: "2026-06-01",
        releaseDate: "2021-10-22",
        durationMs: 3699000,
        coverAvif: "../assets/images/albums/blue-banisters-md.avif",
        spotify: "https://open.spotify.com/album/2wwCc6fcyhp1tfY3J6Javr",
        blurb: "This week I decided to go with an album that is pretty special to me. I listened to a lot of different music in high school, but this album specifically stuck with me. I am really fond of music with strong vocals, and what this album lacks in lyricism and interesting storytelling, it definitely makes up for in the voice department. While some may call me performative, I really connected with Lana\u2019s music growing up, and this album is probably my favorite out of all of hers. From <i>Arcadia</i> to <i>Cherry Blossom</i>, this whole project has so many different comforting songs that are genuinely just <i>Beautiful</i> to me."
    },
    {
        name: "Hurry Up Tomorrow",
        artist: "The Weeknd",
        date: "2026-05-25",
        releaseDate: "2025-01-31",
        durationMs: 5064000,
        coverAvif: "../assets/images/albums/hurryuptomorrow-md.avif",
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
                '<img alt="' + esc(album.name) + ' album cover" class="w-full h-full object-cover" src="' + esc(album.coverAvif) + '" width="320" height="320">' +
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
