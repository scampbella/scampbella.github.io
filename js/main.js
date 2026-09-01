// Nav scroll-shrink
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!prefersReducedMotion) {
    window.addEventListener('scroll', () => {
        const header = document.querySelector('header nav');
        if (!header) return;
        if (window.scrollY > 50) {
            header.classList.add('py-2');
            header.classList.remove('py-4');
        } else {
            header.classList.add('py-4');
            header.classList.remove('py-2');
        }
    });
}

// Auto-update copyright year
const yearEl = document.getElementById("year");
if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
}

// Album of the Week: never let the text column grow taller than the cover art.
// Crops the blurb to whatever line count fits and reveals a "Read more" link
// (to the rotation archive) instead of letting the section stretch below it.
(function () {
    const coverCol = document.getElementById("aotw-cover-col");
    const contentCol = document.getElementById("aotw-content-col");
    const blurb = document.getElementById("aotw-blurb");
    const readMore = document.getElementById("aotw-readmore");
    if (!coverCol || !contentCol || !blurb || !readMore) return;

    function fit() {
        blurb.style.removeProperty("display");
        blurb.style.removeProperty("-webkit-box-orient");
        blurb.style.removeProperty("-webkit-line-clamp");
        blurb.style.removeProperty("overflow");
        readMore.classList.add("hidden");
        readMore.classList.remove("block");

        // Columns only sit side-by-side at md+; below that they stack and
        // there's nothing to constrain the blurb against.
        if (!window.matchMedia("(min-width: 768px)").matches) return;

        const coverHeight = coverCol.getBoundingClientRect().height;
        if (contentCol.scrollHeight <= coverHeight) return;

        readMore.classList.remove("hidden");
        readMore.classList.add("block");
        const otherHeight = contentCol.scrollHeight - blurb.scrollHeight;
        const availableForBlurb = coverHeight - otherHeight;
        const lineHeight = parseFloat(getComputedStyle(blurb).lineHeight) ||
            parseFloat(getComputedStyle(blurb).fontSize) * 1.6;
        const maxLines = Math.max(1, Math.floor(availableForBlurb / lineHeight));

        blurb.style.display = "-webkit-box";
        blurb.style.webkitBoxOrient = "vertical";
        blurb.style.overflow = "hidden";
        blurb.style.webkitLineClamp = String(maxLines);
    }

    fit();
    window.addEventListener("load", fit);
    let resizeTimeout;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(fit, 150);
    });
})();

// Blog post fade-in animation (used on blog article pages)
const blogArticle = document.querySelector('article > div');
if (blogArticle) {
    const observerOptions = { threshold: 0.1 };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('opacity-100', 'translate-y-0');
                entry.target.classList.remove('opacity-0', 'translate-y-10');
            }
        });
    }, observerOptions);
    document.querySelectorAll('article > div').forEach(el => {
        el.classList.add('transition-all', 'duration-1000', 'ease-out', 'opacity-0', 'translate-y-10');
        observer.observe(el);
    });
}