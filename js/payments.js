/* StoragePro - payments.js
   Payments page: find a customer, take a payment and print the receipt. */
(function () {
    "use strict";
    // Draws the sidebar and top bar and returns the signed-in staff member (stops if nobody is signed in)
    var staff = UI.start("payments");
    if (!staff) {
        return;
    }
    // e() makes text safe for HTML. b = every locker and customer with balances worked out.
    var e = UI.esc;
    var b = SP.board();

    // q = the search words; selected = the customer picked (payments.html?customer=7), if any
    var q = UI.param("q") || "";
    var selected = b.customer(UI.param("customer"));
    var matches = [];
    // One search match picks that customer
    if (!selected && q.trim()) {
        matches = b.customers.filter(function (c) { return UI.matchCustomer(c, q); });
        if (matches.length === 1) {
            selected = matches[0];
            matches = [];
        }
    }

    // The receipt shown on the right: the one in the address, or the newest payment
    var receipt = SP.findPayment(UI.param("receipt")) || SP.lastPayment();

    // Page heading, then the Customer card with its search box
    var html = "<div class=\"page-head\"><div><h1>Payments</h1>"
        + "<p class=\"page-sub\">Take a payment, print the receipt, follow up on overdue accounts</p></div></div>"
        + "<div class=\"grid grid-main-side\"><div class=\"stack\">"

        // Find customer
        + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-user\"></i>Customer</span></div>"
        + "<form class=\"search\" method=\"get\" action=\"payments.html\" style=\"max-width: none\"><i class=\"fa-solid fa-magnifying-glass\"></i>"
        + "<input class=\"input\" type=\"search\" name=\"q\" value=\"" + e(selected ? selected.name : q) + "\" placeholder=\"Find a customer by name or locker\"></form>";

    // The picked customer: name, phone, lockers, discount and status
    if (selected) {
        html += "<div class=\"row between\"><div class=\"profile-head\"><span class=\"avatar\">" + SP.initials(selected.name) + "</span>"
            + "<div><strong>" + e(selected.name) + "</strong><p class=\"muted\">" + e(selected.customer.phone) + " · <span class=\"mono\">"
            + selected.lockerNumbers + "</span> · " + (selected.customer.discount === "NONE" ? "No discount"
                : SP.DISCOUNTS[selected.customer.discount] + " discount") + "</p></div></div>"
            + UI.pill(selected.statusCss, selected.overdue ? SP.days(selected.daysOverdue) + " overdue" : selected.statusLabel) + "</div>";
    }
    // Several matches: list them to pick from
    if (matches.length) {
        html += "<div class=\"list\">" + matches.map(function (c) {
            return "<a class=\"list-item\" href=\"payments.html?customer=" + c.id + "\"><span class=\"avatar\">" + SP.initials(c.name) + "</span>"
                + "<span class=\"list-main\"><span class=\"list-title\">" + e(c.name) + "</span><span class=\"list-meta mono\">" + c.lockerNumbers + "</span></span>"
                + "<span class=\"list-end\"><strong>" + SP.money(c.balance) + "</strong></span></a>";
        }).join("") + "</div>";
    } else if (!selected && q.trim()) {
        html += "<p class=\"list-meta\">No customer matches “" + e(q) + "”.</p>";
    } else if (!selected) {
        html += "<p class=\"list-meta\">Search for a customer, or pick one from the overdue list below.</p>";
    }
    html += "</section>";

    if (selected) {
        // breakdown = every unpaid charge, in the order payments pay them off.
        // The amount box starts at the full balance, or one month's rent with the "One month" chip.
        var breakdown = SP.unpaidFor(selected.id);
        var oneMonth = Math.min(selected.monthly, selected.balance);
        var monthMode = UI.param("amount") === "month" && oneMonth > 0;
        var amount = monthMode ? oneMonth : selected.balance;

        // Balance breakdown
        html += "<section class=\"card card-flush\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-list-ol\"></i>Balance breakdown</span>"
            + "<span class=\"card-sub\">Paid oldest charge first, most overdue locker first</span></div>"
            + "<table class=\"table\"><thead><tr><th>Due</th><th>Locker</th><th>Item</th><th class=\"num\">Amount</th></tr></thead><tbody>"
            + breakdown.map(function (c) {
                return "<tr class=\"trow\"><td>" + SP.fmtDate(c.due) + "</td><td class=\"mono\">" + SP.findRental(c.rentalId).locker + "</td>"
                    + "<td>" + (c.type === "RENT" ? "Monthly rent" : "Late fee") + (c.paid > 0 ? " (part paid)" : "") + "</td>"
                    + "<td class=\"num\">" + SP.money(c.amount - c.paid) + "</td></tr>";
            }).join("")
            + (breakdown.length ? "<tr class=\"trow\"><td colspan=\"3\"><strong>Balance</strong></td><td class=\"num\"><strong>"
                + SP.money(selected.balance) + "</strong></td></tr>"
                : "<tr><td colspan=\"4\" class=\"empty\">Nothing owed. This account is paid up.</td></tr>")
            + "</tbody></table></section>";

        // Take payment
        if (selected.balance > 0) {
            // Amount, method (cash / card / check) and an optional check number or note
            html += "<form class=\"card\" id=\"pay-form\" novalidate><div class=\"card-head\">"
                + "<span class=\"card-title\"><i class=\"fa-solid fa-cash-register\"></i>Take payment</span><div class=\"chips\">"
                + "<a class=\"chip" + (monthMode ? "" : " on") + "\" href=\"payments.html?customer=" + selected.id + "&amount=full\">Full balance · " + SP.money(selected.balance) + "</a>"
                + "<a class=\"chip" + (monthMode ? " on" : "") + "\" href=\"payments.html?customer=" + selected.id + "&amount=month\">One month · " + SP.money(oneMonth) + "</a>"
                + "</div></div>"
                + "<div class=\"form-row\"><div class=\"field\"><label for=\"amount\">Amount</label>"
                + "<div class=\"input-money\"><span>$</span><input class=\"input input-big\" id=\"amount\" name=\"amount\" type=\"number\" step=\"0.01\" min=\"0.01\" max=\""
                + SP.plain(selected.balance) + "\" value=\"" + SP.plain(amount) + "\" required></div>"
                + "<span class=\"help\">Can't be more than the balance (" + SP.money(selected.balance) + ").</span></div>"
                + "<div class=\"field\"><span class=\"label\">Method</span><div class=\"seg seg-block\">"
                + "<input type=\"radio\" id=\"m-cash\" name=\"method\" value=\"CASH\"><label for=\"m-cash\"><i class=\"fa-solid fa-money-bill\"></i> Cash</label>"
                + "<input type=\"radio\" id=\"m-card\" name=\"method\" value=\"CARD\" checked><label for=\"m-card\"><i class=\"fa-solid fa-credit-card\"></i> Card</label>"
                + "<input type=\"radio\" id=\"m-check\" name=\"method\" value=\"CHECK\"><label for=\"m-check\"><i class=\"fa-solid fa-money-check\"></i> Check</label>"
                + "</div><span class=\"help\">&nbsp;</span></div></div>"
                + "<div class=\"field\"><label for=\"ref\">Check number or note (optional)</label><input class=\"input\" id=\"ref\" name=\"reference\" maxlength=\"120\"></div>"
                + "<div class=\"form-actions\"><button class=\"btn btn-primary btn-lg\" type=\"submit\"><i class=\"fa-solid fa-check\"></i> Record payment</button></div>"
                + "</form>";
        }
    }

    // Overdue accounts
    var overdue = b.overdueCustomers();
    html += "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-triangle-exclamation\"></i>Overdue accounts</span>"
        + "<span class=\"card-sub\">Most overdue first</span></div><div class=\"list\">"
        + overdue.map(function (c) {
            return "<a class=\"list-item\" href=\"payments.html?customer=" + c.id + "\"><span class=\"list-icon s-od\"><i class=\"fa-solid fa-user\"></i></span>"
                + "<span class=\"list-main\"><span class=\"list-title\">" + e(c.name) + "</span><span class=\"list-meta\"><span class=\"mono\">"
                + c.mostOverdue.number + "</span> · oldest charge " + SP.fmtShort(c.oldestUnpaid) + "</span></span>"
                + "<span class=\"list-end\"><strong>" + SP.money(c.balance) + "</strong>" + UI.pill("s-od", SP.days(c.daysOverdue)) + "</span></a>";
        }).join("") + (overdue.length ? "" : "<p class=\"empty\">No overdue accounts. Nice.</p>")
        + "</div></section></div>";

    // Receipt (only this part prints)
    html += "<aside class=\"card summary\"><div class=\"card-head no-print\"><span class=\"card-title\"><i class=\"fa-solid fa-receipt\"></i>"
        + (UI.param("receipt") ? "Receipt" : "Last receipt") + "</span>"
        + (receipt ? "<button class=\"btn btn-secondary btn-sm\" type=\"button\" data-action=\"print\"><i class=\"fa-solid fa-print\"></i> Print</button>" : "")
        + "</div>";
    if (receipt) {
        var who = SP.findCustomer(receipt.customerId);
        var firstRental = receipt.lines.length ? SP.findRental(SP.findCharge(receipt.lines[0].chargeId).rentalId) : null;
        // Voided payment banner
        html += (receipt.voided ? "<div class=\"alert s-od\"><i class=\"fa-solid fa-ban\"></i><span><strong>Voided</strong> "
                + SP.fmtDateTime(receipt.voided.at) + " by " + e(receipt.voided.by) + ": “" + e(receipt.voided.reason)
                + "”. The money went back onto the balance.</span></div>" : "")
            + "<div class=\"receipt" + (receipt.voided ? " is-voided" : "") + "\"><div class=\"receipt-head\"><div class=\"row\"><img src=\"images/logo.svg\" alt=\"\"><strong>StoragePro</strong></div>"
            + "<span class=\"mono muted\">" + receipt.receiptNo + "</span></div>"
            + "<div class=\"dl\">"
            + "<div class=\"dl-row\"><span>Date</span><span>" + SP.fmtDateTime(receipt.at) + "</span></div>"
            + "<div class=\"dl-row\"><span>Customer</span><span>" + e(who ? who.name : "") + "</span></div>"
            + "<div class=\"dl-row\"><span>Staff</span><span>" + e(receipt.staff) + "</span></div>"
            + "<div class=\"dl-row\"><span>Method</span><span>" + SP.METHODS[receipt.method] + (receipt.reference ? " · " + e(receipt.reference) : "") + "</span></div>"
            + "</div><div class=\"dl\">"
            + receipt.lines.map(function (line) {
                var charge = SP.findCharge(line.chargeId);
                return "<div class=\"dl-row\"><span><span class=\"mono\">" + SP.findRental(charge.rentalId).locker + "</span> "
                    + (charge.type === "RENT" ? "rent" : "late fee") + ", " + SP.fmtShort(charge.due) + "</span><span>" + SP.money(line.amount) + "</span></div>";
            }).join("")
            + "<div class=\"dl-row dl-total\"><span>Paid</span><span" + (receipt.voided ? " class=\"voided\"" : "") + ">" + SP.money(receipt.amount) + "</span></div>"
            + "<div class=\"dl-row\"><span>Remaining balance</span><span>" + SP.money(receipt.balanceAfter) + "</span></div></div>"
            + "<p class=\"receipt-foot\">Thank you." + (firstRental ? " Rent is charged on the " + SP.ordinal(firstRental.chargeDay) + " of each month." : "") + "</p>"
            + "</div>"
            // Void payment button (managers and owner only)
            + (staff.manager && !receipt.voided ? "<button class=\"btn btn-ghost btn-sm no-print\" type=\"button\" id=\"void-payment\">"
                + "<i class=\"fa-solid fa-ban\"></i> Void this payment</button>" : "");
    } else {
        html += "<p class=\"list-meta\">No payments yet.</p>";
    }
    html += "</aside></div>";

    document.getElementById("page").innerHTML = html;

    // Take payment form sent: saves an Undo copy, records the payment (SP.takePayment pays the oldest charges first),
    // then reloads showing the new receipt and an Undo button
    var form = document.getElementById("pay-form");
    if (form) {
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var data = UI.formData(form);
            var before = SP.snapshot();
            var result = SP.takePayment(selected.id, SP.toCents(data.amount), data.method, data.reference, staff.name);
            if (result.error) {
                // Marks the amount box or the payment method
                UI.formError(form, result.error, /amount|balance/i.test(result.error) ? "amount" : null);
                return;
            }
            SP.offerUndo("payment of " + SP.money(result.payment.amount) + " from " + selected.name, before);
            UI.go("payments.html?customer=" + selected.id + "&receipt=" + result.payment.id,
                "Payment of " + SP.money(result.payment.amount) + " recorded · receipt " + result.payment.receiptNo, "ok", true);
        });
    }

    // Void payment (managers): asks why, marks the payment voided (it stays on file), and puts the money back on the balance
    var voidBtn = document.getElementById("void-payment");
    if (voidBtn) {
        voidBtn.addEventListener("click", function () {
            UI.confirm({
                title: "Void payment " + receipt.receiptNo + "?",
                message: SP.money(receipt.amount) + " goes back onto " + (SP.findCustomer(receipt.customerId) || {}).name + "'s balance.",
                detail: "The payment stays on file marked as voided, so there's always a record.",
                input: { label: "Why is it being voided?", placeholder: "e.g. Entered the wrong amount", required: "Say why the payment is being voided." },
                confirm: "Void payment", cancel: "Keep payment", danger: true, icon: "fa-ban"
            }).then(function (reason) {
                if (reason === null) {
                    return;
                }
                var result = SP.voidPayment(receipt.id, reason, staff);
                if (result.error) {
                    UI.formError(voidBtn.closest(".card"), result.error);
                    return;
                }
                UI.go("payments.html?customer=" + receipt.customerId + "&receipt=" + receipt.id,
                    "Payment " + receipt.receiptNo + " voided. " + SP.money(receipt.amount) + " is back on the balance.");
            });
        });
    }
})();
