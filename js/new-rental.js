/* StoragePro - new-rental.js
   New rental in four steps: customer, locker, discount, review.
   The choices from each step are kept in the page address. */
(function () {
    "use strict";
    // Draws the sidebar and top bar and returns the signed-in staff member (stops if nobody is signed in)
    var staff = UI.start("rental");
    if (!staff) {
        return;
    }
    // e() makes text safe for HTML. b = every locker and customer worked out; s = current prices and discounts.
    var e = UI.esc;
    var b = SP.board();
    var s = b.settings;

    // Choices made so far
    var w = {
        step: Math.max(1, Math.min(4, parseInt(UI.param("step"), 10) || 1)),
        customerId: UI.param("customerId") || null,
        name: (UI.param("name") || "").trim() || null,
        phone: (UI.param("phone") || "").trim() || null,
        email: (UI.param("email") || "").trim() || null,
        size: SP.sizeFromCode(UI.param("size")),
        locker: (UI.param("locker") || "").trim().toUpperCase() || null,
        discount: SP.DISCOUNTS[UI.param("discount")] ? UI.param("discount") : null
    };
    // A typed-in new customer replaces any customer picked from the list
    if (w.name) {
        w.customerId = null;
    }
    // q = search words for the customer list; "find" in the address jumps back to step 1.
    // error = a message to show at the top of the step (null = none).
    var q = UI.param("q") || "";
    if (UI.param("find") !== null) {
        w.step = 1;
    }
    var error = null;

    // Checks the chosen locker can still be rented
    var chosen = b.locker(w.locker);
    if (w.locker && (!chosen || (chosen.status !== "AVAILABLE" && chosen.status !== "RESERVED"))) {
        error = w.locker + " can't be rented right now. Choose another locker.";
        w.locker = null;
        chosen = null;
    }
    if (chosen) {
        w.size = chosen.locker.size;
    }

    // The existing customer picked (null for a new customer). Step 3 starts on the discount saved on their file.
    var customer = b.customer(w.customerId);
    if (w.customerId && !customer) {
        w.customerId = null;
    }
    if (!w.discount && customer && w.step >= 3) {
        w.discount = customer.customer.discount;
    }
    var hasCustomer = !!(customer || w.name);

    // Goes back to the first step that is missing something
    if (w.step >= 2 && !hasCustomer) {
        error = "Choose a customer or add a new one.";
        w.step = 1;
    } else if (w.step >= 2 && w.name && !w.phone) {
        error = "Add a phone number for the new customer.";
        w.step = 1;
    } else if (w.step >= 3 && !chosen) {
        error = error || "Choose a locker.";
        w.step = 2;
    } else if (w.step >= 4 && !w.discount) {
        error = "Choose a discount (or None).";
        w.step = 3;
    }

    // All the choices as address values, with some changed (used to build links between steps)
    function params(changes) {
        var p = {
            customerId: w.customerId, name: w.name, phone: w.phone, email: w.email,
            size: w.size ? SP.SIZES[w.size].code : null, locker: w.locker, discount: w.discount
        };
        Object.keys(changes || {}).forEach(function (k) {
            p[k] = changes[k];
        });
        return p;
    }

    // Link to a step with the choices so far, e.g. new-rental.html?step=3&customerId=7&locker=B-203
    function stepUrl(step, changes) {
        var p = params(changes);
        p.step = step;
        return UI.url("new-rental.html", p);
    }

    // Hidden inputs that carry the earlier choices
    function hidden(except) {
        var p = params();
        return Object.keys(p).filter(function (k) {
            return p[k] && except.indexOf(k) < 0;
        }).map(function (k) {
            return "<input type=\"hidden\" name=\"" + k + "\" value=\"" + e(p[k]) + "\">";
        }).join("");
    }

    // Values for the step tabs and the price summary. base and rate are in cents.
    var customerName = customer ? customer.name : w.name;
    var base = w.size ? s.base[w.size] : null;
    var rate = w.size ? SP.rateFor(w.size, w.discount || "NONE") : null;
    var subtitles = ["Choose a customer", "Choose a locker", "Choose a discount", "Review and create"];

    // HTML for one step tab: number (or a check mark when done), title and what was chosen
    function stepTab(n, title, small, done) {
        var css = w.step === n ? " on" : done ? " done" : "";
        return "<a class=\"step" + css + "\" href=\"" + stepUrl(n) + "\"><span class=\"step-num\">"
            + (done && w.step !== n ? "<i class=\"fa-solid fa-check\"></i>" : n) + "</span>"
            + "<span>" + title + "<small>" + e(small) + "</small></span></a>";
    }

    // Page heading, then the four step tabs
    var html = "<div class=\"page-head\"><div><h1>New Rental</h1>"
        + "<p class=\"page-sub\">Step " + w.step + " of 4 · " + subtitles[w.step - 1] + "</p></div>"
        + "<div class=\"page-actions\"><a class=\"btn btn-ghost\" href=\"dashboard.html\">Cancel</a></div></div>"

        + "<nav class=\"steps\">"
        + stepTab(1, "Customer", customerName || "Who is renting?", hasCustomer && w.step > 1)
        + stepTab(2, "Locker", chosen ? chosen.number + " · " + SP.sizeLabel(chosen.locker.size) : "Choose size and locker", !!chosen && w.step > 2)
        + stepTab(3, "Discount", w.discount && w.step > 3 ? SP.DISCOUNTS[w.discount] : "One per customer", !!w.discount && w.step > 3)
        + stepTab(4, "Review", "Confirm and create", false)
        + "</nav>"
        + "<div class=\"grid grid-main-side\"><div class=\"stack\">";

    if (w.step === 1) {
        // Step 1: pick a customer
        // Shows up to 9 customers that match the search (the picked one always stays in the list)
        var needle = q.trim().toLowerCase();
        var options = b.customers.filter(function (c) {
            return !needle || UI.matchCustomer(c, needle);
        }).slice(0, 9);
        if (customer && options.indexOf(customer) < 0) {
            options.unshift(customer);
        }
        html += "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-user\"></i>Who is renting?</span></div>"
            + "<form class=\"search\" method=\"get\" action=\"new-rental.html\" style=\"max-width: none\">"
            + "<i class=\"fa-solid fa-magnifying-glass\"></i>"
            + "<input class=\"input\" type=\"search\" name=\"q\" value=\"" + e(q) + "\" placeholder=\"Find a customer by name, phone or locker\">"
            + "<input type=\"hidden\" name=\"step\" value=\"1\">" + hidden(["customerId"]) + "</form>"
            + "<form class=\"stack\" method=\"get\" action=\"new-rental.html\">"
            + "<input type=\"hidden\" name=\"step\" value=\"2\">" + hidden(["customerId", "name", "phone", "email"])
            + "<div class=\"options\">" + options.map(function (c) {
                return "<label class=\"option\"><input type=\"radio\" name=\"customerId\" value=\"" + c.id + "\""
                    + (customer && customer.id === c.id ? " checked" : "") + ">"
                    + "<i class=\"option-check fa-solid fa-circle-check\"></i>"
                    + "<span class=\"option-title\">" + e(c.name) + "</span>"
                    + "<span class=\"option-meta\">" + e(c.customer.phone) + " · " + SP.plural(c.lockers.length, "locker") + "</span></label>";
            }).join("") + "</div>"
            + (options.length ? "" : "<p class=\"list-meta\">No customers match. Add them below.</p>")
            + "<span class=\"label\">Or add a new customer</span><div class=\"form-row\">"
            + "<div class=\"field\"><label for=\"new-name\">Full name</label><input class=\"input\" id=\"new-name\" name=\"name\" value=\"" + e(w.name || "") + "\"></div>"
            + "<div class=\"field\"><label for=\"new-phone\">Phone</label><input class=\"input\" id=\"new-phone\" name=\"phone\" value=\"" + e(w.phone || "") + "\"></div>"
            + "<div class=\"field\"><label for=\"new-email\">Email</label><input class=\"input\" id=\"new-email\" name=\"email\" type=\"email\" value=\"" + e(w.email || "") + "\"></div>"
            + "</div><p class=\"help\">A name typed here is used instead of the customer picked above.</p>"
            + "<div class=\"wizard-nav\"><span></span><button class=\"btn btn-primary\" type=\"submit\">Continue <i class=\"fa-solid fa-arrow-right\"></i></button></div>"
            + "</form></section>";
    }

    if (w.step === 2) {
        // Step 2: pick a locker
        // Open lockers of the chosen size (plus the one already chosen, which may be on hold for this person)
        var picks = !w.size ? [] : b.lockers.filter(function (l) {
            return l.locker.size === w.size && (l.status === "AVAILABLE" || l === chosen);
        });
        html += "<form class=\"stack\" method=\"get\" action=\"new-rental.html\">"
            + "<input type=\"hidden\" name=\"step\" value=\"3\">" + hidden(["locker"])
            + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-ruler-combined\"></i>Size</span>"
            + "<span class=\"card-sub\">Base price per month</span></div><div class=\"options\">"
            + SP.SIZE_ORDER.map(function (size) {
                return "<a class=\"option" + (w.size === size ? " on" : "") + "\" href=\""
                    + stepUrl(2, { size: SP.SIZES[size].code, locker: w.size === size ? w.locker : null }) + "\">"
                    + "<i class=\"option-check fa-solid fa-circle-check\"></i>"
                    + "<span class=\"option-title\">" + SP.sizeLabel(size) + "</span>"
                    + "<span class=\"option-price\">" + SP.money(s.base[size]) + "</span>"
                    + "<span class=\"option-meta\">" + b.countAvailable(size) + " open</span></a>";
            }).join("") + "</div></section>"
            + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-box-open\"></i>"
            + (w.size ? "Open " + SP.SIZES[w.size].label + " lockers" : "Open lockers") + "</span>"
            + (w.size ? "<span class=\"card-sub\">" + picks.length + " available</span>" : "") + "</div>"
            + "<div class=\"pick-grid\">" + picks.map(function (l) {
                return "<label class=\"pick " + l.css + "\"><input type=\"radio\" name=\"locker\" value=\"" + l.number + "\""
                    + (chosen && chosen.number === l.number ? " checked" : "") + " required>"
                    + "<span class=\"tile-num\">" + l.number + "</span>"
                    + "<span class=\"tile-sub\">" + (l.status === "RESERVED" ? "Held for " + e(l.locker.holdFor)
                        : "Row " + l.locker.row + " · " + SP.SIZES[l.locker.size].dims) + "</span></label>";
            }).join("") + "</div>"
            + (!w.size ? "<p class=\"list-meta\">Choose a size first.</p>" : "")
            + (w.size && !picks.length ? "<p class=\"list-meta\">No open lockers in this size.</p>" : "")
            + "</section>"
            + "<div class=\"wizard-nav\"><a class=\"btn btn-secondary\" href=\"" + stepUrl(1) + "\"><i class=\"fa-solid fa-arrow-left\"></i> Back</a>"
            + "<button class=\"btn btn-primary\" type=\"submit\"" + (picks.length ? "" : " disabled") + ">Continue <i class=\"fa-solid fa-arrow-right\"></i></button></div>"
            + "</form>";
    }

    if (w.step === 3) {
        // Step 3: discount
        html += "<form class=\"card\" method=\"get\" action=\"new-rental.html\">"
            + "<input type=\"hidden\" name=\"step\" value=\"4\">" + hidden(["discount"])
            + "<div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-percent\"></i>Discount</span>"
            + "<span class=\"card-sub\">One discount per customer</span></div><div class=\"options\">"
            + SP.DISCOUNT_ORDER.map(function (d) {
                var onFile = customer && customer.customer.discount === d ? " · on file" : "";
                return "<label class=\"option\"><input type=\"radio\" name=\"discount\" value=\"" + d + "\"" + (w.discount === d ? " checked" : "") + " required>"
                    + "<i class=\"option-check fa-solid fa-circle-check\"></i>"
                    + "<span class=\"option-title\">" + SP.DISCOUNTS[d] + "</span>"
                    + "<span class=\"option-price\">" + SP.money(SP.rateFor(w.size, d)) + "</span>"
                    + "<span class=\"option-meta\">" + (d === "NONE" ? "Base price" : SP.discountPct(d) + "% off") + onFile + "</span></label>";
            }).join("") + "</div>"
            + "<p class=\"note\"><i class=\"fa-solid fa-circle-info\"></i><span>Pick the highest discount the customer qualifies for. It is saved on their file.</span></p>"
            + "<div class=\"wizard-nav\"><a class=\"btn btn-secondary\" href=\"" + stepUrl(2) + "\"><i class=\"fa-solid fa-arrow-left\"></i> Back</a>"
            + "<button class=\"btn btn-primary\" type=\"submit\">Continue <i class=\"fa-solid fa-arrow-right\"></i></button></div>"
            + "</form>";
    }

    if (w.step === 4) {
        // Step 4: review and create
        html += "<form class=\"card\" id=\"create-form\" novalidate>"
            + "<div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-clipboard-check\"></i>Review</span></div>"
            + "<div class=\"form-row\">"
            + "<div class=\"field\"><label for=\"move-in\">Move-in date</label><input class=\"input\" id=\"move-in\" name=\"moveIn\" type=\"date\" value=\""
            + b.today + "\" min=\"" + b.today + "\" max=\"" + SP.addDays(b.today, 30) + "\" required></div>"
            + "<div class=\"field\"><span class=\"label\">First payment</span><div class=\"seg\">"
            + Object.keys(SP.METHODS).map(function (m) {
                return "<input type=\"radio\" id=\"pay-" + m + "\" name=\"method\" value=\"" + m + "\"" + (m === "CARD" ? " checked" : "")
                    + "><label for=\"pay-" + m + "\">" + SP.METHODS[m] + "</label>";
            }).join("") + "</div></div></div>"
            + "<p class=\"note\"><i class=\"fa-solid fa-calendar-day\"></i><span>Rent is charged every month on the move-in day. The first month is paid now.</span></p>"
            + "<div class=\"wizard-nav\"><a class=\"btn btn-secondary\" href=\"" + stepUrl(3) + "\"><i class=\"fa-solid fa-arrow-left\"></i> Back</a>"
            + "<button class=\"btn btn-primary\" type=\"submit\"><i class=\"fa-solid fa-check\"></i> Create rental</button></div>"
            + "</form>";
    }

    // Price summary
    html += "</div><aside class=\"card summary\">"
        + "<div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-file-invoice-dollar\"></i>Summary</span></div><div class=\"dl\">"
        + "<div class=\"dl-row\"><span>Customer</span><strong>" + e(customerName || "—") + "</strong></div>"
        + "<div class=\"dl-row\"><span>Locker</span><strong class=\"mono\">" + (chosen ? chosen.number : "—") + "</strong></div>"
        + "<div class=\"dl-row\"><span>Size</span><span>" + (w.size ? SP.sizeLabel(w.size) : "—") + "</span></div>"
        + "<div class=\"dl-row\"><span>Base price</span><span>" + (base !== null ? SP.money(base) : "—") + "</span></div>"
        + "<div class=\"dl-row\"><span>Discount</span>"
        + (!w.discount ? "<span class=\"muted\">Chosen in step 3</span>"
            : "<span>" + SP.DISCOUNTS[w.discount] + (w.discount !== "NONE" && base !== null ? " · " + SP.money(rate - base) : "") + "</span>")
        + "</div>"
        + "<div class=\"dl-row dl-total\"><span>Monthly rate</span><span>" + (rate !== null ? SP.money(rate) : "—") + "</span></div></div>"
        + "<div class=\"dl-row\"><span>Due at move-in</span><strong>" + (rate !== null ? SP.money(rate) : "—") + "</strong></div>"
        + "<p class=\"note\"><i class=\"fa-solid fa-lock\"></i><span>The rental keeps this rate. Later price changes apply to new rentals only.</span></p>"
        + "</aside></div>";

    // Puts the finished HTML inside <main id="page"> in new-rental.html
    document.getElementById("page").innerHTML = html;
    // Error from going back a step, shown at the top of that step
    if (error) {
        UI.formError(document.querySelector(".grid-main-side > .stack"), error, /phone/i.test(error) ? "phone" : null);
    }

    // Step 4 "Create rental": SP.createRental() adds the customer (if new), the rental, the first month's charge
    // and its payment, then opens the locker page (or the customer's sign-in slip for a new customer)
    var createForm = document.getElementById("create-form");
    if (createForm) {
        createForm.addEventListener("submit", function (event) {
            event.preventDefault();
            var data = UI.formData(createForm);
            var result = SP.createRental({
                customerId: w.customerId, name: w.name, phone: w.phone, email: w.email,
                locker: w.locker, discount: w.discount, moveIn: data.moveIn, method: data.method
            }, staff.name);
            if (result.error) {
                UI.formError(createForm, result.error, /move-in/i.test(result.error) ? "moveIn" : /payment/i.test(result.error) ? "method" : null);
                return;
            }
            var done = "Rental created: " + result.rental.locker + " for " + result.customer.name + " · receipt " + result.payment.receiptNo
                + (result.accountReopened ? " · online account reopened" : "");
            // New customer: show their sign-in slip
            if (result.newCustomer) {
                UI.go("customers.html?id=" + result.customer.id + "&slip=1", done + ". Give them their sign-in slip.");
            } else {
                UI.go("locker.html?n=" + result.rental.locker, done);
            }
        });
    }
})();
