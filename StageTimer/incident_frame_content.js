(function() {
    if (window === window.top || window.location.pathname.includes("/login")) return;

    const FRAME_MESSAGE_TYPE = "dup-stage-timer-error-exception-frame";
    const SCAN_INTERVAL_MS = 2000;
    const SCAN_DEBOUNCE_MS = 150;
    let scanTimeout = null;
    let lastVisibleSignature = "";

    function normalizeText(value) {
        return String(value || "").replace(/\s+/g, " ").trim();
    }

    function isVisible(element) {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function extractField(fieldName) {
        const expectedLabel = `${String(fieldName || "").trim()}:`.toLowerCase();
        const candidates = Array.from(document.querySelectorAll("p, dt, dd, th, td, li"));
        for (const candidate of candidates) {
            const text = normalizeText(candidate.textContent);
            if (!text) continue;
            if (text.toLowerCase() === expectedLabel) {
                const siblingValue = normalizeText(candidate.nextElementSibling && candidate.nextElementSibling.textContent);
                if (siblingValue) return siblingValue;
                continue;
            }
            if (text.toLowerCase().startsWith(expectedLabel)) {
                const inlineValue = normalizeText(text.slice(expectedLabel.length));
                if (inlineValue) return inlineValue;
            }
        }
        return "";
    }

    function scan() {
        scanTimeout = null;
        const heading = Array.from(document.querySelectorAll("h1, h2, h3")).find((element) => (
            normalizeText(element.textContent).toUpperCase() === "ERROR EXCEPTION"
            && isVisible(element)
        ));
        if (!heading) {
            lastVisibleSignature = "";
            return;
        }

        const fullText = normalizeText(
            document.body ? (document.body.innerText || document.body.textContent) : heading.textContent
        ) || "ERROR EXCEPTION";
        const signature = `${window.location.href} | ${fullText}`;
        if (signature === lastVisibleSignature) return;
        lastVisibleSignature = signature;

        window.top.postMessage({
            type: FRAME_MESSAGE_TYPE,
            pageUrl: window.location.href,
            message: extractField("Message"),
            userName: extractField("User"),
            fullText
        }, "*");
    }

    function scheduleScan(delayMs = SCAN_DEBOUNCE_MS) {
        if (scanTimeout) clearTimeout(scanTimeout);
        scanTimeout = setTimeout(scan, Math.max(0, Number(delayMs) || 0));
    }

    if (document.documentElement) {
        const observer = new MutationObserver(() => scheduleScan());
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["style", "class"]
        });
    }

    window.addEventListener("pageshow", () => scheduleScan(0));
    setInterval(() => scheduleScan(), SCAN_INTERVAL_MS);
    scheduleScan(0);
})();
