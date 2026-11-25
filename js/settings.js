/* StoragePro - settings.js
   Settings page (managers only): prices, discounts, late fee, staff accounts and clear all data. */
(function () {
    "use strict";
    // Draws the sidebar and top bar; clerks are sent back to the Dashboard
    var staff = UI.start("settings", { managerOnly: true });
    if (!staff) {
        return;
    }
    // e() makes text safe for HTML. b = everything worked out (SP.board); s = prices, discounts and late fee.
    var e = UI.esc;
    var b = SP.board();
    var s = b.settings;

    // The page is four cards: prices, discounts + late fee, staff accounts, and clear all data
    var html = "<div class=\"page-head\"><div><h1>Settings</h1>"
        + "<p class=\"page-sub\">Manager only · Price changes apply to new rentals. Current rentals keep their rate.</p></div></div>"

        // Locker sizes and prices
        + "<form class=\"card card-flush\" id=\"prices-form\" novalidate><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-tags\"></i>Locker sizes and prices</span>"
        + "<span class=\"card-sub\">Discounted prices update on Save</span></div>"
        + "<table class=\"table\"><thead><tr><th>Size</th><th>Dimensions</th><th class=\"num\">Lockers</th><th>Base ($/mo)</th>"
        + "<th class=\"num\">Senior</th><th class=\"num\">AAA</th><th class=\"num\">Student</th></tr></thead><tbody>"
        // One row per locker size: base price box, and what Senior, AAA and Student would pay
        + SP.SIZE_ORDER.map(function (size) {
            return "<tr class=\"trow\"><td><strong>" + SP.SIZES[size].label + "</strong></td><td>" + SP.SIZES[size].dims + "</td>"
                + "<td class=\"num\">" + b.countSize(size) + "</td>"
                + "<td><div class=\"input-money\"><span>$</span><input class=\"input\" name=\"" + size + "\" type=\"number\" step=\"0.01\" min=\"0.01\" value=\""
                + SP.plain(s.base[size]) + "\" required></div></td>"
                + "<td class=\"num\">" + SP.money(SP.rateFor(size, "SENIOR")) + "</td>"
                + "<td class=\"num\">" + SP.money(SP.rateFor(size, "AAA")) + "</td>"
                + "<td class=\"num\">" + SP.money(SP.rateFor(size, "STUDENT")) + "</td></tr>";
        }).join("")
        + "</tbody></table><div class=\"card-foot\"><span class=\"help\">Current rentals keep the rate they started with.</span>"
        + "<button class=\"btn btn-primary\" type=\"submit\"><i class=\"fa-solid fa-floppy-disk\"></i> Save prices</button></div></form>"

        + "<div class=\"grid grid-2\">"
        // Discounts
        + "<form class=\"card\" id=\"discounts-form\" novalidate><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-percent\"></i>Discounts</span></div>"
        + "<div class=\"form-row\">"
        + "<div class=\"field\"><label for=\"d-senior\">Senior (%)</label><input class=\"input\" id=\"d-senior\" name=\"senior\" type=\"number\" min=\"0\" max=\"100\" value=\"" + s.pct.SENIOR + "\" required></div>"
        + "<div class=\"field\"><label for=\"d-aaa\">AAA (%)</label><input class=\"input\" id=\"d-aaa\" name=\"aaa\" type=\"number\" min=\"0\" max=\"100\" value=\"" + s.pct.AAA + "\" required></div>"
        + "<div class=\"field\"><label for=\"d-student\">Student (%)</label><input class=\"input\" id=\"d-student\" name=\"student\" type=\"number\" min=\"0\" max=\"100\" value=\"" + s.pct.STUDENT + "\" required></div>"
        + "</div><p class=\"note\"><i class=\"fa-solid fa-circle-info\"></i><span>One discount per customer: the highest they qualify for.</span></p>"
        + "<div class=\"form-actions\"><button class=\"btn btn-secondary\" type=\"submit\">Save discounts</button></div></form>"
        // Late fee and grace period
        + "<form class=\"card\" id=\"fee-form\" novalidate><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-hourglass-half\"></i>Late fee</span></div>"
        + "<div class=\"form-row\">"
        + "<div class=\"field\"><label for=\"fee\">Late fee</label><div class=\"input-money\"><span>$</span><input class=\"input\" id=\"fee\" name=\"lateFee\" type=\"number\" step=\"0.01\" min=\"0\" value=\"" + SP.plain(s.lateFee) + "\" required></div></div>"
        + "<div class=\"field\"><label for=\"grace\">Grace period (days)</label><input class=\"input\" id=\"grace\" name=\"graceDays\" type=\"number\" min=\"0\" max=\"60\" value=\"" + s.graceDays + "\" required></div>"
        + "</div><p class=\"note\"><i class=\"fa-solid fa-circle-info\"></i><span>Added once to a charge that is still unpaid after the grace period.</span></p>"
        + "<div class=\"form-actions\"><button class=\"btn btn-secondary\" type=\"submit\">Save late fee</button></div></form>"
        + "</div>"

        // Staff accounts
        + "<section class=\"card card-flush\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-id-badge\"></i>Staff accounts</span></div>"
        + "<table class=\"table\"><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Last sign-in</th><th class=\"num\">Actions</th></tr></thead><tbody>"
        // One row per staff account with the buttons the signed-in person may use on it
        + SP.staffList().map(function (p) {
            var me = p.username === staff.username;
            // Only shows the buttons this person is allowed to use
            var change = SP.canChange(staff, p);
            return "<tr class=\"trow\"><td><strong>" + e(p.name) + "</strong></td><td class=\"mono\">" + e(p.username) + "</td>"
                + "<td>" + (p.role === "OWNER" ? "<i class=\"fa-solid fa-crown\" style=\"color: var(--amber-dark)\"></i> " : "")
                + SP.ROLES[p.role] + "</td>"
                + "<td>" + UI.pill(p.active ? "s-av" : "s-mt", p.active ? "Active" : "Disabled") + "</td>"
                + "<td class=\"muted\">" + SP.fmtSignIn(p.lastSignIn) + "</td>"
                + "<td><div class=\"actions\">"
                + (change ? "<button class=\"btn btn-ghost btn-sm\" type=\"button\" data-reset=\"" + e(p.username) + "\">Reset password</button>" : "")
                + (change && p.active
                    ? "<button class=\"btn btn-danger btn-sm\" type=\"button\" data-disable=\"" + e(p.username) + "\"" + (me ? " disabled title=\"You can't disable your own account\"" : "") + ">Disable</button>" : "")
                + (change && !p.active
                    ? "<button class=\"btn btn-secondary btn-sm\" type=\"button\" data-enable=\"" + e(p.username) + "\">Enable</button>" : "")
                + (SP.canDelete(staff, p)
                    ? "<button class=\"btn btn-danger btn-sm\" type=\"button\" data-delete=\"" + e(p.username) + "\" title=\"Delete this account\">"
                    + "<i class=\"fa-solid fa-trash\"></i> Delete</button>" : "")
                + (!change ? "<span class=\"muted\">Owner only</span>" : "")
                + "</div></td></tr>";
        }).join("")
        + "</tbody></table>"
        // Add staff
        + "<form class=\"card-foot\" id=\"staff-form\" novalidate><div class=\"form-row\" style=\"flex: 1\">"
        + "<div class=\"field\"><label for=\"s-name\">Full name</label><input class=\"input\" id=\"s-name\" name=\"name\" required></div>"
        + "<div class=\"field\"><label for=\"s-user\">Username</label><input class=\"input\" id=\"s-user\" name=\"username\" placeholder=\"first.last\" required></div>"
        + "<div class=\"field\"><label for=\"s-role\">Role</label><select class=\"input\" id=\"s-role\" name=\"role\"><option value=\"CLERK\">Clerk</option><option value=\"MANAGER\">Manager</option></select></div>"
        + "<button class=\"btn btn-primary\" type=\"submit\"><i class=\"fa-solid fa-user-plus\"></i> Add staff</button>"
        + "</div></form></section>"

        // Clear all data
        + "<section class=\"card\"><div class=\"card-head\"><span class=\"card-title\"><i class=\"fa-solid fa-rotate-left\"></i>Clear all data</span></div>"
        + "<p class=\"muted\">All data is saved in " + SP.savedWhere() + ". Clearing it empties every locker and removes all customers, rentals and payments. "
        + "Staff accounts go back to the starting four (owner, manager and two clerks).</p>"
        + "<div class=\"form-actions\"><button class=\"btn btn-danger\" type=\"button\" id=\"reset-data\">Clear all data</button></div></section>";

    // Puts the finished HTML inside <main id="page"> in settings.html, then wires up the forms below
    document.getElementById("page").innerHTML = html;

    // Shows the result: a message on success, or an error inside the form
    function done(result, message, where, field, undoable) {
        if (result.error) {
            UI.formError(where, result.error, field);
        } else {
            UI.go("settings.html", message, "ok", undoable);
        }
    }

    // Runs handler(formData, form) when the form with this id is sent (instead of reloading the page)
    function submit(id, handler) {
        document.getElementById(id).addEventListener("submit", function (event) {
            event.preventDefault();
            handler(UI.formData(event.target), event.target);
        });
    }

    // Save prices: turns dollars into cents, then SP.savePrices() checks and saves them
    submit("prices-form", function (data, form) {
        var prices = {};
        SP.SIZE_ORDER.forEach(function (size) {
            prices[size] = SP.toCents(data[size]);
        });
        var bad = SP.SIZE_ORDER.filter(function (size) { return isNaN(prices[size]) || prices[size] <= 0; })[0];
        done(SP.savePrices(prices, staff.name), "Prices saved. They apply to new rentals.", form, bad);
    });
    // Save discounts: each one must be a whole number from 0 to 100
    submit("discounts-form", function (data, form) {
        var bad = ["senior", "aaa", "student"].filter(function (k) {
            var n = parseInt(data[k], 10);
            return isNaN(n) || n < 0 || n > 100;
        })[0];
        done(SP.saveDiscounts(parseInt(data.senior, 10), parseInt(data.aaa, 10), parseInt(data.student, 10)),
            "Discounts saved. They apply to new rentals.", form, bad);
    });
    // Save late fee and grace period
    submit("fee-form", function (data, form) {
        var fee = SP.toCents(data.lateFee);
        done(SP.saveLateFee(fee, parseInt(data.graceDays, 10)), "Late fee saved.", form,
            isNaN(fee) || fee < 0 ? "lateFee" : "graceDays");
    });
    // Add staff: creates the account with the starting password
    submit("staff-form", function (data, form) {
        var result = SP.addStaff(data.name, data.username, data.role);
        done(result, data.name.trim() + " added. Their password is " + SP.DEFAULT_PASSWORD + ".", form,
            result.error && /name/i.test(result.error) && !/username/i.test(result.error) ? "name" : "username");
    });

    // One click listener for all the staff buttons (Reset password, Disable, Enable, Delete).
    // Each button carries the username it acts on in a data- attribute.
    document.getElementById("page").addEventListener("click", function (event) {
        var button = event.target.closest("[data-reset], [data-disable], [data-enable], [data-delete]");
        if (!button) {
            return;
        }
        var card = button.closest(".card");
        var user = button.dataset.reset || button.dataset.disable || button.dataset.enable || button.dataset.delete;
        if (button.dataset.delete) {
            UI.confirm({
                title: "Delete " + user + "?",
                message: "They won't be able to sign in. Their past work (payments, rentals) stays on file.",
                detail: "You can undo this for a few seconds after.",
                confirm: "Delete account", cancel: "Keep account", danger: true, icon: "fa-user-xmark"
            }).then(function (yes) {
                if (!yes) {
                    return;
                }
                var before = SP.snapshot();
                var result = SP.deleteStaff(user, staff);
                if (result.ok) {
                    SP.offerUndo("deleting " + user, before);
                }
                done(result, "Account " + user + " deleted.", card, null, true);
            });
        // Reset password: back to the starting password for their role
        } else if (button.dataset.reset) {
            var account = SP.staffList().filter(function (p) { return p.username === user; })[0] || {};
            var resetTo = SP.startingPassword(account.role);
            UI.confirm({
                title: "Reset " + user + "'s password?",
                message: "Their password goes back to " + resetTo + ". Tell them so they can sign in.",
                confirm: "Reset password", cancel: "Cancel", icon: "fa-key"
            }).then(function (yes) {
                if (yes) {
                    done(SP.resetPassword(user, staff), "Password for " + user + " reset to " + resetTo + ".", card);
                }
            });
        // Disable / Enable: turns the account's sign-in off or on
        } else if (button.dataset.disable) {
            done(SP.setActive(user, false, staff), user + " can no longer sign in.", card);
        } else {
            done(SP.setActive(user, true, staff), user + " can sign in again.", card);
        }
    });

    // Clear all data: asks first, then goes back to the starting data (SP.resetData)
    document.getElementById("reset-data").addEventListener("click", function () {
        UI.confirm({
            title: "Clear all data?",
            message: "Every locker will be empty, and all customers, rentals, payments and tickets are removed from " + SP.savedWhere() + ".",
            detail: "This can't be undone.",
            confirm: "Clear all data", cancel: "Keep my data", danger: true, icon: "fa-trash"
        }).then(function (yes) {
            if (yes) {
                SP.resetData();
                UI.go("dashboard.html", "All data cleared. Every locker is empty.");
            }
        });
    });
})();
