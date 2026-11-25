/* StoragePro - dashboard.js
   Dashboard page: number cards, mini locker map, today's list and recent activity. */
(function () {
    "use strict";
    // Draws the sidebar and top bar and returns the signed-in staff member (stops if nobody is signed in)
    var staff = UI.start("dashboard");
    if (!staff) {
        return;
    }
    // e() makes text safe for HTML. b = every locker and customer with its status worked out (SP.board).
    // t = today's date as "YYYY-MM-DD".
    var e = UI.esc;
    var b = SP.board();
    var t = b.today;

    // Today's lists: lockers on hold for someone arriving today, rentals ending today,
    // and monthly rent that's due today and not paid yet
    var moveIns = b.lockers.filter(function (l) {
        return l.status === "RESERVED" && l.locker.holdUntil === t;
    });
    var moveOuts = b.lockers.filter(function (l) {
        return l.rented && l.rental.plannedMoveOut === t;
    });
    var due = [];
    b.lockers.forEach(function (l) {
        l.unpaid.forEach(function (c) {
            if (c.type === "RENT" && c.due === t) {
                due.push({ locker: l, charge: c });
            }
        });
    });

    // "Good morning / afternoon / evening" for the heading
    var hour = new Date().getHours();
    var greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    // The whole page is built as one HTML text, then put on the page at the bottom
    var html = ""
        // Page header
        + "<div class=\"page-head\"><div>"
        + "<h1>" + greeting + ", " + e(staff.firstName) + "</h1>"
        + "<p class=\"page-sub\">" + SP.fmtLong(t) + " · " + SP.plural(moveIns.length, "move-in") + ", "
        + SP.plural(moveOuts.length, "move-out") + " and " + SP.plural(due.length, "payment") + " due today</p></div>"
        + "<div class=\"page-actions\">"
        + "<a class=\"btn btn-secondary\" href=\"customers.html?new=1\"><i class=\"fa-solid fa-user-plus\"></i> New customer</a>"
        + "<a class=\"btn btn-secondary\" href=\"payments.html\"><i class=\"fa-solid fa-cash-register\"></i> Take payment</a>"
        + "<a class=\"btn btn-secondary\" href=\"lockers.html\"><i class=\"fa-solid fa-table-cells\"></i> Locker map</a>"
        + "</div></div>"

        // Number cards
        + "<div class=\"grid grid-4\">"
        // Occupancy: percent of lockers rented, with a progress bar
        + "<div class=\"card kpi s-oc\"><span class=\"kpi-label\"><span class=\"kpi-icon\"><i class=\"fa-solid fa-warehouse\"></i></span>Occupancy</span>"
        + "<span class=\"kpi-value\">" + SP.pct(b.occupancyPct) + "</span>"
        + "<div class=\"meter\"><span style=\"width: " + b.occupancyPct + "%\"></span></div>"
        + "<span class=\"kpi-note\">" + b.rented + " of " + b.lockers.length + " lockers rented</span></div>"

        // How many lockers of each size are open
        + "<div class=\"card kpi s-av\"><span class=\"kpi-label\"><span class=\"kpi-icon\"><i class=\"fa-solid fa-box-open\"></i></span>Available by size</span>"
        + "<div class=\"size-counts\">" + SP.SIZE_ORDER.map(function (s) {
            return "<div class=\"size-count\"><strong>" + b.countAvailable(s) + "</strong><span>" + SP.SIZES[s].label + "</span></div>";
        }).join("") + "</div>"
        + "<span class=\"kpi-note\">" + b.count("AVAILABLE") + " open · " + b.count("RESERVED") + " on hold</span></div>"

        // Money owed by all customers
        + "<div class=\"card kpi\"><span class=\"kpi-label\"><span class=\"kpi-icon\"><i class=\"fa-solid fa-sack-dollar\"></i></span>Total owed</span>"
        + "<span class=\"kpi-value\">" + SP.money(b.totalOwed) + "</span>"
        + "<span class=\"kpi-note\">Across " + SP.plural(b.accountsOwing, "account") + ", including today's rent</span></div>"

        // Lockers with rent past due
        + "<div class=\"card kpi s-od\"><span class=\"kpi-label\"><span class=\"kpi-icon\"><i class=\"fa-solid fa-triangle-exclamation\"></i></span>Overdue</span>"
        + "<span class=\"kpi-value\">" + b.count("OVERDUE") + "</span>"
        + "<span class=\"kpi-note\">Lockers past due · " + SP.plural(b.overdueCustomers().length, "customer")
        + " · <a class=\"link\" href=\"customers.html?overdue=true\">View</a></span></div>"
        + "</div>"

        + "<div class=\"grid grid-main-side\">"

        // Mini locker map
        + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-table-cells\"></i>Locker map</span>"
        + "<a class=\"link\" href=\"lockers.html\">Open full map</a></div>"
        + "<div class=\"mini-map\">" + SP.ROWS.map(function (row) {
            // One line per row, with its size badge
            var size = SP.SIZES[b.inRow(row)[0].locker.size];
            return "<div class=\"mini-row\"><span class=\"mini-row-label\">" + row
                + " <span class=\"size-tag size-" + size.code + "\" title=\"" + size.label + " " + size.dims + "\">" + size.short + "</span></span>"
                + b.inRow(row).map(function (l) {
                    return "<a class=\"mini " + l.css + "\" href=\"locker.html?n=" + l.number + "\" title=\"" + l.number + " · "
                        + size.label + " " + size.dims + " · " + l.label + "\">" + size.short + "</a>";
                }).join("") + "</div>";
        }).join("") + "</div>"
        + UI.legend() + "</section>"

        // Today's move-ins, move-outs and payments
        + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-regular fa-calendar-check\"></i>Today</span>"
        + "<span class=\"card-sub\">" + SP.fmtDayDate(t) + "</span></div><div class=\"list\">"

        // Move-ins: each one links to New Rental with the locker and name filled in
        + "<span class=\"list-group-title\">Move-ins <span>" + moveIns.length + "</span></span>"
        + moveIns.map(function (l) {
            return "<a class=\"list-item\" href=\"" + UI.url("new-rental.html", { locker: l.number, name: l.locker.holdFor }) + "\">"
                + "<span class=\"list-icon s-rs\"><i class=\"fa-solid fa-right-to-bracket\"></i></span>"
                + "<span class=\"list-main\"><span class=\"list-title\">" + e(l.locker.holdFor) + "</span>"
                + "<span class=\"list-meta\">" + l.number + " · " + SP.sizeLabel(l.locker.size) + " · on hold</span></span>"
                + "<span class=\"list-end\"><span class=\"btn btn-secondary btn-sm\">Start rental</span></span></a>";
        }).join("") + (moveIns.length ? "" : "<p class=\"list-meta\">No move-ins today.</p>")

        // Move-outs: each one links to the locker's page
        + "<span class=\"list-group-title\">Move-outs <span>" + moveOuts.length + "</span></span>"
        + moveOuts.map(function (l) {
            return "<a class=\"list-item\" href=\"locker.html?n=" + l.number + "\">"
                + "<span class=\"list-icon s-oc\"><i class=\"fa-solid fa-right-from-bracket\"></i></span>"
                + "<span class=\"list-main\"><span class=\"list-title\">" + e(l.customer.name) + "</span>"
                + "<span class=\"list-meta\">" + l.number + " · " + SP.sizeLabel(l.locker.size) + "</span></span>"
                + "<span class=\"list-end\"><strong>" + SP.money(l.balance) + "</strong><span class=\"list-meta\">balance</span></span></a>";
        }).join("") + (moveOuts.length ? "" : "<p class=\"list-meta\">No move-outs today.</p>")

        // Payments due: each one links to Payments with the customer picked
        + "<span class=\"list-group-title\">Payments due <span>" + due.length + "</span></span>"
        + due.map(function (d) {
            return "<a class=\"list-item\" href=\"payments.html?customer=" + d.locker.customer.id + "\">"
                + "<span class=\"list-icon s-av\"><i class=\"fa-solid fa-dollar-sign\"></i></span>"
                + "<span class=\"list-main\"><span class=\"list-title\">" + e(d.locker.customer.name) + "</span>"
                + "<span class=\"list-meta\">" + d.locker.number + " · monthly rent</span></span>"
                + "<span class=\"list-end\"><strong>" + SP.money(d.charge.amount - d.charge.paid) + "</strong><span class=\"list-meta\">due today</span></span></a>";
        }).join("") + (due.length ? "" : "<p class=\"list-meta\">Nothing due today.</p>")
        + "</div></section></div>"

        // Recent activity
        + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-clock-rotate-left\"></i>Recent activity</span></div>"
        + "<div class=\"list\">" + (SP.recentActivity().length ? "" : "<p class=\"empty\">Nothing yet. Rentals, payments and locker changes show up here.</p>")
        + SP.recentActivity().map(function (a) {
            return "<a class=\"list-item\" href=\"" + e(a.link) + "\">"
                + "<span class=\"list-icon " + a.status + "\"><i class=\"fa-solid fa-" + a.icon + "\"></i></span>"
                + "<span class=\"list-main\"><span class=\"list-title\">" + e(a.title) + "</span><span class=\"list-meta\">" + e(a.meta) + "</span></span>"
                + "<span class=\"list-end\"><span class=\"list-meta\">" + SP.fmtWhen(a.at) + "</span></span></a>";
        }).join("") + "</div></section>";

    // Puts the finished HTML inside <main id="page"> in dashboard.html
    document.getElementById("page").innerHTML = html;
})();
