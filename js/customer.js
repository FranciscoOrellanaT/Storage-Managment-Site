/* StoragePro - customer.js
   The customer's own website (customer.html). Sections: Home, Pay, Repairs, Help, Account.
   On the first sign-in it asks the customer to pick their own password. */
(function () {
    "use strict";
    // e() makes text safe for HTML. F = the facility's details (name, phone, email, office hours).
    var e = UI.esc;
    var F = SP.FACILITY;

    // me = the signed-in customer. Staff and signed-out visitors are sent to their own pages.
    var me = SP.customerSession();
    if (!me) {
        window.location.replace(SP.session() ? "dashboard.html" : "index.html");
        return;
    }

    // root = where each section is drawn. Tap-to-call and tap-to-email links for the office.
    var root = document.getElementById("portal");
    var callUrl = "tel:" + F.phoneLink;
    var mailUrl = "mailto:" + F.email;

    // Header and footer
    document.getElementById("site-avatar").textContent = SP.initials(me.name);
    document.getElementById("site-name").textContent = me.name;
    document.getElementById("site-sign-out").addEventListener("click", function () {
        SP.signOut();
        UI.go("index.html", "Signed out.");
    });
    document.getElementById("site-foot").innerHTML = "<div class=\"site-foot-inner\"><span><strong>StoragePro</strong> · "
        + F.hoursText + "</span><span><a class=\"link\" href=\"" + callUrl + "\">" + F.phone + "</a> · <a class=\"link\" href=\""
        + mailUrl + "\">" + F.email + "</a></span></div>";

    // ----- Helpers -----
    // This customer's worked-out values right now: lockers, balance, overdue days
    function mine() {
        return SP.board().customer(me.id);
    }

    // True during office hours (by this computer's clock)
    function isOpenNow() {
        var h = new Date().getHours();
        return h >= F.openHour && h < F.closeHour;
    }

    // "Open now" / "Closed now" line for the office-hours card
    function openNow() {
        return "<p class=\"portal-open " + (isOpenNow() ? "is-open" : "is-closed") + "\"><i class=\"fa-solid fa-circle\"></i> "
            + (isOpenNow() ? "Open now · closes 5:00 PM" : "Closed now · opens 9:00 AM") + "</p>";
    }

    // HTML for a section heading with an optional line under it
    function pageHead(title, sub) {
        return "<div class=\"page-head\"><div><h1>" + title + "</h1>" + (sub ? "<p class=\"page-sub\">" + sub + "</p>" : "") + "</div></div>";
    }

    // HTML for a card's title bar, with optional extra content on the right
    function cardHead(icon, title, extra) {
        return "<div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid " + icon + "\"></i>" + title + "</span>" + (extra || "") + "</div>";
    }

    // HTML for one row in a list (a link when href is given)
    function row(icon, title, sub, endHtml, href) {
        var tag = href ? "a" : "div";
        return "<" + tag + " class=\"portal-row\"" + (href ? " href=\"" + href + "\"" : "") + ">"
            + "<span class=\"portal-row-icon\"><i class=\"fa-solid " + icon + "\"></i></span>"
            + "<span class=\"portal-row-main\"><strong>" + title + "</strong>" + (sub ? "<span>" + sub + "</span>" : "") + "</span>"
            + (endHtml || "") + "</" + tag + ">";
    }

    // An empty red message spot under a form box, filled by showError()
    function errorSlot(field) {
        return "<span class=\"field-error\" id=\"err-" + field + "\" role=\"alert\" hidden></span>";
    }

    // Shows (or clears) the error under a field and marks the field
    function showError(field, message) {
        var slot = document.getElementById("err-" + field);
        if (slot) {
            slot.textContent = message;
            slot.hidden = !message;
        }
        document.querySelectorAll("#portal [name=\"" + field + "\"]").forEach(function (input) {
            input.classList.toggle("invalid", !!message);
        });
    }

    // Clears every error in a form before it is checked again
    function clearErrors(form) {
        form.querySelectorAll(".field-error").forEach(function (slot) {
            showError(slot.id.replace("err-", ""), "");
        });
    }

    // Password box with a show / hide button
    function revealInput(id, name, autocomplete) {
        return "<div class=\"input-reveal\"><input class=\"input\" id=\"" + id + "\" name=\"" + name + "\" type=\"password\" autocomplete=\"" + autocomplete + "\" required>"
            + "<button class=\"reveal-btn\" type=\"button\" data-reveal=\"" + id + "\" aria-label=\"Show password\" aria-pressed=\"false\"><i class=\"fa-solid fa-eye\"></i></button></div>";
    }

    // Office hours card with phone and email
    function hoursCard() {
        return "<section class=\"card\">" + cardHead("fa-clock", "Office hours") + openNow()
            + "<div class=\"dl\"><div class=\"dl-row\"><span>Hours</span><strong>" + F.hoursText + "</strong></div>"
            + "<div class=\"dl-row\"><span>Phone</span><a class=\"link\" href=\"" + callUrl + "\">" + F.phone + "</a></div>"
            + "<div class=\"dl-row\"><span>Email</span><a class=\"link\" href=\"" + mailUrl + "\">" + F.email + "</a></div></div>"
            + "<div class=\"quick-actions\">"
            + "<a class=\"quick-action\" href=\"" + callUrl + "\"><i class=\"fa-solid fa-phone\"></i><span>Call</span></a>"
            + "<a class=\"quick-action\" href=\"" + mailUrl + "\"><i class=\"fa-solid fa-envelope\"></i><span>Email</span></a>"
            + "<a class=\"quick-action\" href=\"#repairs\"><i class=\"fa-solid fa-screwdriver-wrench\"></i><span>Repairs</span></a>"
            + "</div></section>";
    }

    // ----- Home -----
    // HOME: one card per unit (size, rent, gate code, status), help links, balance and office hours
    function home() {
        var v = mine();
        var code = SP.gateCodeFor(me.id);
        var html = pageHead("Hi, " + e(me.name.split(" ")[0]), v.lockers.length
            ? "Here's your storage at a glance." : "Welcome to StoragePro.");

        html += "<div class=\"grid grid-main-side\"><div class=\"stack\">";

        if (!v.lockers.length) {
            html += "<section class=\"card portal-empty\"><i class=\"fa-solid fa-box-open\"></i>"
                + "<strong>No unit on your account yet</strong>"
                + "<span>When you rent a unit it shows up here with its gate code. Can't find your rental? Call us and we'll sort it out.</span>"
                + "<a class=\"btn btn-secondary\" href=\"" + callUrl + "\"><i class=\"fa-solid fa-phone\"></i> Call " + F.phone + "</a></section>";
        } else {
            // One card per unit
            html += "<div class=\"unit-grid\">" + v.lockers.map(function (l) {
                return "<section class=\"unit-card\">"
                    + "<div class=\"unit-card-top\"><span class=\"unit-label\">Unit</span>"
                    + "<span class=\"unit-number mono\">" + l.number + "</span>"
                    + "<span class=\"size-tag\">" + SP.SIZES[l.locker.size].short + "</span></div>"
                    + "<div class=\"unit-card-body\">"
                    + "<div class=\"dl\">"
                    + "<div class=\"dl-row\"><span>Size</span><span>" + SP.sizeLabel(l.locker.size) + "</span></div>"
                    + "<div class=\"dl-row\"><span>Monthly rent</span><span>" + SP.money(l.rental.monthlyRate) + "</span></div>"
                    + "<div class=\"dl-row\"><span>Next charge</span><span>" + SP.fmtDate(l.nextCharge) + "</span></div>"
                    + "<div class=\"dl-row\"><span>Status</span><span>" + (l.balance > 0
                        ? UI.pill(l.daysOverdue ? "s-od" : "s-rs", (l.daysOverdue ? SP.days(l.daysOverdue) + " overdue · " : "Due · ") + SP.money(l.balance))
                        : UI.pill("s-av", "Paid up")) + "</span></div>"
                    + "</div>"
                    + "<div class=\"unit-gate\"><span><i class=\"fa-solid fa-key\"></i> Gate code</span>"
                    + "<strong class=\"mono\" data-gate=\"" + code + "\">••••••#</strong>"
                    + "<button class=\"btn btn-secondary btn-sm\" type=\"button\" data-show-gate aria-pressed=\"false\">Show</button></div>"
                    + "</div></section>";
            }).join("") + "</div>";
        }

        // Help links
        html += "<div class=\"portal-list\">"
            + row("fa-screwdriver-wrench", "Report a problem", "Send a repair request without calling", "<i class=\"fa-solid fa-chevron-right\"></i>", "#repairs")
            + row("fa-circle-question", "FAQ", "Rent, gate codes, moving out and more", "<i class=\"fa-solid fa-chevron-right\"></i>", "#help-faq")
            + row("fa-headset", "Contact us", F.phone + " · " + F.email, "<a class=\"portal-row-end\" href=\"" + callUrl + "\">Call</a>")
            + "</div>";

        html += "</div><div class=\"stack\">";

        // Balance
        html += "<div class=\"balance-box" + (v.overdue ? " s-od" : "") + "\"><span class=\"label\">Your balance</span>"
            + "<span class=\"balance-amount\">" + SP.money(v.balance) + "</span>"
            + (v.overdue ? "<span class=\"balance-note\"><i class=\"fa-solid fa-triangle-exclamation\"></i>" + SP.days(v.daysOverdue) + " overdue</span>"
                : v.balance > 0 ? "<span class=\"balance-note\"><i class=\"fa-solid fa-calendar-day\"></i>Due now</span>"
                : "<span class=\"balance-note\"><i class=\"fa-solid fa-circle-check\"></i>You're paid up. Thank you!</span>")
            + (v.balance > 0 ? "<a class=\"btn btn-primary btn-lg\" href=\"#pay\"><i class=\"fa-solid fa-circle-dollar-to-slot\"></i> Pay " + SP.money(v.balance) + "</a>"
                : "<a class=\"btn btn-secondary\" href=\"#pay\">View payments</a>")
            + "</div>"
            + hoursCard()
            + "</div></div>";
        root.innerHTML = html;

        // Show / Hide buttons for the gate codes (hidden by default so nobody reads them over a shoulder)
        root.querySelectorAll("[data-show-gate]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var codeEl = btn.parentNode.querySelector("[data-gate]");
                var showing = btn.getAttribute("aria-pressed") === "true";
                codeEl.textContent = showing ? "••••••#" : codeEl.dataset.gate + "#";
                btn.textContent = showing ? "Show" : "Hide";
                btn.setAttribute("aria-pressed", showing ? "false" : "true");
            });
        });
    }

    // ----- Pay -----
    // PAY: what's owed, a payment form (full balance, one month, or another amount) and recent payments.
    // receiptId shows that payment's receipt at the top (address #receipt/12).
    function pay(receiptId) {
        var v = mine();
        var html = pageHead("Pay", "Pay your rent online. The oldest charge is paid first.")
            + "<div class=\"grid grid-main-side\"><div class=\"stack\">";

        if (receiptId) {
            html += receipt(SP.findPayment(receiptId));
        }

        var oneMonth = Math.min(v.monthly, v.balance);
        if (v.balance > 0) {
            var charges = SP.unpaidFor(me.id);
            html += "<section class=\"card card-flush\">" + cardHead("fa-list-ol", "What you owe")
                + "<table class=\"table\"><thead><tr><th>Due</th><th>Unit</th><th>Item</th><th class=\"num\">Amount</th></tr></thead><tbody>"
                + charges.map(function (c) {
                    return "<tr class=\"trow\"><td>" + SP.fmtDate(c.due) + "</td><td class=\"mono\">" + SP.findRental(c.rentalId).locker + "</td>"
                        + "<td>" + (c.type === "RENT" ? "Monthly rent" : "Late fee") + "</td><td class=\"num\">" + SP.money(c.amount - c.paid) + "</td></tr>";
                }).join("")
                + "</tbody></table></section>"

                + "<form class=\"card\" id=\"pay-form\" novalidate>" + cardHead("fa-credit-card", "Make a payment")
                + "<div class=\"options\" role=\"radiogroup\" aria-label=\"How much?\">"
                + "<label class=\"option\"><input type=\"radio\" name=\"choice\" value=\"full\" checked><i class=\"option-check fa-solid fa-circle-check\"></i>"
                + "<span class=\"option-title\">Full balance</span><span class=\"option-price\">" + SP.money(v.balance) + "</span></label>"
                + (oneMonth < v.balance ? "<label class=\"option\"><input type=\"radio\" name=\"choice\" value=\"month\"><i class=\"option-check fa-solid fa-circle-check\"></i>"
                    + "<span class=\"option-title\">One month</span><span class=\"option-price\">" + SP.money(oneMonth) + "</span></label>" : "")
                + "<label class=\"option\"><input type=\"radio\" name=\"choice\" value=\"other\"><i class=\"option-check fa-solid fa-circle-check\"></i>"
                + "<span class=\"option-title\">Other amount</span><span class=\"option-meta\">Up to " + SP.money(v.balance) + "</span></label>"
                + "</div>"
                + "<div class=\"field\" id=\"other-wrap\" hidden><label for=\"other\">Amount</label>"
                + "<div class=\"input-money\"><span>$</span><input class=\"input\" id=\"other\" name=\"other\" type=\"number\" step=\"0.01\" min=\"0.01\" max=\""
                + SP.plain(v.balance) + "\" inputmode=\"decimal\"></div>" + errorSlot("other") + "</div>"
                + "<p class=\"note\"><i class=\"fa-solid fa-credit-card\"></i><span>Charged to the card on file for your account. "
                + "<strong>Demo:</strong> no real card is charged.</span></p>"
                + "<div class=\"form-actions\"><button class=\"btn btn-primary btn-lg\" type=\"submit\" id=\"pay-btn\"><i class=\"fa-solid fa-lock\"></i> Pay "
                + SP.money(v.balance) + "</button></div></form>";
        } else if (!receiptId) {
            html += "<section class=\"card portal-empty\"><i class=\"fa-solid fa-circle-check\"></i><strong>Nothing to pay right now</strong>"
                + "<span>Your next charge shows on the Home page.</span></section>";
        }

        html += "</div><div class=\"stack\">"
            + "<div class=\"balance-box" + (v.overdue ? " s-od" : "") + "\"><span class=\"label\">Balance</span>"
            + "<span class=\"balance-amount\">" + SP.money(v.balance) + "</span>"
            + (v.overdue ? "<span class=\"balance-note\"><i class=\"fa-solid fa-triangle-exclamation\"></i>" + SP.days(v.daysOverdue) + " overdue</span>"
                : v.balance > 0 ? "<span class=\"balance-note\"><i class=\"fa-solid fa-calendar-day\"></i>Due now</span>"
                : "<span class=\"balance-note\"><i class=\"fa-solid fa-circle-check\"></i>Paid up</span>")
            + "</div>";

        var history = SP.paymentsFor(me.id, 8);
        html += "<section class=\"card\">" + cardHead("fa-clock-rotate-left", "Recent payments") + "<div class=\"list\">"
            + history.map(function (p) {
                return "<a class=\"list-item\" href=\"#receipt/" + p.id + "\"><span class=\"list-main\"><span class=\"list-title\">" + SP.money(p.amount) + "</span>"
                    + "<span class=\"list-meta\">" + SP.fmtDate(p.at) + " · " + SP.METHODS[p.method] + " · " + SP.paymentLockers(p) + (p.voided ? " · <strong class=\"text-od\">Voided</strong>" : "") + "</span></span>"
                    + "<span class=\"list-end\"><span class=\"list-meta\">Receipt</span></span></a>";
            }).join("") + (history.length ? "" : "<p class=\"empty\">No payments yet.</p>") + "</div></section>"
            + "</div></div>";
        root.innerHTML = html;

        var form = document.getElementById("pay-form");
        if (!form) {
            return;
        }
        var otherWrap = document.getElementById("other-wrap");
        var payBtn = document.getElementById("pay-btn");
        // The amount picked, in cents (NaN if the typed amount isn't a number)
        function amountChosen() {
            var choice = UI.formData(form).choice;
            if (choice === "month") {
                return oneMonth;
            }
            if (choice === "other") {
                return SP.toCents(document.getElementById("other").value);
            }
            return v.balance;
        }
        // Keeps the pay button's amount up to date
        form.addEventListener("input", function () {
            otherWrap.hidden = UI.formData(form).choice !== "other";
            var amount = amountChosen();
            payBtn.innerHTML = "<i class=\"fa-solid fa-lock\"></i> Pay " + (isNaN(amount) || amount <= 0 ? "" : SP.money(amount));
            showError("other", "");
        });
        // Pay button: records the payment as a card payment made online, then shows its receipt
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var result = SP.takePayment(me.id, amountChosen(), "CARD", "Paid online", me.name + " (online)");
            if (result.error) {
                showError("other", result.error);
                otherWrap.hidden = false;
                return;
            }
            UI.toast("Payment of " + SP.money(result.payment.amount) + " received. Thank you!");
            window.location.hash = "#receipt/" + result.payment.id;
        });
    }

    // HTML for one receipt (only this customer's own payments)
    function receipt(p) {
        if (!p || p.customerId !== me.id) {
            return "";
        }
        return "<section class=\"card\">" + cardHead("fa-receipt", "Receipt",
                "<button class=\"btn btn-secondary btn-sm no-print\" type=\"button\" data-action=\"print\"><i class=\"fa-solid fa-print\"></i> Print</button>")
            + (p.voided ? "<div class=\"alert s-od\"><i class=\"fa-solid fa-ban\"></i><span><strong>Voided</strong> on " + SP.fmtDate(p.voided.at)
                + ". This payment was taken back, so the amount is on your balance again. Questions? Call " + F.phone + ".</span></div>" : "")
            + "<div class=\"receipt\">"
            + "<div class=\"receipt-head\"><div class=\"row\"><img src=\"images/logo.svg\" alt=\"\"><strong>StoragePro</strong></div>"
            + "<span class=\"mono muted\">" + p.receiptNo + "</span></div>"
            + "<div class=\"dl\"><div class=\"dl-row\"><span>Date</span><span>" + SP.fmtDateTime(p.at) + "</span></div>"
            + "<div class=\"dl-row\"><span>Method</span><span>" + SP.METHODS[p.method] + "</span></div>"
            + p.lines.map(function (line) {
                var c = SP.findCharge(line.chargeId);
                return "<div class=\"dl-row\"><span>Unit " + SP.findRental(c.rentalId).locker + " " + (c.type === "RENT" ? "rent" : "late fee")
                    + ", " + SP.fmtShort(c.due) + "</span><span>" + SP.money(line.amount) + "</span></div>";
            }).join("")
            + "<div class=\"dl-row dl-total\"><span>Paid</span><span>" + SP.money(p.amount) + "</span></div>"
            + "<div class=\"dl-row\"><span>Remaining balance</span><span>" + SP.money(p.balanceAfter) + "</span></div></div>"
            + "<p class=\"receipt-foot\">Thank you for storing with us.</p></div></section>";
    }

    // ----- Repairs -----
    // REPAIRS: a form to send a repair request, and the requests already sent (the newest one highlighted)
    function repairs(highlightId) {
        var v = mine();
        var html = pageHead("Repairs", "Tell us what's wrong and we'll fix it. No phone call needed.")
            + "<div class=\"grid grid-main-side\"><div class=\"stack\">";

        if (!v.lockers.length) {
            html += "<section class=\"card portal-empty\"><i class=\"fa-solid fa-box-open\"></i>"
                + "<strong>No unit on your account</strong><span>Repair requests are for units you rent.</span></section>";
        } else {
            html += "<form class=\"card\" id=\"repair-form\" novalidate>" + cardHead("fa-screwdriver-wrench", "Send a repair request", "<span class=\"card-sub\">4 quick questions</span>")
                // 1. Which unit?
                + "<div class=\"field\"><div class=\"q-head\"><span class=\"q-num\">1</span><label for=\"r-locker\">Which unit?</label></div>"
                + "<select class=\"input\" id=\"r-locker\" name=\"locker\">"
                + v.lockers.map(function (l) {
                    return "<option value=\"" + l.number + "\">Unit " + l.number + " · " + SP.sizeLabel(l.locker.size) + "</option>";
                }).join("") + "</select></div>"
                // 2. What's wrong?
                + "<div class=\"field\"><div class=\"q-head\"><span class=\"q-num\">2</span><span>What's wrong?</span></div>"
                + "<div class=\"options options-compact\" role=\"radiogroup\" aria-label=\"What's wrong?\">"
                + Object.keys(SP.TICKET_CATEGORIES).map(function (key) {
                    var c = SP.TICKET_CATEGORIES[key];
                    return "<label class=\"option\"><input type=\"radio\" name=\"category\" value=\"" + key + "\">"
                        + "<i class=\"option-check fa-solid fa-circle-check\"></i><span class=\"option-icon\"><i class=\"fa-solid " + c.icon + "\"></i></span>"
                        + "<span class=\"option-title\">" + c.label + "</span></label>";
                }).join("") + "</div>" + errorSlot("category") + "</div>"
                // 3. Urgent?
                + "<div class=\"field\"><div class=\"q-head\"><span class=\"q-num\">3</span><span>Is it urgent?</span></div>"
                + "<div class=\"options options-compact\" role=\"radiogroup\" aria-label=\"Is it urgent?\">"
                + "<label class=\"option\"><input type=\"radio\" name=\"priority\" value=\"URGENT\"><i class=\"option-check fa-solid fa-circle-check\"></i>"
                + "<span class=\"option-title\">Yes</span><span class=\"option-meta\">It's unsafe, or I can't get into my unit</span></label>"
                + "<label class=\"option\"><input type=\"radio\" name=\"priority\" value=\"NORMAL\" checked><i class=\"option-check fa-solid fa-circle-check\"></i>"
                + "<span class=\"option-title\">No</span><span class=\"option-meta\">It can wait a few days</span></label>"
                + "</div></div>"
                // 4. Describe it
                + "<div class=\"field\"><div class=\"q-head\"><span class=\"q-num\">4</span><label for=\"r-desc\">Describe the problem</label></div>"
                + "<textarea class=\"input\" id=\"r-desc\" name=\"description\" maxlength=\"500\" placeholder=\"e.g. The door is hard to open and the latch sticks.\"></textarea>"
                + errorSlot("description") + "</div>"
                + "<p class=\"help\">For an emergency, call us at <a class=\"link\" href=\"" + callUrl + "\">" + F.phone + "</a>.</p>"
                + "<div class=\"form-actions\"><button class=\"btn btn-primary btn-lg\" type=\"submit\"><i class=\"fa-solid fa-paper-plane\"></i> Send request</button></div>"
                + "</form>";
        }

        var tickets = SP.ticketsForCustomer(me.id);
        html += "</div><div class=\"stack\"><section class=\"card\" id=\"my-requests\">" + cardHead("fa-list-check", "My requests") + "<div class=\"list\">"
            + tickets.map(function (t) {
                var s = SP.TICKET_STATUS[t.status];
                return "<div class=\"list-item request" + (String(t.id) === String(highlightId) ? " is-new" : "") + "\">"
                    + "<span class=\"list-icon " + s.css + "\"><i class=\"fa-solid " + SP.TICKET_CATEGORIES[t.category].icon + "\"></i></span>"
                    + "<span class=\"list-main\"><span class=\"list-title\">" + SP.TICKET_CATEGORIES[t.category].label + " · Unit " + t.locker + "</span>"
                    + "<span class=\"list-meta\">" + t.number + " · sent " + SP.fmtDate(t.createdAt) + "</span>"
                    + (t.status === "RESOLVED" ? "<span class=\"list-meta\"><strong>Fixed:</strong> " + e(t.resolution) + "</span>" : "")
                    + "</span><span class=\"list-end\">" + UI.pill(s.css, s.label) + "</span></div>";
            }).join("") + (tickets.length ? "" : "<p class=\"empty\">You haven't sent any requests.</p>") + "</div></section>"
            + "<section class=\"card\">" + cardHead("fa-route", "What happens next")
            + "<div class=\"flow flow-plain\">"
            + "<div class=\"flow-step\"><span class=\"pill s-rs\">Open</span><span>We got your request</span></div>"
            + "<div class=\"flow-step\"><span class=\"pill s-oc\">In progress</span><span>Someone is fixing it</span></div>"
            + "<div class=\"flow-step\"><span class=\"pill s-av\">Resolved</span><span>It's fixed, with a note of what we did</span></div>"
            + "</div></section>"
            + "</div></div>";
        root.innerHTML = html;

        var form = document.getElementById("repair-form");
        if (!form) {
            return;
        }
        // Typing clears that box's error
        form.addEventListener("input", function (event) {
            showError(event.target.name, "");
        });
        // Send request: SP.createTicket() checks it and saves it as a maintenance ticket staff will see
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var data = UI.formData(form);
            var result = SP.createTicket({ locker: data.locker, category: data.category, priority: data.priority,
                description: data.description, customerId: me.id }, me.name + " (customer)");
            if (result.errors) {
                showError("category", result.errors.category || "");
                showError("description", result.errors.description || "");
                var first = form.querySelector(result.errors.category ? "[name=category]" : "[name=description]");
                if (first) {
                    first.focus();
                }
                return;
            }
            UI.toast("Request " + result.ticket.number + " sent. We'll take care of it.");
            window.location.hash = "#repairs/" + result.ticket.id;
        });
    }

    // ----- Help -----
    // Questions and answers for the Help section
    var FAQ = [
        ["When is my rent due?", "Rent is charged every month on the day you moved in. You can see your next charge date on the Home page."],
        ["What happens if I pay late?", "There's a 5-day grace period. After that a one-time late fee is added to that month's rent."],
        ["How do I get through the gate?", "Use the gate code on the Home page. Click Show to see it. Enter the numbers and then the # key."],
        ["I forgot my gate code or it doesn't work.", "Open the Home page to see it again. If it still doesn't work, call us during office hours."],
        ["How do I report a problem with my unit?", "Use the Repairs page. Pick your unit, say what's wrong and send it. You can follow it there until it's fixed."],
        ["Can I move to a bigger or smaller unit?", "Yes. Call or visit the office and we'll move you to an open unit of the size you need."],
        ["How do I move out?", "Pay any balance first, then call or visit the office to book your move-out date."],
        ["How can I pay?", "Online on the Pay page with the card on file, or at the office with cash, card or check."],
        ["I can't sign in.", "Call the office. We can give you a new temporary password and turn your online account back on if it was paused."]
    ];

    // HELP: the FAQ (each question opens its answer) and contact details
    function help() {
        var html = pageHead("Help", "We're here to help.")
            + "<div class=\"grid grid-main-side\"><div class=\"stack\">"
            + "<section class=\"card\" id=\"help-faq\">" + cardHead("fa-circle-question", "Frequently asked questions") + "<div class=\"faq\">"
            + FAQ.map(function (q) {
                return "<details><summary>" + q[0] + "<i class=\"fa-solid fa-chevron-down\"></i></summary><p>" + q[1] + "</p></details>";
            }).join("") + "</div></section>"
            + "</div><div class=\"stack\">" + hoursCard()
            + "<div class=\"portal-list\">"
            + row("fa-screwdriver-wrench", "Something broken?", "Send a repair request", "<i class=\"fa-solid fa-chevron-right\"></i>", "#repairs")
            + row("fa-circle-dollar-to-slot", "Pay rent", "Pay your balance online", "<i class=\"fa-solid fa-chevron-right\"></i>", "#pay")
            + "</div></div></div>";
        root.innerHTML = html;
    }

    // ----- Account -----
    // ACCOUNT: the customer's details and a form to change their password
    function account() {
        var c = SP.findCustomer(me.id);
        var html = pageHead("Account", "Your details and password.")
            + "<div class=\"grid grid-2\">"
            + "<section class=\"card\"><div class=\"profile-head\"><span class=\"avatar avatar-lg\">" + SP.initials(c.name) + "</span>"
            + "<div><h2>" + e(c.name) + "</h2><p class=\"muted\">Customer since " + SP.fmtMonthYear(c.since) + "</p></div></div>"
            + "<div class=\"dl\">"
            + "<div class=\"dl-row\"><span>Email</span><span>" + e(c.email || "—") + "</span></div>"
            + "<div class=\"dl-row\"><span>Phone</span><span>" + e(c.phone) + "</span></div>"
            + "<div class=\"dl-row\"><span>Discount</span><span>" + (c.discount === "NONE" ? "None" : SP.DISCOUNTS[c.discount]) + "</span></div>"
            + "</div><p class=\"help\">To change your email or phone, call us at " + F.phone + ".</p></section>"

            + "<form class=\"card\" id=\"password-form\" novalidate>" + cardHead("fa-key", "Change password")
            + "<div class=\"field\"><label for=\"pw-current\">Current password</label>" + revealInput("pw-current", "current", "current-password") + errorSlot("current") + "</div>"
            + "<div class=\"field\"><label for=\"pw-next\">New password</label>" + revealInput("pw-next", "next", "new-password")
            + "<span class=\"help\">At least 8 characters.</span>" + errorSlot("next") + "</div>"
            + "<div class=\"field\"><label for=\"pw-confirm\">New password again</label>" + revealInput("pw-confirm", "confirm", "new-password") + errorSlot("confirm") + "</div>"
            + "<div class=\"form-actions\"><button class=\"btn btn-primary\" type=\"submit\">Save new password</button></div></form>"
            + "</div>";
        root.innerHTML = html;

        var form = document.getElementById("password-form");
        form.addEventListener("input", function (event) {
            showError(event.target.name, "");
        });
        // Change password: checks the current one and that the new one is typed the same twice
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            clearErrors(form);
            var d = UI.formData(form);
            var result = SP.changeCustomerPassword(me.id, d.current, d.next, d.confirm);
            if (result.error) {
                showError(result.field || "current", result.error);
                document.querySelector("[name=\"" + (result.field || "current") + "\"]").focus();
                return;
            }
            form.reset();
            UI.toast("Password changed.");
        });
    }

    // ----- Show / hide password buttons -----
    root.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-reveal]");
        if (!btn) {
            return;
        }
        var input = document.getElementById(btn.dataset.reveal);
        var showing = input.type === "text";
        input.type = showing ? "password" : "text";
        btn.setAttribute("aria-pressed", showing ? "false" : "true");
        btn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
        btn.innerHTML = "<i class=\"fa-solid " + (showing ? "fa-eye" : "fa-eye-slash") + "\"></i>";
    });

    // ----- Top menu -----
    // Shows the section named in the address after # (#home, #pay, #repairs, #help, #account)
    // and highlights it in the top menu. Runs again whenever the # part changes.
    function show() {
        var hash = (window.location.hash || "#home").slice(1);
        var parts = hash.split("/");
        var tab = parts[0];
        if (tab === "receipt") {
            pay(parts[1]);
            tab = "pay";
        } else if (tab === "pay") {
            pay();
        } else if (tab === "repairs") {
            repairs(parts[1]);
        } else if (tab === "help" || tab === "help-faq") {
            help();
            tab = "help";
        } else if (tab === "account") {
            account();
        } else {
            home();
            tab = "home";
        }
        document.querySelectorAll(".site-nav a").forEach(function (a) {
            var on = a.dataset.tab === tab;
            a.classList.toggle("on", on);
            if (on) {
                a.setAttribute("aria-current", "page");
            } else {
                a.removeAttribute("aria-current");
            }
        });
        // Scrolls to the FAQ or the new request form when the link points there
        var target = hash === "help-faq" ? document.getElementById("help-faq")
            : parts[1] && tab === "repairs" ? document.getElementById("my-requests") : null;
        if (target) {
            target.scrollIntoView({ block: "start" });
        } else {
            window.scrollTo(0, 0);
        }
    }

    // ----- First sign-in: pick your own password -----
    // FIRST SIGN-IN: the customer must replace their temporary password before seeing anything else
    function firstPassword() {
        document.querySelector(".site-nav").hidden = true;
        root.innerHTML = "<div class=\"first-password\">"
            + pageHead("Welcome, " + e(me.name.split(" ")[0]) + "!",
                "One quick step: pick your own password. You'll use it from now on instead of the temporary one.")
            + "<form class=\"card\" id=\"first-form\" novalidate>"
            + "<div class=\"field\"><label for=\"pw-next\">New password</label>" + revealInput("pw-next", "next", "new-password")
            + "<span class=\"help\">At least 8 characters.</span>" + errorSlot("next") + "</div>"
            + "<div class=\"field\"><label for=\"pw-confirm\">New password again</label>" + revealInput("pw-confirm", "confirm", "new-password")
            + errorSlot("confirm") + "</div>"
            + "<button class=\"btn btn-primary btn-lg btn-block\" type=\"submit\"><i class=\"fa-solid fa-check\"></i> Save and continue</button>"
            + "</form>"
            + "<p class=\"help\">Need help? Call us at <a class=\"link\" href=\"" + callUrl + "\">" + F.phone + "</a>.</p></div>";
        var form = document.getElementById("first-form");
        document.getElementById("pw-next").focus();
        form.addEventListener("input", function (event) {
            showError(event.target.name, "");
        });
        // Saves the new password, shows the menu again and opens Home
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            clearErrors(form);
            var d = UI.formData(form);
            var result = SP.setFirstPassword(me.id, d.next, d.confirm);
            if (result.error) {
                showError(result.field || "next", result.error);
                document.querySelector("[name=\"" + (result.field || "next") + "\"]").focus();
                return;
            }
            me = SP.customerSession();
            document.querySelector(".site-nav").hidden = false;
            window.addEventListener("hashchange", show);
            if (window.location.hash && window.location.hash !== "#home") {
                window.location.hash = "#home";
            } else {
                show();
            }
            UI.toast("Password saved. Welcome to your storage page!");
        });
    }

    // Start: the first-password screen, or the section in the address
    if (me.mustChangePassword) {
        firstPassword();
    } else {
        window.addEventListener("hashchange", show);
        show();
    }

    // Welcome message from the sign-in page
    try {
        var f = JSON.parse(sessionStorage.getItem("storagepro-flash"));
        sessionStorage.removeItem("storagepro-flash");
        if (f) {
            UI.toast(f.message, f.type);
        }
    } catch (err) {
        // no message
    }
})();
