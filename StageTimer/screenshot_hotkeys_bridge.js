(function() {
    const SCREENSHOT_FRAME_BRIDGE_MESSAGE = "dup-screenshot-hotkey-frame-bridge";
    const KEY_CODE_PAGE_DOWN = 34;
    const KEY_CODE_PRINT_SCREEN = 44;
    const KEY_CODE_F1 = 112;
    const KEY_CODE_F8 = 119;
    const SCREENSHOT_MANUAL_KEY = "S";

    function isTopWindow() {
        try {
            return window.top === window.self;
        } catch (e) {
            return true;
        }
    }

    if (isTopWindow()) return;
    if (window.__dupScreenshotHotkeysFrameBridgeInstalled) return;
    window.__dupScreenshotHotkeysFrameBridgeInstalled = true;

    function postScreenshotCommandToTop(command, source, eventType) {
        try {
            const topWindow = window.top;
            if (!topWindow || topWindow === window || typeof topWindow.postMessage !== "function") return;
            topWindow.postMessage({
                type: SCREENSHOT_FRAME_BRIDGE_MESSAGE,
                command,
                source: source || "iframe-hotkey",
                eventType: eventType || ""
            }, "*");
        } catch (e) {
            // ignore
        }
    }

    function resolveScreenshotTriggerKey(event) {
        const key = String(event.key || "");
        const code = String(event.code || "");
        const upperKey = key.toUpperCase();
        const keyCode = Number(event.keyCode || event.which || 0);

        if (event.ctrlKey && event.shiftKey && (upperKey === SCREENSHOT_MANUAL_KEY || code === "KeyS")) {
            return "ManualHide";
        }

        if (
            key === "PageDown" || code === "PageDown" ||
            key === "PgDown" || code === "PgDown" ||
            key === "Next" || code === "Next" ||
            keyCode === KEY_CODE_PAGE_DOWN
        ) {
            return "PageDown";
        }

        if (
            key === "PrintScreen" || code === "PrintScreen" ||
            key === "PrtSc" || code === "PrtSc" ||
            key === "Print" || code === "Print" ||
            key === "PrintScrn" || code === "PrintScrn" ||
            key === "Snapshot" || code === "Snapshot" ||
            key === "SysRq" || code === "SysRq" ||
            key === "ScreenCapture" || code === "ScreenCapture" ||
            keyCode === KEY_CODE_PRINT_SCREEN ||
            key === "F8" || code === "F8" || keyCode === KEY_CODE_F8
        ) {
            return "PrintScreen";
        }

        return "";
    }

    function isScreenshotToggleHotkey(event) {
        if (!event) return false;
        if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;

        const key = String(event.key || "");
        const code = String(event.code || "");
        const keyCode = Number(event.keyCode || event.which || 0);
        return key === "F1" || code === "F1" || keyCode === KEY_CODE_F1;
    }

    function suppressHotkeyEvent(event) {
        if (!event) return;
        if (typeof event.preventDefault === "function") event.preventDefault();
        if (typeof event.stopPropagation === "function") event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    }

    function handleScreenshotToggleHotkey(event) {
        if (!isScreenshotToggleHotkey(event)) return;

        suppressHotkeyEvent(event);
        if (event.type !== "keydown" || event.repeat) return;

        postScreenshotCommandToTop("toggle-manual", "iframe-hotkey:F1", event.type);
    }

    function handleScreenshotHotkey(event) {
        const triggerKey = resolveScreenshotTriggerKey(event);
        if (!triggerKey) return;
        if (event.type === "keydown" && event.repeat) return;

        postScreenshotCommandToTop("schedule-autohide", `iframe-hotkey:${triggerKey}:${event.type}`, event.type);
    }

    document.addEventListener("keydown", handleScreenshotToggleHotkey, true);
    document.addEventListener("keyup", handleScreenshotToggleHotkey, true);
    document.addEventListener("keydown", handleScreenshotHotkey, true);
    document.addEventListener("keyup", handleScreenshotHotkey, true);
})();
