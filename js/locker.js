/* StoragePro - locker.js
   One locker's page: rental details, charges, move out, holds and repairs. */
(function () {
    "use strict";
    // Draws the sidebar and top bar (Locker Map stays highlighted) and returns the signed-in staff member
    var staff = UI.start("lockers");
    if (!staff) {
        return;
    }
    // e() makes text safe for HTML. b = every locker with its status worked out.
    // l = the locker named in the address (locker.html?n=B-203); unknown numbers go back to the map.
    var e = UI.esc;
    var b = SP.board();
    var l = b.locker(UI.param("n"));
    if (!l) {
        UI.go("lockers.html", "There is no locker " + (UI.param("n") || "") + ".", "err");
        return;
    }
    // Browser tab title, and this page's address (used to come back here after an action)
    document.title = l.number + " · StoragePro";
    var here = "locker.html?n=" + l.number;

    // Report a problem, or see the open tickets for this locker
    var openTickets = SP.ticketList("ACTIVE").filter(function (t) { return t.locker === l.number; });
    var reportButton = "<a class=\"btn btn-secondary btn-block\" href=\"maintenance.html?locker=" + l.number + "\">"
        + "<i class=\"fa-solid fa-screwdriver-wrench\"></i> Report a problem</a>"
        + (openTickets.length ? "<a class=\"link\" href=\"maintenance.html?ticket=" + openTickets[0].id + "\">"
            + SP.plural(openTickets.length, "open ticket") + " for " + l.number + " · View</a>" : "");

    // "Senior discount", "No discount" ...
    function discountText(discount) {
        return discount === "NONE" ? "No discount" : SP.DISCOUNTS[discount] + " discount";
    }

    // Page heading: breadcrumb, locker number with its status, size and row
    var html = "<div class=\"page-head\"><div>"
        + "<div class=\"crumbs\"><a href=\"lockers.html\">Locker Map</a><i class=\"fa-solid fa-chevron-right\"></i><span>" + l.number + "</span></div>"
        + "<h1><span class=\"mono\">" + l.number + "</span>" + UI.pill(l.css, l.label) + "</h1>"
        + "<p class=\"page-sub\">" + SP.sizeLabel(l.locker.size) + " · Row " + l.locker.row + "</p></div>"
        + "<div class=\"page-actions\"><a class=\"btn btn-secondary\" href=\"lockers.html\"><i class=\"fa-solid fa-arrow-left\"></i> Back to map</a></div></div>";

    // RENTED LOCKER: customer, rental dates, charges, balance, pricing and actions
    if (l.rented) {
        // c = the renter. Counts unpaid rent and late fees, and takes the 12 newest charges for the table.
        // off = how many cents the discount takes off each month.
        var c = b.customer(l.customer.id);
        var unpaidRent = l.unpaid.filter(function (x) { return x.type === "RENT"; }).length;
        var unpaidFees = l.unpaid.length - unpaidRent;
        var charges = SP.chargesFor(l.rental.id).slice(0, 12);
        var r = l.rental;
        var off = r.baseRate - r.monthlyRate;

        html += "<div class=\"grid grid-main-side\"><div class=\"stack\">"

            // Customer
            + "<section class=\"card\"><div class=\"card-head\"><div class=\"profile-head\">"
            + "<span class=\"avatar avatar-lg\">" + SP.initials(c.name) + "</span>"
            + "<div><h2>" + e(c.name) + "</h2><p class=\"muted\">Customer since " + SP.fmtMonthYear(c.customer.since) + " · "
            + discountText(c.customer.discount) + "</p></div></div>"
            + "<a class=\"btn btn-secondary btn-sm\" href=\"customers.html?id=" + c.id + "\">Open profile</a></div>"
            + "<div class=\"dl\">"
            + "<div class=\"dl-row\"><span>Phone</span><span>" + e(c.customer.phone) + "</span></div>"
            + "<div class=\"dl-row\"><span>Email</span><span>" + e(c.customer.email || "—") + "</span></div>"
            + "<div class=\"dl-row\"><span>Lockers</span><span class=\"mono\">" + c.lockerNumbers + "</span></div>"
            + "</div></section>"

            // Rental dates
            + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-regular fa-calendar\"></i>Rental</span></div><div class=\"dl\">"
            + "<div class=\"dl-row\"><span>Move-in date</span><span>" + SP.fmtDate(r.moveIn) + "</span></div>"
            + "<div class=\"dl-row\"><span>Rent charged</span><span>On the " + SP.ordinal(r.chargeDay) + " of each month</span></div>"
            + (l.oldestUnpaid ? "<div class=\"dl-row\"><span>Oldest unpaid charge</span><strong" + (l.daysOverdue ? " class=\"text-od\"" : "") + ">"
                + SP.fmtDate(l.oldestUnpaid) + " · " + (l.daysOverdue ? SP.days(l.daysOverdue) + " ago" : "due today") + "</strong></div>" : "")
            + "<div class=\"dl-row\"><span>Next charge</span><span>" + SP.fmtDate(l.nextCharge) + "</span></div>"
            + (r.plannedMoveOut ? "<div class=\"dl-row\"><span>Planned move-out</span><span>" + SP.fmtDate(r.plannedMoveOut) + "</span></div>" : "")
            + "</div></section>"

            // Charges
            + "<section class=\"card card-flush\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-receipt\"></i>Charges</span>"
            + "<span class=\"card-sub\">Oldest unpaid charge is paid first</span></div>"
            + "<table class=\"table\"><thead><tr><th>Date</th><th>Item</th><th class=\"num\">Amount</th><th>Status</th></tr></thead><tbody>"
            // One table row per charge, with a green Paid, amber part-paid or red Unpaid label
            + charges.map(function (ch) {
                var state = ch.paid >= ch.amount ? UI.pill("s-av", "Paid " + SP.fmtShort(ch.paidOn))
                    : ch.paid > 0 ? UI.pill("s-rs", SP.money(ch.amount - ch.paid) + " left")
                    : UI.pill("s-od", "Unpaid");
                return "<tr class=\"trow\"><td>" + SP.fmtDate(ch.due) + "</td><td>" + (ch.type === "RENT" ? "Monthly rent" : "Late fee")
                    + "</td><td class=\"num\">" + SP.money(ch.amount) + "</td><td>" + state + "</td></tr>";
            }).join("")
            + "</tbody></table></section>"
            + "</div><div class=\"stack\">"

            // Balance
            + "<div class=\"balance-box" + (l.daysOverdue ? " s-od" : "") + "\"><span class=\"label\">Balance</span>"
            + "<span class=\"balance-amount\">" + SP.money(l.balance) + "</span>"
            + (l.daysOverdue ? "<span class=\"balance-note\"><i class=\"fa-solid fa-triangle-exclamation\"></i>" + SP.days(l.daysOverdue)
                + " overdue · " + SP.plural(unpaidRent, "rent charge") + " + " + SP.plural(unpaidFees, "late fee") + "</span>" : "")
            + (l.dueToday ? "<span class=\"balance-note\"><i class=\"fa-solid fa-calendar-day\"></i>Rent due today</span>" : "")
            + (l.balance === 0 ? "<span class=\"balance-note\"><i class=\"fa-solid fa-circle-check\"></i>Paid up</span>" : "")
            + (l.balance > 0 ? "<a class=\"btn btn-primary\" href=\"payments.html?customer=" + c.id + "\"><i class=\"fa-solid fa-cash-register\"></i> Take payment</a>" : "")
            + "</div>"

            // Pricing
            + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-tag\"></i>Pricing</span></div><div class=\"dl\">"
            + "<div class=\"dl-row\"><span>Base price (" + SP.SIZES[l.locker.size].label + ")</span><span>" + SP.money(r.baseRate) + "</span></div>"
            + (r.discount !== "NONE" ? "<div class=\"dl-row\"><span>" + SP.DISCOUNTS[r.discount] + " discount ("
                + Math.round(off * 100 / r.baseRate) + "%)</span><span>" + SP.money(-off) + "</span></div>" : "")
            + "<div class=\"dl-row dl-total\"><span>Monthly rate</span><span>" + SP.money(r.monthlyRate) + "</span></div></div>"
            + "<p class=\"note\"><i class=\"fa-solid fa-lock\"></i><span>This rental keeps the rate it started with. Price changes in Settings apply to new rentals only.</span></p>"
            + "</section>"

            // Actions
            + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-bolt\"></i>Actions</span></div>"
            + "<button class=\"btn btn-secondary btn-block\" type=\"button\" id=\"move-out\"" + (l.balance > 0 ? " disabled" : "")
            + "><i class=\"fa-solid fa-right-from-bracket\"></i> Move out</button>"
            + (l.balance > 0 ? "<p class=\"help\">Move out needs a $0.00 balance. This locker owes " + SP.money(l.balance) + ".</p>" : "")
            + reportButton
            + "<p class=\"help\">A rented locker stays in service while it's being fixed.</p>"
            + "</section></div></div>";
    // OPEN, ON-HOLD OR IN-REPAIR LOCKER: its details, a hold form (open lockers only) and actions
    } else {
        var reserved = l.status === "RESERVED";
        var fixing = l.status === "MAINTENANCE";
        html += "<div class=\"grid grid-main-side\"><div class=\"stack\">"
            + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-box-open\"></i>This locker</span></div><div class=\"dl\">"
            + "<div class=\"dl-row\"><span>Size</span><span>" + SP.sizeLabel(l.locker.size) + "</span></div>"
            + "<div class=\"dl-row\"><span>Price for new rentals</span><span>" + SP.money(b.settings.base[l.locker.size]) + "/mo</span></div>"
            + "<div class=\"dl-row\"><span>Status</span><span>" + e(l.footer) + "</span></div>"
            + (reserved ? "<div class=\"dl-row\"><span>Held for</span><strong>" + e(l.locker.holdFor) + "</strong></div>"
                + "<div class=\"dl-row\"><span>Hold until</span><span>" + SP.fmtDate(l.locker.holdUntil) + "</span></div>" : "")
            + (fixing ? "<div class=\"dl-row\"><span>Issue</span><strong>" + e(l.locker.maintenanceNote) + "</strong></div>" : "")
            + "</div></section>"
            + (l.status === "AVAILABLE"
                ? "<form class=\"card\" id=\"hold-form\" novalidate><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-clock\"></i>Hold for someone</span>"
                + "<span class=\"card-sub\">Up to 14 days</span></div><div class=\"form-row\">"
                + "<div class=\"field\"><label for=\"hold-for\">Name</label><input class=\"input\" id=\"hold-for\" name=\"holdFor\" required></div>"
                + "<div class=\"field\"><label for=\"hold-until\">Hold until</label><input class=\"input\" id=\"hold-until\" name=\"until\" type=\"date\" value=\""
                + SP.addDays(b.today, 3) + "\" min=\"" + b.today + "\" max=\"" + SP.addDays(b.today, 14) + "\" required></div></div>"
                + "<div class=\"form-actions\"><button class=\"btn btn-secondary\" type=\"submit\">Place hold</button></div></form>"
                : "")
            + "</div><div class=\"stack\">"
            + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-bolt\"></i>Actions</span></div>"
            + (l.status === "AVAILABLE" ? "<a class=\"btn btn-primary btn-block\" href=\"new-rental.html?locker=" + l.number
                + "\"><i class=\"fa-solid fa-file-signature\"></i> Start rental</a>" : "")
            + (reserved ? "<a class=\"btn btn-primary btn-block\" href=\"" + UI.url("new-rental.html", { locker: l.number, name: l.locker.holdFor })
                + "\"><i class=\"fa-solid fa-file-signature\"></i> Start rental for " + e(l.locker.holdFor) + "</a>"
                + "<button class=\"btn btn-secondary btn-block\" type=\"button\" id=\"release\"><i class=\"fa-solid fa-unlock\"></i> Release hold</button>" : "")
            + (fixing ? "<button class=\"btn btn-primary btn-block\" type=\"button\" id=\"repaired\"><i class=\"fa-solid fa-circle-check\"></i> Mark as fixed</button>" : "")
            + reportButton
            + "<p class=\"help\">A locker in maintenance can't be rented until its ticket is resolved or it's marked as fixed.</p>"
            + "</section></div></div>";
    }

    // Puts the finished HTML inside <main id="page"> in locker.html, then wires up the buttons below
    document.getElementById("page").innerHTML = html;

    // Shows the result: reloads with a message, or an error inside the card
    function done(result, success, card, field, undoable) {
        if (result.error) {
            UI.formError(card, result.error, field);
            return;
        }
        UI.go(here, success, "ok", undoable);
    }

    // Adds a click/submit handler only if that button is on the page (each status shows different buttons)
    function on(id, type, handler) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener(type, handler);
        }
    }

    // The card a button sits in (where an error message is shown)
    function cardOf(el) {
        return el.closest(".card");
    }

    // Move out: asks first, saves an Undo copy, ends the rental (SP.moveOut), then reloads with an Undo button
    on("move-out", "click", function (event) {
        var card = cardOf(event.currentTarget);
        var lastLocker = b.customer(l.customer.id).lockers.length === 1;
        UI.confirm({
            title: "Move " + l.customer.name + " out of " + l.number + "?",
            message: l.number + " becomes available to rent right away.",
            detail: lastLocker ? "This is their last locker, so their online account will close. Their file and payment history are kept." : "",
            confirm: "Move out", cancel: "Keep renting", danger: true, icon: "fa-right-from-bracket"
        }).then(function (yes) {
            if (!yes) {
                return;
            }
            var before = SP.snapshot();
            var result = SP.moveOut(l.number, staff.name);
            if (result.ok) {
                SP.offerUndo("move-out of " + l.number, before);
            }
            done(result, l.number + " moved out. It's ready to rent."
                + (result.accountClosed ? " " + l.customer.name + "'s online account is closed; their file is kept." : ""), card, null, true);
        });
    });
    // Release hold: the locker goes back to open
    on("release", "click", function (event) {
        done(SP.releaseHold(l.number, staff.name), "Hold on " + l.number + " released.", cardOf(event.currentTarget));
    });
    // Mark as fixed: the locker leaves maintenance and can be rented again
    on("repaired", "click", function (event) {
        done(SP.finishMaintenance(l.number, staff.name), l.number + " is ready to rent.", cardOf(event.currentTarget));
    });
    // Hold form: keeps the locker for a person until a date (up to 14 days). A red error points at the field to fix.
    on("hold-form", "submit", function (event) {
        event.preventDefault();
        var form = event.target;
        var data = UI.formData(form);
        var result = SP.hold(l.number, data.holdFor, data.until, staff.name);
        var field = result.error && /held for/.test(result.error) ? "holdFor" : result.error && /14 days/.test(result.error) ? "until" : null;
        done(result, l.number + " is on hold for " + (data.holdFor || "").trim() + ".", form, field);
    });
})();
