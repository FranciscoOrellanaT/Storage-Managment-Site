/* StoragePro - customers.js
   Customers page: customer table (search, filters, sort), the selected customer's account,
   the new customer form and the printable sign-in slip. */
(function () {
    "use strict";
    // Draws the sidebar and top bar and returns the signed-in staff member (stops if nobody is signed in)
    var staff = UI.start("customers");
    if (!staff) {
        return;
    }
    // e() makes text safe for HTML. b = every customer with balances and lockers worked out.
    var e = UI.esc;
    var b = SP.board();

    // q = the search words typed above the table
    var q = UI.param("q") || "";
    // Filter: all, overdue, paused or moved out
    var show = UI.param("show") || (UI.param("overdue") === "true" ? "overdue" : "all");
    if (["all", "overdue", "paused", "moved"].indexOf(show) < 0) {
        show = "all";
    }
    // Sorting picked by clicking a column heading (customers.html?sort=balance&dir=desc).
    // creating = true while the New customer form is open (?new=1).
    var sort = UI.param("sort") || "name";
    var dir = UI.param("dir") === "desc" ? "desc" : "asc";
    var needle = q.trim().toLowerCase();
    var creating = UI.param("new") === "1";

    // For each sortable column: the value to sort customers by
    var orders = {
        discount: function (c) { return SP.DISCOUNTS[c.customer.discount]; },
        monthly: function (c) { return c.monthly; },
        balance: function (c) { return c.balance; },
        status: function (c) { return c.statusRank; },
        name: function (c) { return c.name.toLowerCase(); }
    };
    var key = orders[sort] || orders.name;

    // Online account status (paused by staff, or closed after moving out)
    function isPaused(c) {
        return !!c.customer.portalDisabled && c.customer.portalReason !== "MOVED_OUT";
    }

    function isClosed(c) {
        return !!c.customer.portalDisabled && c.customer.portalReason === "MOVED_OUT";
    }

    // How many customers fit each filter (shown on the filter buttons)
    var counts = {
        all: b.customers.length,
        overdue: b.overdueCustomers().length,
        paused: b.customers.filter(isPaused).length,
        moved: b.customers.filter(function (c) { return c.movedOut; }).length
    };

    // The customers in the table: the ones that fit the filter and the search, in the chosen order
    // (same values fall back to name order)
    var shown = b.customers.filter(function (c) {
        var fits = show === "overdue" ? c.overdue : show === "paused" ? isPaused(c) : show === "moved" ? c.movedOut : true;
        return fits && (!needle || UI.matchCustomer(c, needle));
    }).sort(function (x, y) {
        var a = key(x);
        var z = key(y);
        var result = a < z ? -1 : a > z ? 1 : 0;
        if (dir === "desc") {
            result = -result;
        }
        return result || x.name.localeCompare(y.name);
    });

    // The customer shown on the right: the one in the address (?id=7), or the first in the table
    var selected = creating ? null : (b.customer(UI.param("id")) || shown[0] || null);

    // Link back to this page that keeps the search and filter, plus extra values
    function base(extra) {
        var params = { q: needle ? q : null, show: show === "all" ? null : show };
        Object.keys(extra).forEach(function (k) {
            params[k] = extra[k];
        });
        return UI.url("customers.html", params);
    }

    // A clickable column heading. Clicking the sorted column again flips the order (A-Z / Z-A).
    function sortLink(column, label, numeric) {
        var on = sort === column;
        var next = on && dir === "asc" ? "desc" : "asc";
        return "<th" + (numeric ? " class=\"num\"" : "") + "><a" + (on ? " class=\"on\"" : "") + " href=\""
            + base({ sort: column, dir: next }) + "\">" + label
            + (on ? " <i class=\"fa-solid " + (dir === "asc" ? "fa-arrow-up" : "fa-arrow-down") + "\"></i>" : "") + "</a></th>";
    }

    // A filter button (All, Overdue, Paused online, Moved out) with its count
    function chip(which, label, swatch) {
        return "<a class=\"chip" + (show === which ? " on" : "") + "\" href=\"" + UI.url("customers.html", { q: q, show: which === "all" ? null : which }) + "\">"
            + (swatch ? "<i class=\"swatch " + swatch + "\"></i>" : "") + label + " <span class=\"count\">" + counts[which] + "</span></a>";
    }

    // An empty red message spot under a form box, filled by showErrors()
    function errorSlot(field) {
        return "<span class=\"field-error\" id=\"err-" + field + "\" role=\"alert\" hidden></span>";
    }

    // HTML for one labeled text box with its error spot and optional help line
    function field(id, name, label, value, attrs, help) {
        return "<div class=\"field\"><label for=\"" + id + "\">" + label + "</label>"
            + "<input class=\"input\" id=\"" + id + "\" name=\"" + name + "\" value=\"" + e(value || "") + "\"" + (attrs || "") + ">"
            + (help ? "<span class=\"help\">" + help + "</span>" : "") + errorSlot(name) + "</div>";
    }

    // The "Discount on file" drop-down
    function discountSelect(current) {
        return "<div class=\"field\"><label for=\"c-discount\">Discount on file</label><select class=\"input\" id=\"c-discount\" name=\"discount\">"
            + SP.DISCOUNT_ORDER.map(function (d) {
                return "<option value=\"" + d + "\"" + (d === current ? " selected" : "") + ">" + SP.DISCOUNTS[d]
                    + (d === "NONE" ? "" : " (" + SP.discountPct(d) + "% off)") + "</option>";
            }).join("") + "</select><span class=\"help\">Used for new rentals. Current rentals keep their rate.</span></div>";
    }

    // A welcome email with the customer's sign-in details, as a "mailto:" link.
    // Clicking it opens the staff member's email app with the message filled in;
    // nothing is sent until they press Send there.
    function welcomeEmailLink(s, c, signInPage) {
        var F = SP.FACILITY;
        var first = s.name.split(" ")[0];
        var subject = "Welcome to " + F.name + " - your online account";
        var body = [
            "Hi " + first + ",",
            "",
            "Welcome to " + F.name + "! Your online account is ready. You can use it to pay rent, see your gate code and ask for repairs.",
            "",
            "To sign in:",
            "1. Go to " + signInPage,
            "2. Sign in with " + (c.email || c.phone) + (c.email ? " (or your phone number " + c.phone + ")" : ""),
            "3. Temporary password: " + c.tempPassword,
            "4. Pick your own password when asked, right after you sign in. The temporary password stops working once you do.",
            "",
            "Questions? Call us at " + F.phone + " or reply to this email. We're open " + F.hoursText.charAt(0).toLowerCase() + F.hoursText.slice(1) + ".",
            "",
            F.name
        ].join("\r\n");
        return "mailto:" + encodeURIComponent(c.email) + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    }

    // Sign-in slip for a new customer (only the slip prints)
    function slip(s) {
        var c = s.customer;
        if (UI.param("slip") !== "1" || !c.mustChangePassword || !c.tempPassword) {
            return "";
        }
        var F = SP.FACILITY;
        var signInPage = F.website || window.location.href.split("?")[0].replace(/[^/]*$/, "index.html");
        return "<section class=\"card slip-card\" id=\"slip\">"
            + "<div class=\"card-head no-print\"><span class=\"card-title\"><i class=\"fa-solid fa-id-card\"></i>Sign-in slip for " + e(s.name.split(" ")[0]) + "</span>"
            + "<a class=\"btn btn-ghost btn-sm\" href=\"" + base({ sort: sort, dir: dir, id: s.id }) + "\">Done</a></div>"
            + "<p class=\"help no-print\">Print it, email it or read it out. The temporary password only works until they pick their own.</p>"
            + "<div class=\"receipt slip\">"
            + "<div class=\"receipt-head\"><div class=\"row\"><img src=\"images/logo.svg\" alt=\"\"><strong>StoragePro</strong></div>"
            + "<span class=\"muted\">Your online account</span></div>"
            + "<p><strong>Welcome, " + e(s.name.split(" ")[0]) + "!</strong> You can pay rent, see your gate code and ask for repairs online.</p>"
            + "<ol class=\"slip-steps\">"
            + "<li><span>Go to the sign-in page</span><strong class=\"slip-url\">" + e(signInPage) + "</strong></li>"
            + "<li><span>Sign in with</span><strong>" + e(c.email || c.phone) + "</strong>" + (c.email ? "<em>or your phone number " + e(c.phone) + "</em>" : "") + "</li>"
            + "<li><span>Temporary password</span><strong class=\"slip-password mono\">" + e(c.tempPassword) + "</strong></li>"
            + "<li><span>Pick your own password</span><em>You'll be asked right after you sign in.</em></li>"
            + "</ol>"
            + "<p class=\"receipt-foot\">Questions? Call " + F.phone + " · " + F.hoursText + "</p>"
            + "</div>"
            + "<div class=\"row no-print\"><button class=\"btn btn-primary\" type=\"button\" data-action=\"print\"><i class=\"fa-solid fa-print\"></i> Print slip</button>"
            + (c.email
                ? "<a class=\"btn btn-secondary\" id=\"email-slip\" href=\"" + e(welcomeEmailLink(s, c, signInPage)) + "\"><i class=\"fa-regular fa-envelope\"></i> Email welcome</a>"
                : "")
            + "<button class=\"btn btn-secondary\" type=\"button\" id=\"copy-slip\"><i class=\"fa-regular fa-copy\"></i> Copy details</button></div>"
            + (c.email ? "" : "<p class=\"help no-print\">No email on file, so there's nothing to email. Add one to their details to send a welcome email.</p>")
            + "</section>";
    }

    // Page heading with the customer counts and the New customer button, then the customer table
    var html = "<div class=\"page-head\"><div><h1>Customers</h1>"
        + "<p class=\"page-sub\">" + SP.plural(counts.all, "customer") + " · " + counts.overdue + " overdue · "
        + counts.paused + " paused online · " + counts.moved + " moved out</p></div>"
        + "<div class=\"page-actions\"><a class=\"btn btn-primary\" href=\"" + base({ "new": 1 }) + "\"><i class=\"fa-solid fa-user-plus\"></i> New customer</a></div></div>"
        + "<div class=\"grid grid-main-side\">"

        // Customer table
        + "<section class=\"card card-flush\"><div class=\"card-head\">"
        + "<form class=\"search\" method=\"get\" action=\"customers.html\"><i class=\"fa-solid fa-magnifying-glass\"></i>"
        + "<input class=\"input\" type=\"search\" name=\"q\" value=\"" + e(q) + "\" placeholder=\"Name, phone, email or locker\">"
        + (show !== "all" ? "<input type=\"hidden\" name=\"show\" value=\"" + show + "\">" : "") + "</form>"
        + "<div class=\"chips\">" + chip("all", "All") + chip("overdue", "Overdue", "s-od") + chip("paused", "Paused online", "s-rs")
        + chip("moved", "Moved out", "s-mt") + "</div>"
        + "</div>"
        + "<table class=\"table\"><thead><tr>" + sortLink("name", "Customer") + "<th>Lockers</th>" + sortLink("discount", "Discount")
        + sortLink("monthly", "Monthly", true) + sortLink("balance", "Balance", true) + sortLink("status", "Status") + "</tr></thead><tbody>"
        // One table row per customer: name, contact, lockers, discount, monthly rent, balance and status
        + shown.map(function (c) {
            return "<tr class=\"trow" + (selected && selected.id === c.id ? " on" : "") + "\">"
                + "<td><a class=\"row-link\" href=\"" + base({ sort: sort, dir: dir, id: c.id }) + "\">" + e(c.name) + "</a>"
                + "<span class=\"cell-sub\">" + e(c.customer.email || c.customer.phone) + "</span></td>"
                + "<td class=\"mono\">" + c.lockerNumbers + "</td>"
                + "<td>" + SP.DISCOUNTS[c.customer.discount] + "</td>"
                + "<td class=\"num\">" + SP.money(c.monthly) + "</td>"
                + "<td class=\"num\"><strong>" + SP.money(c.balance) + "</strong></td>"
                + "<td><div class=\"row\">" + UI.pill(c.statusCss, c.statusLabel)
                + (isPaused(c) ? "<span class=\"pill s-mt\" title=\"Online account paused\"><i class=\"fa-solid fa-lock\"></i> Paused</span>" : "")
                + "</div></td></tr>";
        }).join("")
        + (shown.length ? "" : "<tr><td colspan=\"6\" class=\"empty\">" + (counts.all ? "No customers match."
            : "No customers yet. Use <strong>New customer</strong> to add one.") + "</td></tr>")
        + "</tbody></table></section>";

    if (creating) {
        // New customer form
        html += "<div class=\"stack summary\"><form class=\"card\" id=\"new-form\" novalidate>"
            + "<div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-user-plus\"></i>New customer</span>"
            + "<a class=\"btn btn-ghost btn-sm\" href=\"" + base({}) + "\">Cancel</a></div>"
            + field("c-name", "name", "Full name", "", " autocomplete=\"off\" required")
            + field("c-phone", "phone", "Phone", "", " type=\"tel\" autocomplete=\"off\" required", "They can sign in with this number.")
            + field("c-email", "email", "Email (optional)", "", " type=\"email\" autocomplete=\"off\"", "They can also sign in with this.")
            + discountSelect("NONE")
            + "<p class=\"note\"><i class=\"fa-solid fa-id-card\"></i><span>Next you'll get a <strong>sign-in slip</strong> with a temporary password "
            + "to hand them. They pick their own password the first time they sign in.</span></p>"
            + "<div class=\"form-actions\"><button class=\"btn btn-primary\" type=\"submit\"><i class=\"fa-solid fa-check\"></i> Create account</button></div>"
            + "</form></div>";
    } else if (selected) {
        // The selected customer's account: s = worked-out values (balance, lockers), c = the saved record
        var s = selected;
        var c = s.customer;
        // Payment history: the latest 6, or all with "Show all"
        var allPayments = SP.paymentsFor(s.id, 100000);
        var showAllPayments = UI.param("payments") === "all";
        var history = showAllPayments ? allPayments : allPayments.slice(0, 6);
        var requests = SP.ticketsForCustomer(s.id).slice(0, 4);
        var paused = isPaused(s);
        var closed = isClosed(s);
        var pastRentals = SP.rentalsFor(s.id).filter(function (r) { return r.moveOut; });

        html += "<div class=\"stack summary\">" + slip(s)
            // Header
            + "<section class=\"card\"><div class=\"profile-head\"><span class=\"avatar avatar-lg\">" + SP.initials(s.name) + "</span>"
            + "<div><h2>" + e(s.name) + "</h2><p class=\"muted\">Customer since " + SP.fmtMonthYear(c.since) + "</p>"
            + "<div class=\"row\">" + UI.pill(s.statusCss, s.statusLabel)
            + UI.pill(closed ? "s-mt" : paused ? "s-rs" : "s-av", closed ? "Online closed" : paused ? "Online paused" : "Online active") + "</div></div></div></section>"

            // Balance
            + "<div class=\"balance-box" + (s.overdue ? " s-od" : "") + "\"><span class=\"label\">Balance</span>"
            + "<span class=\"balance-amount\">" + SP.money(s.balance) + "</span>"
            + (s.overdue ? "<span class=\"balance-note\"><i class=\"fa-solid fa-triangle-exclamation\"></i>" + s.mostOverdue.number
                + " · oldest charge " + SP.fmtShort(s.oldestUnpaid) + " · " + SP.days(s.daysOverdue) + " overdue</span>" : "")
            + (!s.overdue && s.dueToday ? "<span class=\"balance-note\"><i class=\"fa-solid fa-calendar-day\"></i>Rent due today</span>" : "")
            + (s.balance === 0 ? "<span class=\"balance-note\"><i class=\"fa-solid fa-circle-check\"></i>Paid up</span>" : "")
            + (s.balance > 0 ? "<a class=\"btn btn-primary\" href=\"payments.html?customer=" + s.id + "\"><i class=\"fa-solid fa-cash-register\"></i> Take payment</a>" : "")
            + "</div>"

            // Online account: pause or turn back on
            + "<section class=\"card\" id=\"online-card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-mobile-screen\"></i>Online account</span>"
            + UI.pill(closed ? "s-mt" : paused ? "s-rs" : "s-av", closed ? "Closed" : paused ? "Paused" : "Active") + "</div>"
            + "<div class=\"dl\">"
            + "<div class=\"dl-row\"><span>Signs in with</span><span>" + e(c.email || c.phone) + (c.email ? "<span class=\"cell-sub\">or " + e(c.phone) + "</span>" : "") + "</span></div>"
            + "<div class=\"dl-row\"><span>Last sign-in</span><span>" + SP.fmtSignIn(c.lastSignIn) + "</span></div>"
            + "<div class=\"dl-row\"><span>Password</span><span>" + (c.mustChangePassword
                ? "Temporary · not changed yet<span class=\"cell-sub\"><a class=\"link\" href=\"" + base({ sort: sort, dir: dir, id: s.id, slip: 1 }) + "#slip\">Show sign-in slip</a></span>"
                : c.password ? "Set by customer" : "Starting password") + "</span></div>"
            + (paused || closed ? "<div class=\"dl-row\"><span>" + (closed ? "Closed" : "Paused") + "</span><span>" + SP.PAUSE_REASONS[c.portalReason] + "<span class=\"cell-sub\">"
                + SP.fmtDateTime(c.portalChangedAt) + " · " + e(c.portalChangedBy) + "</span>"
                + (c.portalNote ? "<span class=\"cell-sub\">“" + e(c.portalNote) + "”</span>" : "") + "</span></div>" : "")
            + "</div>"
            + (closed
                ? "<p class=\"note\"><i class=\"fa-solid fa-box-archive\"></i><span>Closed automatically when " + e(s.name.split(" ")[0])
                + " moved out. Their file, rentals and payments are kept. It reopens on its own if they rent again.</span></p>"
                + "<button class=\"btn btn-secondary btn-block\" type=\"button\" id=\"turn-on\"><i class=\"fa-solid fa-unlock\"></i> Reopen online account now</button>"
                : paused
                ? "<p class=\"note\"><i class=\"fa-solid fa-lock\"></i><span>" + e(s.name.split(" ")[0]) + " can't sign in and is told to call the office.</span></p>"
                + "<button class=\"btn btn-primary btn-block\" type=\"button\" id=\"turn-on\"><i class=\"fa-solid fa-unlock\"></i> Turn online account back on</button>"
                : (s.overdue ? "<p class=\"note warn\"><i class=\"fa-solid fa-triangle-exclamation\"></i><span>" + SP.days(s.daysOverdue)
                    + " overdue. You can pause the online account until they pay.</span></p>" : "")
                + "<details class=\"pause-box\"" + (s.overdue ? " open" : "") + "><summary><i class=\"fa-solid fa-lock\"></i> Pause online account</summary>"
                + "<form class=\"stack\" id=\"pause-form\">"
                + "<div class=\"field\"><label for=\"p-reason\">Why?</label><select class=\"input\" id=\"p-reason\" name=\"reason\">"
                + Object.keys(SP.PAUSE_REASONS).filter(function (r) { return r !== "MOVED_OUT"; }).map(function (r) {
                    return "<option value=\"" + r + "\"" + ((s.overdue ? "OVERDUE" : "REQUEST") === r ? " selected" : "") + ">" + SP.PAUSE_REASONS[r] + "</option>";
                }).join("") + "</select></div>"
                + "<div class=\"field\"><label for=\"p-note\">Note (optional)</label><input class=\"input\" id=\"p-note\" name=\"note\" maxlength=\"120\" placeholder=\"e.g. Called and left a message\"></div>"
                + "<button class=\"btn btn-danger btn-block\" type=\"submit\"><i class=\"fa-solid fa-lock\"></i> Pause online account</button>"
                + "<p class=\"help\">Their lockers and balance don't change. They just can't sign in until you turn it back on.</p>"
                + "</form></details>")
            + "<div class=\"form-actions\"><button class=\"btn btn-ghost btn-sm\" type=\"button\" id=\"reset-portal\">"
            + "<i class=\"fa-solid fa-key\"></i> New temporary password</button></div>"
            + "</section>"

            // Account details
            + "<form class=\"card\" id=\"details-form\" novalidate><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-regular fa-address-card\"></i>Account details</span></div>"
            + field("c-name", "name", "Full name", c.name, " required")
            + field("c-phone", "phone", "Phone", c.phone, " type=\"tel\" required")
            + field("c-email", "email", "Email", c.email, " type=\"email\"")
            + discountSelect(c.discount)
            + "<div class=\"form-actions\"><button class=\"btn btn-secondary btn-sm\" type=\"submit\">Save changes</button></div></form>"

            // Lockers
            + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-box\"></i>Lockers</span>"
            + "<a class=\"link\" href=\"new-rental.html?step=2&customerId=" + s.id + "\">+ Rent a locker</a></div><div class=\"list\">"
            + s.lockers.map(function (l) {
                return "<a class=\"list-item\" href=\"locker.html?n=" + l.number + "\"><span class=\"list-icon " + l.css + "\"><i class=\"fa-solid fa-box\"></i></span>"
                    + "<span class=\"list-main\"><span class=\"list-title mono\">" + l.number + "</span><span class=\"list-meta\">"
                    + SP.sizeLabel(l.locker.size) + " · " + SP.money(l.rental.monthlyRate) + "/mo</span></span>"
                    + "<span class=\"list-end\">" + UI.pill(l.css, l.label) + "</span></a>";
            }).join("") + (s.lockers.length ? "" : "<p class=\"list-meta\">No lockers right now.</p>") + "</div></section>"

            // Rental history (kept after they move out)
            + (pastRentals.length ? "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-box-archive\"></i>Rental history</span></div>"
                + "<div class=\"list\">" + pastRentals.map(function (r) {
                    var size = SP.findLocker(r.locker).size;
                    return "<div class=\"list-item\"><span class=\"list-icon s-mt\"><i class=\"fa-solid fa-box\"></i></span>"
                        + "<span class=\"list-main\"><span class=\"list-title mono\">" + r.locker + "</span><span class=\"list-meta\">"
                        + SP.sizeLabel(size) + " · " + SP.money(r.monthlyRate) + "/mo</span></span>"
                        + "<span class=\"list-end\"><span class=\"list-meta\">" + SP.fmtDate(r.moveIn) + " – " + SP.fmtDate(r.moveOut) + "</span></span></div>";
                }).join("") + "</div></section>" : "")

            // Payments
            + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-clock-rotate-left\"></i>Payment history</span>"
            + "<span class=\"card-sub\">" + SP.plural(allPayments.length, "payment") + " on file</span></div><div class=\"list\">"
            + history.map(function (p) {
                return "<a class=\"list-item\" href=\"payments.html?customer=" + s.id + "&receipt=" + p.id + "\">"
                    + "<span class=\"list-main\"><span class=\"list-title\">" + SP.money(p.amount) + "</span><span class=\"list-meta\">"
                    + SP.fmtDate(p.at) + " · " + SP.METHODS[p.method] + " · " + SP.paymentLockers(p) + (p.voided ? " · <strong class=\"text-od\">Voided</strong>" : "")
                    + (p.reference === "Paid online" ? " · online" : "") + "</span></span>"
                    + "<span class=\"list-end\"><span class=\"list-meta mono\">" + p.receiptNo + "</span></span></a>";
            }).join("") + (history.length ? "" : "<p class=\"list-meta\">No payments yet.</p>") + "</div>"
            + (allPayments.length > 6 ? "<a class=\"link\" href=\"" + base({ sort: sort, dir: dir, id: s.id, payments: showAllPayments ? null : "all" }) + "\">"
                + (showAllPayments ? "Show the latest 6" : "Show all " + allPayments.length + " payments") + "</a>" : "")
            + "</section>"

            // Repair requests
            + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-screwdriver-wrench\"></i>Repair requests</span></div><div class=\"list\">"
            + requests.map(function (t) {
                var st = SP.TICKET_STATUS[t.status];
                return "<a class=\"list-item\" href=\"maintenance.html?ticket=" + t.id + "\"><span class=\"list-main\"><span class=\"list-title\">"
                    + t.number + " · " + SP.TICKET_CATEGORIES[t.category].label + "</span><span class=\"list-meta\">Unit " + t.locker + " · "
                    + SP.fmtDate(t.createdAt) + "</span></span><span class=\"list-end\">" + UI.pill(st.css, st.label) + "</span></a>";
            }).join("") + (requests.length ? "" : "<p class=\"list-meta\">None sent online.</p>") + "</div></section>"

            // Notes
            + "<form class=\"card\" id=\"notes-form\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-regular fa-note-sticky\"></i>Notes</span></div>"
            + "<textarea class=\"input\" name=\"notes\" placeholder=\"Only staff see this.\">" + e(c.notes) + "</textarea>"
            + "<div class=\"form-actions\"><button class=\"btn btn-secondary btn-sm\" type=\"submit\">Save note</button></div></form>"
            + "</div>";
    } else {
        html += "<div class=\"stack summary\"><section class=\"card portal-empty\"><i class=\"fa-solid fa-user-plus\"></i>"
            + "<strong>Add your first customer</strong>"
            + "<span>Make their account when you meet them. You'll get a sign-in slip to hand them so they can use their own page.</span>"
            + "<a class=\"btn btn-primary\" href=\"" + base({ "new": 1 }) + "\"><i class=\"fa-solid fa-user-plus\"></i> New customer</a></section></div>";
    }
    html += "</div>";
    // Puts the finished HTML inside <main id="page"> in customers.html, then wires up the forms below
    document.getElementById("page").innerHTML = html;


    // ----- Form errors: shown next to the field, cleared when typing -----
    // Shows each error under its own box (errors = { phone: "..." }) and moves the cursor to the first one
    function showErrors(form, errors) {
        var first = null;
        ["name", "phone", "email", "discount"].forEach(function (f) {
            var slot = form.querySelector("#err-" + f);
            var input = form.querySelector("[name=\"" + f + "\"]");
            if (slot) {
                slot.textContent = errors[f] || "";
                slot.hidden = !errors[f];
            }
            if (input) {
                input.classList.toggle("invalid", !!errors[f]);
            }
            if (errors[f] && !first) {
                first = input;
            }
        });
        if (first) {
            first.focus();
        }
    }

    // Hides a box's error as soon as the person types in it
    function liveClear(form) {
        form.addEventListener("input", function (event) {
            var slot = form.querySelector("#err-" + event.target.name);
            if (slot) {
                slot.hidden = true;
                event.target.classList.remove("invalid");
            }
        });
    }

    // New customer form sent: SP.createCustomer() checks and saves them, then shows their sign-in slip
    if (creating) {
        var newForm = document.getElementById("new-form");
        liveClear(newForm);
        document.getElementById("c-name").focus();
        newForm.addEventListener("submit", function (event) {
            event.preventDefault();
            var result = SP.createCustomer(UI.formData(newForm), staff.name);
            if (result.errors) {
                showErrors(newForm, result.errors);
                return;
            }
            UI.go(UI.url("customers.html", { id: result.customer.id, slip: 1 }), "Account created for " + result.customer.name
                + ". Give them their sign-in slip.");
        });
        return;
    }

    if (!selected) {
        return;
    }
    // The address of this exact view, to come back to after saving
    var here = base({ sort: sort, dir: dir, id: selected.id });

    // Account details form: saves name, phone, email and discount (SP.updateCustomer)
    var detailsForm = document.getElementById("details-form");
    liveClear(detailsForm);
    detailsForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var result = SP.updateCustomer(selected.id, UI.formData(detailsForm), staff.name);
        if (result.errors) {
            showErrors(detailsForm, result.errors);
            return;
        }
        UI.go(here, "Changes saved for " + result.customer.name + ".");
    });

    // Pause online account: asks first, then stops the customer signing in (their lockers aren't affected)
    var pauseForm = document.getElementById("pause-form");
    if (pauseForm) {
        pauseForm.addEventListener("submit", function (event) {
            event.preventDefault();
            var d = UI.formData(pauseForm);
            UI.confirm({
                title: "Pause " + selected.name + "'s online account?",
                message: "They won't be able to sign in until you turn it back on. Their lockers and balance don't change.",
                confirm: "Pause account", cancel: "Keep it on", danger: true, icon: "fa-lock"
            }).then(function (yes) {
                if (!yes) {
                    return;
                }
                var result = SP.setCustomerAccess(selected.id, false, d.reason, d.note, staff.name);
                if (result.error) {
                    UI.formError(pauseForm, result.error, "reason");
                    return;
                }
                UI.go(here, selected.name + "'s online account is paused.");
            });
        });
    }
    // Turn the online account back on
    var turnOn = document.getElementById("turn-on");
    if (turnOn) {
        turnOn.addEventListener("click", function () {
            var result = SP.setCustomerAccess(selected.id, true, null, null, staff.name);
            if (result.error) {
                UI.formError(document.getElementById("online-card"), result.error);
                return;
            }
            UI.go(here, selected.name + "'s online account is open again. They can sign in.");
        });
    }

    // New temporary password: the old one stops working and a new sign-in slip is shown
    document.getElementById("reset-portal").addEventListener("click", function () {
        UI.confirm({
            title: "Make a new temporary password for " + selected.name + "?",
            message: "Their current password stops working. You'll get a new sign-in slip to give them.",
            confirm: "Make new password", cancel: "Cancel", icon: "fa-key"
        }).then(function (yes) {
            if (yes) {
                SP.resetCustomerPassword(selected.id, staff.name);
                UI.go(base({ sort: sort, dir: dir, id: selected.id, slip: 1 }), "New temporary password made. Give " + selected.name + " the new slip.");
            }
        });
    });

    // Copies the slip's details as text
    var copyBtn = document.getElementById("copy-slip");
    if (copyBtn) {
        copyBtn.addEventListener("click", function () {
            var text = Array.prototype.map.call(document.querySelectorAll(".slip-steps li"), function (li, i) {
                return (i + 1) + ". " + li.innerText.replace(/\n+/g, ": ");
            }).join("\n");
            var done = function () { UI.toast("Sign-in details copied."); };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText("StoragePro online account\n" + text).then(done, function () {
                    UI.toast("Couldn't copy. Select the text on the slip instead.", "err");
                });
            } else {
                UI.toast("Copying isn't available in this browser. Select the text on the slip instead.", "err");
            }
        });
    }
    // Notes form: saves the staff notes on this customer
    document.getElementById("notes-form").addEventListener("submit", function (event) {
        event.preventDefault();
        SP.saveNotes(selected.id, UI.formData(event.target).notes);
        UI.go(here, "Note saved for " + selected.name + ".");
    });
})();
