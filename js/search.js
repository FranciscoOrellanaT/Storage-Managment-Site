/* StoragePro - search.js
   Search results page: finds customers and lockers. */
(function () {
    "use strict";
    // Draws the sidebar and top bar; stops if nobody is signed in
    if (!UI.start("search")) {
        return;
    }
    // e() makes text safe for HTML. b = every locker and customer with their status worked out.
    // q = the search words from the address (search.html?q=...)
    var e = UI.esc;
    var b = SP.board();
    var q = (UI.param("q") || "").trim();
    var needle = q.toLowerCase();

    // Customers that match by name, email, phone or locker number
    var customers = needle ? b.customers.filter(function (c) { return UI.matchCustomer(c, needle); }) : [];
    // Lockers that match by number, renter's name, or the name it's held for
    var lockers = needle ? b.lockers.filter(function (l) {
        return l.number.toLowerCase().indexOf(needle) >= 0
            || (l.rented && l.customer.name.toLowerCase().indexOf(needle) >= 0)
            || (l.locker.holdFor && l.locker.holdFor.toLowerCase().indexOf(needle) >= 0);
    }) : [];

    // Only one match: open it
    if (customers.length + lockers.length === 1) {
        window.location.replace(customers.length ? "customers.html?id=" + customers[0].id : "locker.html?n=" + lockers[0].number);
        return;
    }

    // Draws the page: heading, search box, then two cards (customers found, lockers found)
    document.getElementById("page").innerHTML = "<div class=\"page-head\"><div><h1>Search results</h1>"
        + "<p class=\"page-sub\">" + (q ? SP.plural(customers.length, "customer") + " and " + SP.plural(lockers.length, "locker")
            + " match “" + e(q) + "”" : "Type a name, phone, email or locker number.") + "</p></div></div>"
        + "<form class=\"card\" method=\"get\" action=\"search.html\"><div class=\"row\"><div class=\"search\" style=\"max-width: none\">"
        + "<i class=\"fa-solid fa-magnifying-glass\"></i><input class=\"input\" type=\"search\" name=\"q\" value=\"" + e(q)
        + "\" placeholder=\"Name, phone, email or locker number\" autofocus></div>"
        + "<button class=\"btn btn-primary\" type=\"submit\">Search</button></div></form>"
        + "<div class=\"grid grid-2\">"
        + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-users\"></i>Customers</span>"
        + "<span class=\"card-sub\">" + customers.length + "</span></div><div class=\"list\">"
        // One row per customer: initials, name, phone, lockers, balance and status
        + customers.map(function (c) {
            return "<a class=\"list-item\" href=\"customers.html?id=" + c.id + "\"><span class=\"avatar\">" + SP.initials(c.name) + "</span>"
                + "<span class=\"list-main\"><span class=\"list-title\">" + e(c.name) + "</span><span class=\"list-meta\">" + e(c.customer.phone)
                + " · <span class=\"mono\">" + c.lockerNumbers + "</span></span></span>"
                + "<span class=\"list-end\"><strong>" + SP.money(c.balance) + "</strong>" + UI.pill(c.statusCss, c.statusLabel) + "</span></a>";
        }).join("") + (customers.length ? "" : "<p class=\"empty\">No customers match.</p>") + "</div></section>"
        + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-box\"></i>Lockers</span>"
        + "<span class=\"card-sub\">" + lockers.length + "</span></div><div class=\"list\">"
        // One row per locker: number, size, who has it, and status
        + lockers.map(function (l) {
            return "<a class=\"list-item\" href=\"locker.html?n=" + l.number + "\"><span class=\"list-icon " + l.css + "\"><i class=\"fa-solid fa-box\"></i></span>"
                + "<span class=\"list-main\"><span class=\"list-title mono\">" + l.number + "</span><span class=\"list-meta\">"
                + SP.sizeLabel(l.locker.size) + " · " + e(l.rented ? l.customer.name : l.footer) + "</span></span>"
                + "<span class=\"list-end\">" + UI.pill(l.css, l.label) + "</span></a>";
        }).join("") + (lockers.length ? "" : "<p class=\"empty\">No lockers match.</p>") + "</div></section>"
        + "</div>";
})();
