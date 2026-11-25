/* StoragePro - lockers.js
   Locker map page with row, size and status filters. */
(function () {
    "use strict";
    // Draws the sidebar and top bar; stops if nobody is signed in
    if (!UI.start("lockers")) {
        return;
    }
    // e() makes text safe for HTML. b = every locker with its status worked out (SP.board).
    var e = UI.esc;
    var b = SP.board();

    // The filters picked, read from the address (lockers.html?row=B&size=m&status=overdue).
    // null = no filter.
    var row = (UI.param("row") || "").toUpperCase() || null;
    var size = SP.sizeFromCode(UI.param("size"));
    var status = (UI.param("status") || "").toUpperCase();
    status = SP.STATUS[status] ? status : null;

    // Builds a filter link that keeps the other filters
    function link(newRow, newSize, newStatus) {
        return UI.url("lockers.html", {
            row: newRow,
            size: newSize ? SP.SIZES[newSize].code : null,
            status: newStatus ? newStatus.toLowerCase() : null
        });
    }

    // HTML for one filter button. "on" highlights the filter in use.
    function chip(on, href, inner) {
        return "<a class=\"chip" + (on ? " on" : "") + "\" href=\"" + href + "\">" + inner + "</a>";
    }

    // HTML for one locker square on the map, with a hover card that shows its details.
    // What the hover card lists depends on the status (renter and balance, hold, repair, or price).
    function tile(l) {
        var rows = "<span class=\"hovercard-row\"><span>Size</span><span>" + SP.sizeLabel(l.locker.size) + "</span></span>";
        if (l.rented) {
            rows += "<span class=\"hovercard-row\"><span>Customer</span><span>" + e(l.customer.name) + "</span></span>"
                + "<span class=\"hovercard-row\"><span>Rate</span><span>" + SP.money(l.rental.monthlyRate) + "/mo</span></span>"
                + "<span class=\"hovercard-row\"><span>Balance</span><span>" + SP.money(l.balance) + "</span></span>";
        } else if (l.status === "RESERVED") {
            rows += "<span class=\"hovercard-row\"><span>Hold for</span><span>" + e(l.locker.holdFor) + "</span></span>"
                + "<span class=\"hovercard-row\"><span>Hold until</span><span>" + SP.fmtShort(l.locker.holdUntil) + "</span></span>";
        } else if (l.status === "MAINTENANCE") {
            rows += "<span class=\"hovercard-row\"><span>Issue</span><span>" + e(l.locker.maintenanceNote) + "</span></span>";
        } else {
            rows += "<span class=\"hovercard-row\"><span>Price</span><span>" + SP.money(b.settings.base[l.locker.size]) + "/mo</span></span>";
        }
        return "<a class=\"tile " + l.css + "\" href=\"locker.html?n=" + l.number + "\">"
            + "<span class=\"tile-num\">" + l.number + "</span>"
            + "<span class=\"tile-sub\">" + e(l.tileSub) + "</span>"
            + "<span class=\"size-tag size-" + SP.SIZES[l.locker.size].code + "\" title=\"" + SP.sizeLabel(l.locker.size) + "\">"
            + SP.SIZES[l.locker.size].short + "</span>"
            + (l.icon ?"<i class=\"tile-icon fa-solid " + l.icon + "\"></i>" : "")
            + "<span class=\"hovercard\">"
            + "<span class=\"hovercard-head\"><strong class=\"mono\">" + l.number + "</strong>" + UI.pill(l.css, l.label) + "</span>"
            + rows
            + "<span class=\"hovercard-foot\">" + e(l.footer) + "</span>"
            + "</span></a>";
    }

    // Page heading with the color legend
    var html = "<div class=\"page-head\"><div><h1>Locker Map</h1>"
        + "<p class=\"page-sub\">" + b.lockers.length + " lockers in rows A–D · " + b.rented + " rented · hover a locker for details</p></div>"
        + "<div class=\"page-actions\">" + UI.legend() + "</div></div>"

        // Filter chips
        + "<section class=\"card\">"
        + "<div class=\"chips\"><span class=\"chip-label\">Row</span>" + chip(!row, link(null, size, status), "All")
        + SP.ROWS.map(function (r) { return chip(row === r, link(r, size, status), "Row " + r); }).join("") + "</div>"
        + "<div class=\"chips\"><span class=\"chip-label\">Size</span>" + chip(!size, link(row, null, status), "All")
        + SP.SIZE_ORDER.map(function (s) {
            return chip(size === s, link(row, s, status), "<span class=\"size-tag size-" + SP.SIZES[s].code + "\">" + SP.SIZES[s].short
                + "</span>" + SP.sizeLabel(s) + " <span class=\"count\">" + b.countSize(s) + "</span>");
        }).join("") + "</div>"
        + "<div class=\"chips\"><span class=\"chip-label\">Status</span>"
        + chip(!status, link(row, size, null), "All <span class=\"count\">" + b.lockers.length + "</span>")
        + SP.STATUS_ORDER.map(function (s) {
            return chip(status === s, link(row, size, s), "<i class=\"swatch " + SP.STATUS[s].css + "\"></i>" + SP.STATUS[s].label
                + " <span class=\"count\">" + b.count(s) + "</span>");
        }).join("") + "</div>"
        + "</section>";

    // One section per row
    // Each row is one size (row A = Small, and so on), so a size filter also picks the row.
    // Rows with nothing left after the filters are skipped.
    var shownAny = false;
    SP.ROWS.forEach(function (r) {
        var rowSize = SP.SIZE_ORDER.filter(function (s) { return SP.SIZES[s].row === r; })[0];
        if ((row && row !== r) || (size && size !== rowSize)) {
            return;
        }
        var all = b.inRow(r);
        var shown = all.filter(function (l) { return !status || l.status === status; });
        if (!shown.length) {
            return;
        }
        shownAny = true;
        var rented = all.filter(function (l) { return l.rented; }).length;
        var open = all.filter(function (l) { return l.status === "AVAILABLE"; }).length;
        html += "<section class=\"card\"><div class=\"card-head\">"
            + "<span class=\"card-title\">Row " + r + " <span class=\"size-tag size-" + SP.SIZES[rowSize].code + "\">"
            + SP.SIZES[rowSize].short + "</span><span class=\"card-sub\">" + SP.sizeLabel(rowSize) + " · "
            + SP.money(b.settings.base[rowSize]) + "/mo</span></span>"
            + "<span class=\"card-sub\">" + rented + " rented · " + open + " open</span></div>"
            + "<div class=\"tiles\">" + shown.map(tile).join("") + "</div></section>";
    });
    if (!shownAny) {
        html += "<section class=\"card\"><p class=\"empty\">No lockers match these filters. <a class=\"link\" href=\"lockers.html\">Show all</a></p></section>";
    }

    // Puts the finished HTML inside <main id="page"> in lockers.html
    document.getElementById("page").innerHTML = html;
})();
