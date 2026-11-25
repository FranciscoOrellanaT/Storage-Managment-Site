/* StoragePro - reports.js
   Reports page (managers only): revenue, occupancy, discounts and overdue balances. */
(function () {
    "use strict";
    // Draws the sidebar and top bar; clerks are sent back to the Dashboard
    if (!UI.start("reports", { managerOnly: true })) {
        return;
    }
    // How far back the charts go (reports.html?months=6 or 12), and the numbers for them from SP.report()
    var months = UI.param("months") === "6" ? 6 : 12;
    var b = SP.board();
    var r = SP.report(b, months);

    // HTML for a column chart. Each bar's height is its percent of the tallest one (bar.pct).
    // The current month's column is highlighted.
    function bars(list, css, valueText) {
        return "<div class=\"chart\">" + list.map(function (bar) {
            return "<div class=\"bar-col" + (bar.current ? " on" : "") + "\"><span class=\"bar-value\">" + valueText(bar) + "</span>"
                + "<span class=\"bar-track\"><span class=\"bar " + css + "\" style=\"height: " + bar.pct + "%\"></span></span>"
                + "<span class=\"bar-label\">" + bar.label + "</span></div>";
        }).join("") + "</div>";
    }

    // HTML for a sideways bar chart (discount usage, aging balances). Width = bar.pct.
    function hbars(list, css) {
        return "<div class=\"hbars\">" + list.map(function (h) {
            return "<div class=\"hbar\"><span class=\"hbar-label\">" + h.label + "</span>"
                + "<span class=\"hbar-track\"><span class=\"hbar-fill " + css + "\" style=\"width: " + h.pct + "%\"></span></span>"
                + "<span class=\"hbar-value\"><strong>" + h.value + "</strong><span>" + h.note + "</span></span></div>";
        }).join("") + "</div>";
    }

    // Draws the page: heading with 6/12-month switch and Print, then the four chart cards
    document.getElementById("page").innerHTML = "<div class=\"page-head\"><div><h1>Reports</h1>"
        + "<p class=\"page-sub\">Manager only · " + r.range + "</p></div>"
        + "<div class=\"page-actions\"><div class=\"chips\">"
        + "<a class=\"chip" + (months === 6 ? " on" : "") + "\" href=\"reports.html?months=6\">6 months</a>"
        + "<a class=\"chip" + (months === 12 ? " on" : "") + "\" href=\"reports.html?months=12\">12 months</a></div>"
        + "<button class=\"btn btn-secondary\" type=\"button\" data-action=\"print\"><i class=\"fa-solid fa-print\"></i> Print</button></div></div>"
        + "<div class=\"grid grid-2\">"
        + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-sack-dollar\"></i>Revenue by month</span>"
        + "<span class=\"card-sub\">This month: <strong>" + SP.money(r.revenueThisMonth) + "</strong></span></div>"
        + bars(r.revenue, "s-oc", function (bar) { return SP.wholeMoney(bar.value); }) + "</section>"
        + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-warehouse\"></i>Occupancy trend</span>"
        + "<span class=\"card-sub\">Today: <strong>" + SP.pct(b.occupancyPct) + "</strong></span></div>"
        + bars(r.occupancy, "s-av", function (bar) { return bar.value + "%"; }) + "</section>"
        + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-percent\"></i>Discount usage</span>"
        + "<span class=\"card-sub\">" + SP.plural(r.activeRentals, "active rental") + "</span></div>" + hbars(r.discounts, "s-rs") + "</section>"
        + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-hourglass-half\"></i>Aging balances</span>"
        + "<span class=\"card-sub\">Overdue: <strong>" + SP.money(r.overdueTotal) + "</strong></span></div>" + hbars(r.aging, "s-od") + "</section>"
        + "</div>";
})();
