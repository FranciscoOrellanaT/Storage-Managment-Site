/* StoragePro - layout.js
   Shared parts for the staff pages: the sidebar, the top bar, pop-up messages,
   the confirm box and small helpers. Each page calls UI.start("pageName") first. */
var UI = (function () {
    "use strict";

    // Name of the sessionStorage slot that carries a message from one page to the next
    var FLASH_KEY = "storagepro-flash";

    // Makes text safe to put inside HTML
    function esc(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c];
        });
    }

    // Reads ?name=value from the address bar
    function param(name) {
        return new URLSearchParams(window.location.search).get(name);
    }

    // Saves a message to show on the next page
    function flash(message, type, undo) {
        try {
            sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message: message, type: type || "ok", undo: !!undo }));
        } catch (e) {
            // no storage: the message is skipped
        }
    }

    // Opens another page. If a message is given, it pops up on that page when it loads.
    function go(url, message, type, undo) {
        if (message) {
            flash(message, type, undo);
        }
        window.location.href = url;
    }

    /* Shows a pop-up message. Success messages fade after a few seconds,
       errors stay until closed. options.undo adds an Undo button. */
    // Timer that hides the current pop-up message
    var toastTimer = null;

    function toast(message, type, options) {
        var old = document.querySelector(".toast");
        if (old) {
            old.remove();
        }
        clearTimeout(toastTimer);
        var isError = type === "err";
        var canUndo = !!(options && options.undo && typeof SP !== "undefined" && SP.canUndo());
        var div = document.createElement("div");
        div.className = "toast " + (isError ? "toast-err" : "toast-ok");
        div.setAttribute("role", isError ? "alert" : "status");
        div.setAttribute("aria-live", isError ? "assertive" : "polite");
        div.innerHTML = "<i class=\"fa-solid " + (isError ? "fa-circle-exclamation" : "fa-circle-check") + "\" aria-hidden=\"true\"></i>"
            + "<span class=\"toast-text\">" + esc(message) + "</span>"
            + (canUndo ? "<button class=\"toast-undo\" type=\"button\">Undo</button>" : "")
            + "<button class=\"toast-close\" type=\"button\" aria-label=\"Close message\"><i class=\"fa-solid fa-xmark\"></i></button>";
        document.body.appendChild(div);

        // Removes the message
        function close() {
            clearTimeout(toastTimer);
            div.remove();
        }
        // Starts the fade-out countdown (12 seconds when there's an Undo button, otherwise 6). Errors stay.
        function startTimer() {
            if (!isError) {
                toastTimer = setTimeout(close, canUndo ? 12000 : 6000);
            }
        }
        // Close button, and the countdown pauses while the mouse or keyboard is on the message
        div.querySelector(".toast-close").addEventListener("click", close);
        div.addEventListener("mouseenter", function () { clearTimeout(toastTimer); });
        div.addEventListener("mouseleave", startTimer);
        div.addEventListener("focusin", function () { clearTimeout(toastTimer); });
        if (canUndo) {
            // Undo button: puts the data back (SP.undo) and reloads the page to show it
            div.querySelector(".toast-undo").addEventListener("click", function () {
                var result = SP.undo();
                if (result.error) {
                    toast(result.error, "err");
                    return;
                }
                flash("Undone: " + result.label + ".");
                window.location.reload();
            });
        }
        startTimer();
    }

    // Shows the message saved by flash()/go() on the page before, then forgets it
    function showFlash() {
        try {
            var f = JSON.parse(sessionStorage.getItem(FLASH_KEY));
            sessionStorage.removeItem(FLASH_KEY);
            if (f) {
                toast(f.message, f.type, { undo: f.undo });
            }
        } catch (e) {
            // no message
        }
    }

    // Confirm box. Resolves to true / false, or with input: {...} to the typed text (null if cancelled).
    function confirmBox(o) {
        return new Promise(function (resolve) {
            var before = document.activeElement;
            // Builds the box: icon + title, message, optional note, optional text box, Cancel and OK buttons
            var dialog = document.createElement("dialog");
            dialog.className = "confirm-box";
            dialog.setAttribute("aria-labelledby", "confirm-title");
            dialog.innerHTML = "<form method=\"dialog\" class=\"stack\" novalidate>"
                + "<div class=\"confirm-head\"><span class=\"confirm-icon" + (o.danger ? " is-danger" : "") + "\" aria-hidden=\"true\">"
                + "<i class=\"fa-solid " + (o.icon || (o.danger ? "fa-triangle-exclamation" : "fa-circle-question")) + "\"></i></span>"
                + "<h2 id=\"confirm-title\">" + esc(o.title) + "</h2></div>"
                + (o.message ? "<p>" + esc(o.message) + "</p>" : "")
                + (o.detail ? "<p class=\"note\"><i class=\"fa-solid fa-circle-info\"></i><span>" + esc(o.detail) + "</span></p>" : "")
                + (o.input ? "<div class=\"field\"><label for=\"confirm-input\">" + esc(o.input.label) + "</label>"
                    + "<input class=\"input\" id=\"confirm-input\" name=\"text\" maxlength=\"160\" placeholder=\"" + esc(o.input.placeholder || "") + "\">"
                    + "<span class=\"field-error\" id=\"confirm-error\" role=\"alert\" hidden></span></div>" : "")
                + "<div class=\"form-actions\">"
                + "<button class=\"btn btn-secondary\" value=\"cancel\" data-cancel>" + esc(o.cancel || "Cancel") + "</button>"
                + "<button class=\"btn " + (o.danger ? "btn-danger-solid" : "btn-primary") + "\" value=\"ok\" data-ok>" + esc(o.confirm || "OK") + "</button>"
                + "</div></form>";
            document.body.appendChild(dialog);

            var input = dialog.querySelector("#confirm-input");
            dialog.querySelector("[data-ok]").addEventListener("click", function (event) {
                // A reason is needed before the action can go ahead
                if (input && o.input.required && input.value.trim().length < 3) {
                    event.preventDefault();
                    var err = dialog.querySelector("#confirm-error");
                    err.textContent = o.input.required;
                    err.hidden = false;
                    input.classList.add("invalid");
                    input.focus();
                }
            });
            // Clicking outside the box cancels
            dialog.addEventListener("click", function (event) {
                if (event.target === dialog) {
                    dialog.close("cancel");
                }
            });
            // When the box closes: removes it, puts the keyboard focus back, and answers the Promise
            dialog.addEventListener("close", function () {
                var ok = dialog.returnValue === "ok";
                var text = input ? input.value.trim() : "";
                dialog.remove();
                if (before && before.focus) {
                    before.focus();
                }
                resolve(o.input ? (ok ? text : null) : ok);
            });
            // Shows the box on top of the page (the page behind can't be clicked until it closes)
            dialog.showModal();
            // Starts on the safe button for risky actions, or in the text box
            (input || (o.danger ? dialog.querySelector("[data-cancel]") : dialog.querySelector("[data-ok]"))).focus();
        });
    }

    // Shows an error inside a form and marks the field. Clears when the person types.
    function formError(container, message, fieldName) {
        var box = container.querySelector(".form-alert");
        if (!box) {
            box = document.createElement("div");
            box.className = "alert s-od form-alert";
            box.setAttribute("role", "alert");
            var head = container.querySelector(".card-head");
            if (head && head.parentNode === container) {
                head.insertAdjacentElement("afterend", box);
            } else {
                container.insertBefore(box, container.firstChild);
            }
        }
        box.innerHTML = "<i class=\"fa-solid fa-circle-exclamation\" aria-hidden=\"true\"></i><span>" + esc(message) + "</span>";
        var field = fieldName ? container.querySelector("[name=\"" + fieldName + "\"]") : null;
        if (field) {
            field.classList.add("invalid");
            field.focus();
        }
        // The error disappears as soon as the person starts fixing the form
        container.addEventListener("input", function clear() {
            box.remove();
            if (field) {
                field.classList.remove("invalid");
            }
            container.removeEventListener("input", clear);
        });
    }

    // HTML for one sidebar link: icon, label and its keyboard letter. The current page gets class "on".
    function navLink(href, key, icon, label, active, name) {
        return "<a href=\"" + href + "\"" + (active === name ? " class=\"on\"" : "") + " data-key=\"" + key
            + "\" title=\"" + label + " (" + key.toUpperCase() + ")\"><i class=\"fa-solid " + icon + "\"></i><span>"
            + label + "</span></a>";
    }

    // HTML for the sidebar: logo, front-desk links, manager-only links (Reports, Settings),
    // and the Collapse and Sign out buttons at the bottom
    function sidebar(active, staff) {
        return "<aside class=\"sidebar\">"
            + "<a class=\"brand\" href=\"dashboard.html\"><img src=\"images/logo.svg\" alt=\"\">"
            + "<span class=\"brand-name\">Storage<span>Pro</span></span></a>"
            + "<nav class=\"nav\"><span class=\"nav-label\">Front desk</span>"
            + navLink("dashboard.html", "d", "fa-gauge-high", "Dashboard", active, "dashboard")
            + navLink("lockers.html", "l", "fa-table-cells", "Locker Map", active, "lockers")
            + navLink("customers.html", "c", "fa-users", "Customers", active, "customers")
            + navLink("new-rental.html", "n", "fa-file-signature", "New Rental", active, "rental")
            + navLink("payments.html", "p", "fa-cash-register", "Payments", active, "payments")
            + navLink("maintenance.html", "m", "fa-screwdriver-wrench", "Maintenance", active, "maintenance")
            // Manager only
            + (staff.manager ? "<div class=\"nav-group\"><span class=\"nav-label\">Manager</span>"
                + navLink("reports.html", "r", "fa-chart-column", "Reports", active, "reports")
                + navLink("settings.html", "s", "fa-gear", "Settings", active, "settings") + "</div>" : "")
            + "</nav>"
            + "<div class=\"sidebar-foot\">"
            + "<button class=\"nav-btn\" type=\"button\" data-action=\"collapse\" title=\"Collapse sidebar\">"
            + "<i class=\"fa-solid fa-angles-left\"></i><span>Collapse</span></button>"
            + "<button class=\"nav-btn\" type=\"button\" id=\"sign-out\"><i class=\"fa-solid fa-arrow-right-from-bracket\"></i>"
            + "<span>Sign out</span></button>"
            + "</div></aside>";
    }

    // HTML for the top bar: search box, New Rental button, today's date, dark-mode button
    // and the signed-in staff member's name and role
    function topbar(staff) {
        return "<header class=\"topbar\">"
            + "<form class=\"search\" method=\"get\" action=\"search.html\" role=\"search\">"
            + "<i class=\"fa-solid fa-magnifying-glass\"></i>"
            + "<input class=\"input\" type=\"search\" name=\"q\" placeholder=\"Search customers or lockers\" data-search>"
            + "<kbd>/</kbd></form>"
            + "<span class=\"topbar-space\"></span>"
            + "<a class=\"btn btn-primary\" href=\"new-rental.html\"><i class=\"fa-solid fa-plus\"></i> New Rental</a>"
            + "<span class=\"topbar-date\"><i class=\"fa-regular fa-calendar\"></i><span>" + SP.fmtTopbar(SP.today()) + "</span></span>"
            + "<button class=\"icon-btn\" type=\"button\" data-action=\"dark\" title=\"Dark mode\">"
            + "<i class=\"fa-solid fa-moon when-light\"></i><i class=\"fa-solid fa-sun when-dark\"></i></button>"
            + "<div class=\"staff\"><span class=\"avatar\">" + esc(staff.initials) + "</span>"
            + "<span><span class=\"staff-name\">" + esc(staff.name) + "</span>"
            + "<span class=\"staff-role\">" + staff.roleLabel + "</span></span></div>"
            + "</header>";
    }

    // Checks someone is signed in, then draws the sidebar and top bar. Returns the staff member.
    function start(active, options) {
        var staff = SP.session();
        if (!staff) {
            // A signed-in customer goes back to their own page
            window.location.replace(SP.customerSession() ? "customer.html" : "index.html");
            return null;
        }
        if (options && options.managerOnly && !staff.manager) {
            go("dashboard.html", "Reports and Settings are for managers only.", "err");
            return null;
        }
        // Swaps the empty placeholders in the page's HTML for the real sidebar and top bar
        document.getElementById("sidebar").outerHTML = sidebar(active, staff);
        document.getElementById("topbar").outerHTML = topbar(staff);
        document.getElementById("sign-out").addEventListener("click", function () {
            SP.signOut();
            go("index.html", "Signed out.");
        });
        showFlash();
        return staff;
    }

    // Status names for the locker map
    function legend() {
        return "<div class=\"legend\">" + SP.STATUS_ORDER.map(function (s) {
            return "<span><i class=\"swatch " + SP.STATUS[s].css + "\"></i>" + SP.STATUS[s].label + "</span>";
        }).join("") + "</div>";
    }

    // HTML for a small colored label, like a status ("Overdue") or a tag
    function pill(css, text) {
        return "<span class=\"pill " + css + "\">" + esc(text) + "</span>";
    }

    // Reads a form's fields into an object: { name: value }
    function formData(form) {
        var data = {};
        new FormData(form).forEach(function (value, key) {
            data[key] = value;
        });
        return data;
    }

    // Builds a page link like "page.html?a=1&b=2" (empty values left out)
    function url(page, params) {
        var query = new URLSearchParams();
        Object.keys(params || {}).forEach(function (key) {
            var value = params[key];
            if (value !== null && value !== undefined && value !== "") {
                query.set(key, value);
            }
        });
        var text = query.toString();
        return page + (text ? "?" + text : "");
    }

    // Does a customer match the search? Checks name, email, phone and locker number.
    function matchCustomer(c, text) {
        text = text.trim().toLowerCase();
        var digits = text.replace(/\D/g, "");
        return c.name.toLowerCase().indexOf(text) >= 0
            || (c.customer.email || "").toLowerCase().indexOf(text) >= 0
            || (digits.length > 0 && c.customer.phone.replace(/\D/g, "").indexOf(digits) >= 0)
            || c.lockers.some(function (l) { return l.number.toLowerCase().indexOf(text) >= 0; });
    }

    // The helpers other files can use, as UI.esc(...), UI.go(...), UI.toast(...) and so on
    return {
        esc: esc, param: param, flash: flash, go: go, toast: toast, start: start, confirm: confirmBox, formError: formError,
        legend: legend, pill: pill, formData: formData, url: url, matchCustomer: matchCustomer
    };
})();
