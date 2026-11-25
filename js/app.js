/* StoragePro - app.js
   Controls dark mode, the sidebar collapse button, the print button and keyboard shortcuts. */
(function () {
    // The <body> tag: its "dark" and "collapsed" classes switch the whole look (see styles.css)
    var body = document.body;

    // Turns dark mode and the collapsed sidebar back on if they were on last time
    if (localStorage.getItem("sp-dark") === "1") {
        body.classList.add("dark");
    }
    if (localStorage.getItem("sp-collapsed") === "1") {
        body.classList.add("collapsed");
    }

    // One click listener for the whole page. Buttons say what they do with data-action="dark",
    // "collapse" or "print", so new buttons work without adding more listeners.
    document.addEventListener("click", function (event) {
        var button = event.target.closest("[data-action]");
        if (!button) {
            return;
        }
        var action = button.getAttribute("data-action");
        // Dark mode on/off, remembered in this browser for next time
        if (action === "dark") {
            body.classList.toggle("dark");
            localStorage.setItem("sp-dark", body.classList.contains("dark") ? "1" : "0");
        }
        // Sidebar narrow/wide, remembered in this browser for next time
        if (action === "collapse") {
            body.classList.toggle("collapsed");
            localStorage.setItem("sp-collapsed", body.classList.contains("collapsed") ? "1" : "0");
        }
        // Opens the browser's print window (used for receipts and slips)
        if (action === "print") {
            window.print();
        }
    });

    // Keyboard shortcuts: "/" jumps to the search box, and each sidebar link has a letter
    // (data-key, like "d" for Dashboard). Skipped while typing in a box or holding Ctrl/Alt.
    document.addEventListener("keydown", function (event) {
        var typing = event.target.closest("input, textarea, select");
        if (typing || event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }
        if (event.key === "/") {
            var search = document.querySelector("[data-search]");
            if (search) {
                event.preventDefault();
                search.focus();
            }
            return;
        }
        // Finds the sidebar link for the pressed letter and opens it
        var link = document.querySelector('a[data-key="' + event.key.toLowerCase() + '"]');
        if (link) {
            link.click();
        }
    });
})();
