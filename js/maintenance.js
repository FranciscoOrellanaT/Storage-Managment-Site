/* StoragePro - maintenance.js
   Maintenance page: report a problem and follow tickets (Open, In progress, Resolved). */
(function () {
    "use strict";
    // Draws the sidebar and top bar and returns the signed-in staff member (stops if nobody is signed in)
    var staff = UI.start("maintenance");
    if (!staff) {
        return;
    }
    // e() makes text safe for HTML. b = every locker worked out; counts = tickets per status.
    // show = which tickets to list (maintenance.html?show=active, resolved or all).
    var e = UI.esc;
    var b = SP.board();
    var counts = SP.ticketCounts();
    var show = (UI.param("show") || "active").toLowerCase();
    if (["active", "resolved", "all"].indexOf(show) < 0) {
        show = "active";
    }
    // selected = the ticket opened on the right (?ticket=3). prefill = a locker picked from its page (?locker=B-203).
    var selected = SP.findTicket(UI.param("ticket"));
    var prefill = b.locker(UI.param("locker"));

    // Link back to this page with a list filter and, optionally, a ticket opened
    function listUrl(which, ticketId) {
        return UI.url("maintenance.html", { show: which === "active" ? null : which, ticket: ticketId });
    }

    // How a ticket's place is shown: the locker number, or "Building / not a locker"
    function lockerText(number) {
        return number ? number : "Building / not a locker";
    }

    // Shows what the chosen locker is under the locker picker
    function lockerStatus(number) {
        if (!number) {
            return "For problems with the building, gate, lights or hallways.";
        }
        var l = b.locker(number);
        return SP.sizeLabel(l.locker.size) + " · " + l.label + (l.rented ? " (rented by " + l.customer.name + ")" : "");
    }

    // HTML for a numbered question heading in the report form (1. Which locker? ...)
    function question(num, label, forId) {
        return "<div class=\"q-head\"><span class=\"q-num\">" + num + "</span>"
            + (forId ? "<label for=\"" + forId + "\">" + label + "</label>" : "<span>" + label + "</span>") + "</div>";
    }

    // An empty red message spot under a question, filled by showErrors()
    function errorSlot(field) {
        return "<span class=\"field-error\" id=\"err-" + field + "\" role=\"alert\" hidden></span>";
    }

    // ----- Page header -----
    var html = "<div class=\"page-head\"><div><h1>Maintenance</h1>"
        + "<p class=\"page-sub\">Report a problem with a locker or the building, then follow it until it's fixed.</p></div>"
        + "<div class=\"page-actions\"><a class=\"btn btn-primary\" href=\"#new-ticket\" id=\"jump-new\"><i class=\"fa-solid fa-plus\"></i> Report a problem</a></div></div>"

        // How it works
        + "<div class=\"flow\" aria-label=\"How tickets work\">"
        + "<div class=\"flow-step\"><span class=\"pill s-rs\">Open</span><span>Someone reports a problem</span></div>"
        + "<i class=\"fa-solid fa-arrow-right flow-arrow\"></i>"
        + "<div class=\"flow-step\"><span class=\"pill s-oc\">In progress</span><span>Someone starts the repair</span></div>"
        + "<i class=\"fa-solid fa-arrow-right flow-arrow\"></i>"
        + "<div class=\"flow-step\"><span class=\"pill s-av\">Resolved</span><span>Fixed, with a note of what was done</span></div>"
        + "</div>"

        + "<div class=\"grid grid-main-side\"><div class=\"stack\">";

    // ----- Report a problem -----
    // The locker drop-down: "Building" first, then every locker grouped by row, with its status and renter
    var lockerOptions = "<option value=\"\"" + (prefill ? "" : " selected") + ">Building / not a locker</option>"
        + SP.ROWS.map(function (row) {
            var size = SP.SIZES[b.inRow(row)[0].locker.size];
            return "<optgroup label=\"Row " + row + " · " + size.label + " " + size.dims + "\">"
                + b.inRow(row).map(function (l) {
                    return "<option value=\"" + l.number + "\"" + (prefill && prefill.number === l.number ? " selected" : "") + ">"
                        + l.number + " · " + l.label + (l.rented ? " · " + e(l.customer.name) : "") + "</option>";
                }).join("") + "</optgroup>";
        }).join("");

    html += "<form class=\"card\" id=\"new-ticket\" novalidate>"
        + "<div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-screwdriver-wrench\"></i>Report a problem</span>"
        + "<span class=\"card-sub\">4 quick questions</span></div>"

        // 1. Which locker?
        + "<div class=\"field\">" + question(1, "Which locker?", "t-locker")
        + "<select class=\"input\" id=\"t-locker\" name=\"locker\">" + lockerOptions + "</select>"
        + "<span class=\"help\" id=\"t-locker-status\">" + e(lockerStatus(prefill ? prefill.number : "")) + "</span>"
        + errorSlot("locker") + "</div>"

        // 2. What's wrong?
        + "<div class=\"field\">" + question(2, "What's wrong?")
        + "<div class=\"options options-compact\" role=\"radiogroup\" aria-label=\"What's wrong?\">"
        + Object.keys(SP.TICKET_CATEGORIES).map(function (key) {
            var c = SP.TICKET_CATEGORIES[key];
            return "<label class=\"option\"><input type=\"radio\" name=\"category\" value=\"" + key + "\">"
                + "<i class=\"option-check fa-solid fa-circle-check\"></i>"
                + "<span class=\"option-icon\"><i class=\"fa-solid " + c.icon + "\"></i></span>"
                + "<span class=\"option-title\">" + c.label + "</span></label>";
        }).join("") + "</div>" + errorSlot("category") + "</div>"

        // 3. How urgent?
        + "<div class=\"field\">" + question(3, "How urgent is it?")
        + "<div class=\"options options-compact\" role=\"radiogroup\" aria-label=\"How urgent is it?\">"
        + ["URGENT", "NORMAL", "LOW"].map(function (key) {
            var p = SP.TICKET_PRIORITIES[key];
            return "<label class=\"option\"><input type=\"radio\" name=\"priority\" value=\"" + key + "\"" + (key === "NORMAL" ? " checked" : "") + ">"
                + "<i class=\"option-check fa-solid fa-circle-check\"></i>"
                + "<span class=\"option-title\">" + UI.pill(p.css, p.label) + "</span>"
                + "<span class=\"option-meta\">" + p.help + "</span></label>";
        }).join("") + "</div>" + errorSlot("priority") + "</div>"

        // 4. Describe it
        + "<div class=\"field\">" + question(4, "Describe the problem", "t-desc")
        + "<textarea class=\"input\" id=\"t-desc\" name=\"description\" maxlength=\"500\" "
        + "placeholder=\"What did you see, and where exactly? e.g. The door won't latch and the left hinge is loose.\"></textarea>"
        + "<span class=\"help\"><span id=\"t-desc-count\">0</span>/500 characters</span>"
        + errorSlot("description") + "</div>"

        // Out of service
        + "<label class=\"check\" id=\"t-oos-wrap\"><input type=\"checkbox\" name=\"outOfService\" id=\"t-oos\">"
        + "<span><strong>Take this locker out of service until it's fixed</strong>"
        + "<span class=\"help\" id=\"t-oos-help\"></span></span></label>"
        + errorSlot("outOfService")

        + "<div class=\"form-actions\"><button class=\"btn btn-ghost\" type=\"reset\">Clear form</button>"
        + "<button class=\"btn btn-primary btn-lg\" type=\"submit\"><i class=\"fa-solid fa-paper-plane\"></i> Submit ticket</button></div>"
        + "</form>";

    // ----- Ticket list -----
    // The tickets for the chosen list, as rows that open each ticket on the right
    var tickets = SP.ticketList(show === "resolved" ? "RESOLVED" : show === "all" ? "ALL" : "ACTIVE");
    html += "<section class=\"card card-flush\" id=\"tickets\"><div class=\"card-head\">"
        + "<span class=\"card-title\"><i class=\"fa-solid fa-list-check\"></i>Tickets</span><div class=\"chips\">"
        + "<a class=\"chip" + (show === "active" ? " on" : "") + "\" href=\"" + listUrl("active") + "#tickets\">Open and in progress <span class=\"count\">" + counts.ACTIVE + "</span></a>"
        + "<a class=\"chip" + (show === "resolved" ? " on" : "") + "\" href=\"" + listUrl("resolved") + "#tickets\">Resolved <span class=\"count\">" + counts.RESOLVED + "</span></a>"
        + "<a class=\"chip" + (show === "all" ? " on" : "") + "\" href=\"" + listUrl("all") + "#tickets\">All <span class=\"count\">" + SP.ticketList("ALL").length + "</span></a>"
        + "</div></div><div class=\"list ticket-list\">"
        + tickets.map(function (t) {
            var c = SP.TICKET_CATEGORIES[t.category];
            var p = SP.TICKET_PRIORITIES[t.priority];
            var s = SP.TICKET_STATUS[t.status];
            return "<a class=\"list-item" + (selected && selected.id === t.id ? " on" : "") + "\" href=\"" + listUrl(show, t.id) + "\">"
                + "<span class=\"list-icon " + p.css + "\"><i class=\"fa-solid " + c.icon + "\"></i></span>"
                + "<span class=\"list-main\"><span class=\"list-title\"><span class=\"mono\">" + t.number + "</span> · "
                + lockerText(t.locker) + " · " + c.label + "</span>"
                + "<span class=\"list-meta\">" + e(t.description.length > 70 ? t.description.slice(0, 70) + "…" : t.description)
                + " · " + SP.fmtWhen(t.createdAt) + (t.customerId ? " · <strong>From customer</strong>" : "") + "</span></span>"
                + "<span class=\"list-end\">" + UI.pill(s.css, s.label) + (t.status !== "RESOLVED" ? UI.pill(p.css, p.label) : "") + "</span></a>";
        }).join("")
        + (tickets.length ? "" : "<p class=\"empty\">" + (show === "resolved" ? "No resolved tickets yet."
            : show === "all" ? "No tickets yet." : "Nothing to fix right now. Use the form above to report a problem.") + "</p>")
        + "</div></section>";

    html += "</div>";

    // ----- Selected ticket (or a summary) -----
    if (selected) {
        // The opened ticket: what, where, how urgent, who reported it, and when it was started and resolved
        var t = selected;
        var cat = SP.TICKET_CATEGORIES[t.category];
        var pri = SP.TICKET_PRIORITIES[t.priority];
        var st = SP.TICKET_STATUS[t.status];
        html += "<aside class=\"stack summary\"><section class=\"card\" id=\"ticket-detail\">"
            + "<div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid " + cat.icon + "\"></i><span class=\"mono\">" + t.number + "</span></span>"
            + UI.pill(st.css, st.label) + "</div>"
            + "<div class=\"dl\">"
            + "<div class=\"dl-row\"><span>Locker</span>" + (t.locker ? "<a class=\"link mono\" href=\"locker.html?n=" + t.locker + "\">" + t.locker + "</a>" : "<span>Building</span>") + "</div>"
            + "<div class=\"dl-row\"><span>Problem</span><span>" + cat.label + "</span></div>"
            + "<div class=\"dl-row\"><span>Urgency</span><span>" + UI.pill(pri.css, pri.label) + "</span></div>"
            + "<div class=\"dl-row\"><span>Out of service</span><span>" + (t.outOfService ? "Yes, until resolved" : "No") + "</span></div>"
            + "</div>"
            + "<p class=\"note ticket-desc\"><i class=\"fa-solid fa-quote-left\"></i><span>" + e(t.description) + "</span></p>"

            // Ticket timeline
            + "<div class=\"timeline\">"
            + "<div class=\"timeline-item done\"><strong>Reported</strong><span>" + SP.fmtDateTime(t.createdAt) + " · " + e(t.reportedBy) + "</span></div>"
            + "<div class=\"timeline-item" + (t.startedAt ? " done" : "") + "\"><strong>Work started</strong><span>"
            + (t.startedAt ? SP.fmtDateTime(t.startedAt) + " · " + e(t.startedBy) : "Not yet") + "</span></div>"
            + "<div class=\"timeline-item" + (t.resolvedAt ? " done" : "") + "\"><strong>Resolved</strong><span>"
            + (t.resolvedAt ? SP.fmtDateTime(t.resolvedAt) + " · " + e(t.resolvedBy) : "Not yet") + "</span></div>"
            + "</div>";

        // Next step buttons for this ticket
        if (t.status === "OPEN") {
            html += "<button class=\"btn btn-primary btn-block\" type=\"button\" id=\"start-work\"><i class=\"fa-solid fa-play\"></i> Start work</button>";
        }
        if (t.status !== "RESOLVED") {
            html += "<form class=\"stack\" id=\"resolve-form\" novalidate><div class=\"field\"><label for=\"resolution\">What was done to fix it?</label>"
                + "<textarea class=\"input\" id=\"resolution\" name=\"resolution\" maxlength=\"300\" placeholder=\"e.g. Replaced the hinge and tested the latch.\"></textarea>"
                + errorSlot("resolution") + "</div>"
                + "<button class=\"btn " + (t.status === "IN_PROGRESS" ? "btn-primary" : "btn-secondary") + " btn-block\" type=\"submit\">"
                + "<i class=\"fa-solid fa-circle-check\"></i> Mark resolved</button>"
                + (t.outOfService ? "<p class=\"help\">" + t.locker + " goes back in service when this is resolved.</p>" : "")
                + "</form>";
        } else {
            html += "<div class=\"dl\"><div class=\"dl-row\"><span>What was done</span><span>" + e(t.resolution) + "</span></div></div>"
                + "<button class=\"btn btn-secondary btn-block\" type=\"button\" id=\"reopen\"><i class=\"fa-solid fa-rotate-left\"></i> Reopen ticket</button>"
                + "<p class=\"help\">Reopen it if the problem comes back.</p>";
        }
        html += "<a class=\"link\" href=\"" + listUrl(show) + "\"><i class=\"fa-solid fa-xmark\"></i> Close ticket view</a>"
            + "</section></aside>";
    } else {
        html += "<aside class=\"stack summary\"><section class=\"card\">"
            + "<div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-chart-simple\"></i>Right now</span></div>"
            + "<div class=\"size-counts maint-counts\">"
            + "<div class=\"size-count\"><strong>" + counts.OPEN + "</strong><span>Open</span></div>"
            + "<div class=\"size-count\"><strong>" + counts.IN_PROGRESS + "</strong><span>In progress</span></div>"
            + "<div class=\"size-count\"><strong class=\"text-od\">" + counts.URGENT + "</strong><span>Urgent</span></div>"
            + "</div>"
            + "<p class=\"help\">" + SP.plural(b.count("MAINTENANCE"), "locker") + " out of service.</p>"
            + "</section>"
            + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-regular fa-lightbulb\"></i>Tips</span></div>"
            + "<ul class=\"tips\">"
            + "<li>Pick a ticket in the list to start work on it or mark it resolved.</li>"
            + "<li>Only empty lockers can be taken out of service. A rented locker stays rentable while it's fixed.</li>"
            + "<li>Use <strong>Urgent</strong> for anything unsafe or that stops a customer using their locker.</li>"
            + "</ul></section></aside>";
    }
    html += "</div>";
    // Puts the finished HTML inside <main id="page"> in maintenance.html, then wires up the form and buttons below
    document.getElementById("page").innerHTML = html;


    // ----- Form behavior -----
    // The report form and the parts that react while it's filled in
    var form = document.getElementById("new-ticket");
    var lockerSelect = document.getElementById("t-locker");
    var oos = document.getElementById("t-oos");
    var oosHelp = document.getElementById("t-oos-help");
    var desc = document.getElementById("t-desc");

    // Out of service only works for an empty locker
    function updateLocker() {
        var number = lockerSelect.value;
        document.getElementById("t-locker-status").textContent = lockerStatus(number);
        var l = number ? b.locker(number) : null;
        var allowed = l && !l.rented && l.status !== "MAINTENANCE";
        oos.disabled = !allowed;
        if (!allowed) {
            oos.checked = false;
        }
        document.getElementById("t-oos-wrap").classList.toggle("is-disabled", !allowed);
        oosHelp.textContent = !l ? "Pick a locker first."
            : l.rented ? number + " is rented, so it stays in service."
            : l.status === "MAINTENANCE" ? number + " is already out of service."
            : "Nobody can rent " + number + " until the ticket is resolved.";
    }
    // Re-checks the out-of-service box whenever a different locker is picked, and once at the start
    lockerSelect.addEventListener("change", updateLocker);
    updateLocker();

    // Live character count under the description box
    desc.addEventListener("input", function () {
        document.getElementById("t-desc-count").textContent = desc.value.length;
    });

    // Shows each error under its own question (errors = { locker: "...", description: "..." })
    // and moves the cursor to the first one. showErrors({}) clears them all.
    function showErrors(errors) {
        var first = null;
        ["locker", "category", "priority", "description", "outOfService"].forEach(function (field) {
            var slot = document.getElementById("err-" + field);
            slot.hidden = !errors[field];
            slot.textContent = errors[field] || "";
            if (errors[field] && !first) {
                first = field;
            }
        });
        desc.classList.toggle("invalid", !!errors.description);
        if (first) {
            var target = first === "description" ? desc : first === "locker" ? lockerSelect
                : form.querySelector("[name=\"" + first + "\"]");
            if (target) {
                target.focus();
            }
        }
    }

    // Clears a question's error once it is answered
    form.addEventListener("input", function (event) {
        var name = event.target.name;
        var slot = name && document.getElementById("err-" + name);
        if (slot) {
            slot.hidden = true;
            event.target.classList.remove("invalid");
        }
    });

    // Report form sent: SP.createTicket() checks every answer, saves the ticket
    // (and takes the locker out of service if asked), then opens the new ticket
    form.addEventListener("submit", function (event) {
        event.preventDefault();
        var data = UI.formData(form);
        var result = SP.createTicket({
            locker: data.locker, category: data.category, priority: data.priority,
            description: data.description, outOfService: !!data.outOfService
        }, staff.name);
        if (result.errors) {
            // Shows each error under its own question
            showErrors(result.errors);
            return;
        }
        UI.go(listUrl("active", result.ticket.id), "Ticket " + result.ticket.number + " submitted"
            + (result.ticket.outOfService ? " · " + result.ticket.locker + " is out of service" : "") + ".");
    });

    // Clear button: also clears the errors, the locker note and the character count
    form.addEventListener("reset", function () {
        setTimeout(function () {
            showErrors({});
            updateLocker();
            document.getElementById("t-desc-count").textContent = "0";
        }, 0);
    });

    // Locker already picked: start at question 2
    if (prefill) {
        form.scrollIntoView({ block: "start" });
        var firstCategory = form.querySelector("[name=\"category\"]");
        if (firstCategory) {
            firstCategory.focus();
        }
    }

    // ----- Ticket actions -----
    if (selected) {
        // Buttons on the opened ticket: Start work, Resolve (with what was done), and Reopen
        var here = listUrl(show, selected.id);
        var startBtn = document.getElementById("start-work");
        if (startBtn) {
            startBtn.addEventListener("click", function () {
                var r = SP.startTicket(selected.id, staff.name);
                return r.error ? UI.formError(document.getElementById("ticket-detail"), r.error) : UI.go(here, selected.number + " is in progress.");
            });
        }
        var resolveForm = document.getElementById("resolve-form");
        if (resolveForm) {
            resolveForm.addEventListener("submit", function (event) {
                event.preventDefault();
                var r = SP.resolveTicket(selected.id, UI.formData(resolveForm).resolution, staff.name);
                if (r.error) {
                    var slot = document.getElementById("err-resolution");
                    slot.textContent = r.error;
                    slot.hidden = false;
                    document.getElementById("resolution").classList.add("invalid");
                    document.getElementById("resolution").focus();
                    return;
                }
                UI.go(here, selected.number + " resolved" + (r.backInService ? " · " + selected.locker + " is back in service" : "") + ".");
            });
        }
        var reopenBtn = document.getElementById("reopen");
        if (reopenBtn) {
            reopenBtn.addEventListener("click", function () {
                var r = SP.reopenTicket(selected.id, staff.name);
                return r.error ? UI.formError(document.getElementById("ticket-detail"), r.error) : UI.go(listUrl("active", selected.id), selected.number + " reopened.");
            });
        }
    }
})();
