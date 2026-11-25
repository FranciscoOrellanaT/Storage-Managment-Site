/* StoragePro - store.js
   All the site's data (lockers, customers, rentals, charges, payments, tickets, staff)
   and the rules for changing it. Every page loads this file and uses it through SP
   (for example SP.board(), SP.takePayment(...)). The data is saved in the Supabase
   database, or in this browser when js/supabase-config.js has no database details.

   Sections:
    1. Settings and lists
    2. Dates and money
    3. Saving, loading and Undo
    4. Starting data
    5. Billing: rent, late fees, holds
    6. Locker and customer status
    7. Payments
    8. Rentals, locker actions and maintenance tickets
    9. Customers, settings and staff
   10. Sign in and passwords
   11. Reports

   Money is stored in cents (4500 = $45.00). Dates look like "2026-10-31". */
var SP = (function () {
    "use strict";

    /* ----------------------------------------------------------------------
       1. Settings and lists
       ---------------------------------------------------------------------- */
    // Name of the localStorage slot used when the data is saved in this browser
    var KEY = "storagepro-db";
    // Version of the saved data. Changing it starts the data over.
    var VERSION = 2;

    // The four locker sizes. Each row of the building holds one size (row A = Small ...).
    // code = the short name used in page addresses; short = the letter on the map tiles.
    var SIZES = {
        SMALL: { label: "Small", dims: "5×5", row: "A", code: "small", short: "S" },
        MEDIUM: { label: "Medium", dims: "5×10", row: "B", code: "medium", short: "M" },
        LARGE: { label: "Large", dims: "10×10", row: "C", code: "large", short: "L" },
        XL: { label: "XL", dims: "10×20", row: "D", code: "xl", short: "XL" }
    };
    var SIZE_ORDER = ["SMALL", "MEDIUM", "LARGE", "XL"];
    var ROWS = ["A", "B", "C", "D"];

    // The discount choices (the percent for each one is in db.settings.pct and can change in Settings)
    var DISCOUNTS = { NONE: "None", SENIOR: "Senior", AAA: "AAA", STUDENT: "Student" };
    var DISCOUNT_ORDER = ["NONE", "SENIOR", "AAA", "STUDENT"];

    // Ways to pay
    var METHODS = { CASH: "Cash", CARD: "Card", CHECK: "Check" };

    // A locker's status: its label and its color class in styles.css
    var STATUS = {
        AVAILABLE: { label: "Available", css: "s-av" },
        OCCUPIED: { label: "Occupied", css: "s-oc" },
        OVERDUE: { label: "Overdue", css: "s-od" },
        RESERVED: { label: "Reserved", css: "s-rs" },
        MAINTENANCE: { label: "Maintenance", css: "s-mt" }
    };
    var STATUS_ORDER = ["AVAILABLE", "OCCUPIED", "OVERDUE", "RESERVED", "MAINTENANCE"];

    var DEFAULT_PASSWORD = "storagepro";   // new managers and clerks, and after a reset
    var OWNER_PASSWORD = "test1234";       // the owner account

    // The password a staff account starts with (and gets back after a reset)
    function startingPassword(role) {
        return role === "OWNER" ? OWNER_PASSWORD : DEFAULT_PASSWORD;
    }

    // Facility details shown on the customer page
    var FACILITY = {
        name: "StoragePro",
        phone: "(818) 555-0142",
        phoneLink: "+18185550142",
        email: "help@storagepro.example",
        openHour: 9,      // 9:00 AM
        closeHour: 17,    // 5:00 PM
        hoursText: "Every day, 9:00 AM – 5:00 PM",
        // The sign-in page's web address once the site is online (for example
        // "https://storagepro.example/index.html"). While it's empty, slips and welcome
        // emails show the address of the page that's open, which only works on this computer.
        website: ""
    };

    // Staff roles: the name shown, and their rank (a higher rank can manage a lower one)
    var ROLES = { OWNER: "Owner", MANAGER: "Manager", CLERK: "Clerk" };
    var RANK = { CLERK: 1, MANAGER: 2, OWNER: 3 };

    // "Medium 5×10" for a size key like "MEDIUM"
    function sizeLabel(size) {
        return SIZES[size].label + " " + SIZES[size].dims;
    }

    // The size of every locker in a row (each row holds one size), or null for an unknown row
    function sizeForRow(row) {
        for (var i = 0; i < SIZE_ORDER.length; i++) {
            if (SIZES[SIZE_ORDER[i]].row === row) {
                return SIZE_ORDER[i];
            }
        }
        return null;
    }

    // Turns the short code used in page addresses (like "m") into a size key ("MEDIUM"), or null
    function sizeFromCode(code) {
        for (var i = 0; i < SIZE_ORDER.length; i++) {
            if (SIZES[SIZE_ORDER[i]].code === code) {
                return SIZE_ORDER[i];
            }
        }
        return null;
    }


    /* ----------------------------------------------------------------------
       2. Dates and money
       ---------------------------------------------------------------------- */
    function pad(n) {
        return (n < 10 ? "0" : "") + n;
    }

    // A JavaScript Date as "YYYY-MM-DD" (the date format saved in the data)
    function isoDate(d) {
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    }

    // "YYYY-MM-DD" back into a Date (local time, so it never shifts a day)
    function parseDate(s) {
        var p = s.slice(0, 10).split("-");
        return new Date(+p[0], +p[1] - 1, +p[2]);
    }

    // "YYYY-MM-DDTHH:MM" (a date with a time) into a Date
    function parseStamp(s) {
        var d = parseDate(s);
        if (s.length > 10) {
            d.setHours(+s.slice(11, 13), +s.slice(14, 16));
        }
        return d;
    }

    // Today's date as "YYYY-MM-DD"
    function today() {
        return isoDate(new Date());
    }

    // The date and time right now as "YYYY-MM-DDTHH:MM"
    function now() {
        var d = new Date();
        return isoDate(d) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
    }

    // A date n days later (or earlier, when n is negative)
    function addDays(s, n) {
        var d = parseDate(s);
        d.setDate(d.getDate() + n);
        return isoDate(d);
    }

    // Whole days from one date to another
    function daysBetween(from, to) {
        return Math.round((parseDate(to) - parseDate(from)) / 86400000);
    }

    // Charge date in a month (short months use their last day)
    function chargeDateIn(day, y, m) {
        var last = new Date(y, m + 1, 0).getDate();
        return isoDate(new Date(y, m, Math.min(day, last)));
    }

    // Next charge date after a date
    function nextChargeAfter(day, s) {
        var d = parseDate(s);
        var thisMonth = chargeDateIn(day, d.getFullYear(), d.getMonth());
        return thisMonth > s ? thisMonth : chargeDateIn(day, d.getFullYear(), d.getMonth() + 1);
    }

    // Money with cents: $1,506.00
    function money(cents) {
        cents = cents || 0;
        var text = "$" + (Math.abs(cents) / 100).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return cents < 0 ? "−" + text : text;
    }

    // Money without cents: $3,275
    function wholeMoney(cents) {
        return "$" + Math.round(cents / 100).toLocaleString("en-US");
    }

    // Money for input boxes: 45.00
    function plain(cents) {
        return (cents / 100).toFixed(2);
    }

    // Typed amount to cents: "45.5" -> 4550
    function toCents(text) {
        var n = parseFloat(String(text).trim());
        return isNaN(n) ? NaN : Math.round(n * 100);
    }

    // Date formats for the pages: "Oct 31, 2026"
    function fmtDate(s) {
        return s ? parseDate(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
    }

    // "Oct 31"
    function fmtShort(s) {
        return s ? parseDate(s).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
    }

    // "Oct 2026"
    function fmtMonthYear(s) {
        return s ? parseDate(s).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";
    }

    // "Sat, Oct 31"
    function fmtDayDate(s) {
        return parseDate(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    }

    // The date in the top bar
    function fmtTopbar(s) {
        return parseDate(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    }

    // "Saturday, October 31"
    function fmtLong(s) {
        return parseDate(s).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    }

    // "9:42 AM"
    function fmtTime(stamp) {
        return parseStamp(stamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }

    // "Oct 31, 2026 · 9:42 AM"
    function fmtDateTime(stamp) {
        return fmtDate(stamp) + " · " + fmtTime(stamp);
    }

    // Short time: "9:42 AM", "Yesterday" or "Oct 29"
    function fmtWhen(stamp) {
        var day = stamp.slice(0, 10);
        if (day === today()) {
            return fmtTime(stamp);
        }
        if (day === addDays(today(), -1)) {
            return "Yesterday";
        }
        return fmtShort(day);
    }

    // Sign-in time: "Today 8:02 AM" or "Sep 12, 2026"
    function fmtSignIn(stamp) {
        if (!stamp) {
            return "Never";
        }
        var day = stamp.slice(0, 10);
        if (day === today()) {
            return "Today " + fmtTime(stamp);
        }
        if (day === addDays(today(), -1)) {
            return "Yesterday " + fmtTime(stamp);
        }
        return fmtDate(day);
    }

    // 1 → "1st", 2 → "2nd", 23 → "23rd" (for "rent is charged on the 5th")
    function ordinal(n) {
        if (n >= 11 && n <= 13) {
            return n + "th";
        }
        return n + (["th", "st", "nd", "rd"][n % 10] || "th");
    }

    // "1 locker", "3 lockers"
    function plural(count, word) {
        return count + " " + word + (count === 1 ? "" : "s");
    }

    // "1 day", "8 days"
    function days(count) {
        return plural(count, "day");
    }

    // 72 → "72%"
    function pct(value) {
        return value.toFixed(1) + "%";
    }

    // "Maria Lopez" → "ML" (shown in the round avatars)
    function initials(name) {
        var parts = name.trim().split(/\s+/);
        var out = "";
        for (var i = 0; i < parts.length && out.length < 2; i++) {
            out += parts[i].charAt(0).toUpperCase();
        }
        return out;
    }

    // The last word of a name (used for sorting and usernames)
    function lastName(name) {
        var parts = name.trim().split(/\s+/);
        return parts[parts.length - 1];
    }


    /* ----------------------------------------------------------------------
       3. Saving, loading and Undo

       The data is saved in the Supabase database (settings: js/supabase-config.js,
       tables: database/supabase-setup.sql).
         - Each list in db (staff, customers, lockers ...) is a table.
           One row per item: "id" = the item's id (lockers use their number, like "A-101"),
           "data" = the item itself.
         - Everything else (prices, late fee, id counters) is one row in the app_state table.
         - save() only sends the rows that changed since the last save.
       When supabase-config.js has no database details, the data is saved in this browser (localStorage) instead.
       ---------------------------------------------------------------------- */
    // db = all the data while the page is open: { lockers: [...], customers: [...], settings: {...}, ... }
    var db = null;

    // The lists in db that are saved as database tables
    var TABLES = ["staff", "customers", "lockers", "rentals", "charges", "payments", "activity", "tickets"];

    var useDatabase = isConfigured();  // true = save in Supabase
    var cantSave = false;              // true = the database couldn't be reached, so changes aren't saved
    var warned = false;                // the "can't save" message is shown once per page
    var saved = null;                  // what the database holds (rows as text), to find what changed
    var savedRev = null;               // the database's change counter when this page last read or saved

    // True when supabase-config.js holds a real address and key (not the placeholder text)
    function isConfigured() {
        var c = window.SUPABASE_CONFIG;
        return !!(c && /^https?:\/\//.test(c.url) && c.key && c.key.indexOf("PASTE") < 0);
    }

    // Sends one request to Supabase and returns the answer (or throws an error).
    // It waits for the answer before the page carries on, so the pages work exactly as before.
    function request(method, path, body, prefer) {
        var c = window.SUPABASE_CONFIG;
        var xhr = new XMLHttpRequest();
        xhr.open(method, c.url.replace(/\/+$/, "") + "/rest/v1/" + path, false);
        xhr.setRequestHeader("apikey", c.key);
        if (c.key.indexOf("eyJ") === 0) {
            // The older "anon" key also goes in the Authorization header
            xhr.setRequestHeader("Authorization", "Bearer " + c.key);
        }
        xhr.setRequestHeader("Content-Type", "application/json");
        if (prefer) {
            xhr.setRequestHeader("Prefer", prefer);
        }
        xhr.send(body === undefined ? null : JSON.stringify(body));
        if (xhr.status < 200 || xhr.status >= 300) {
            throw new Error("Supabase answered " + xhr.status + " to " + method + " " + path.split("?")[0]
                + ": " + xhr.responseText);
        }
        return xhr.responseText ? JSON.parse(xhr.responseText) : null;
    }

    // All rows of one table (Supabase sends at most 1,000 rows at a time)
    function readTable(table) {
        var rows = [];
        while (true) {
            var page = request("GET", table + "?select=id,data&order=id&limit=1000&offset=" + rows.length);
            rows = rows.concat(page);
            if (page.length < 1000) {
                return rows;
            }
        }
    }

    // Reads everything from the database. Returns null if the database is still empty.
    function readDatabase() {
        var state = request("GET", "app_state?select=data&id=eq.main");
        if (!state.length) {
            return null;
        }
        var data = state[0].data;
        TABLES.forEach(function (table) {
            data[table] = readTable(table).map(function (row) { return row.data; });
            // Keeps lists in the order they were added (A-101, A-102 ... and id 1, 2, 3 ...)
            if (table !== "lockers") {
                data[table].sort(function (a, b) { return a.id - b.id; });
            }
        });
        return data;
    }

    // The id a list item is saved under in its table: lockers use their number, everything else its id
    function rowId(table, item) {
        return table === "lockers" ? item.number : String(item.id);
    }

    // Everything in db that isn't one of the lists (goes in app_state)
    function stateOf(data) {
        var state = {};
        Object.keys(data).forEach(function (name) {
            if (TABLES.indexOf(name) < 0) {
                state[name] = data[name];
            }
        });
        return state;
    }

    // db as rows of text: { customers: { "1": "{...}" }, ..., app_state: "{...}" }
    function rowsOf(data) {
        var rows = { app_state: JSON.stringify(stateOf(data)) };
        TABLES.forEach(function (table) {
            rows[table] = {};
            (data[table] || []).forEach(function (item) {
                rows[table][rowId(table, item)] = JSON.stringify(item);
            });
        });
        return rows;
    }

    // What an empty database looks like as rows (used before the first save)
    function emptyRows() {
        return rowsOf({});
    }

    // Older data has activity without ids. Each row in the database needs one.
    function giveActivityIds() {
        db.activity.forEach(function (a) {
            if (!a.id) {
                a.id = nextId("activity");
            }
        });
    }

    // Sends only what changed since the last save
    function sendChanges() {
        // Someone else saved since this page loaded? Then our copy is out of date.
        var state = request("GET", "app_state?select=data&id=eq.main");
        var databaseRev = state.length ? state[0].data.rev : null;
        if (databaseRev !== savedRev) {
            cantSave = true;
            warned = true;
            window.alert("Someone else changed StoragePro's data while this page was open, so your last change wasn't saved. "
                + "The page will reload with the latest data. Please make the change again.");
            window.location.reload();
            return;
        }

        var now = rowsOf(db);
        TABLES.forEach(function (table) {
            var changed = [];
            var removed = [];
            Object.keys(now[table]).forEach(function (id) {
                if (saved[table][id] !== now[table][id]) {
                    changed.push({ id: id, data: JSON.parse(now[table][id]) });
                }
            });
            Object.keys(saved[table]).forEach(function (id) {
                if (!(id in now[table])) {
                    removed.push(id);
                }
            });
            // Adds new rows and updates changed ones (500 at a time)
            for (var i = 0; i < changed.length; i += 500) {
                request("POST", table + "?on_conflict=id", changed.slice(i, i + 500),
                    "resolution=merge-duplicates,return=minimal");
            }
            // Deletes rows that are gone (100 at a time)
            for (var j = 0; j < removed.length; j += 100) {
                var list = removed.slice(j, j + 100).map(function (id) {
                    return encodeURIComponent('"' + id + '"');
                }).join(",");
                request("DELETE", table + "?id=in.(" + list + ")");
            }
        });
        // Prices, late fee, id counters and the change counter
        request("POST", "app_state?on_conflict=id", [{ id: "main", data: stateOf(db) }],
            "resolution=merge-duplicates,return=minimal");
        saved = now;
        savedRev = db.rev;
    }

    // Where the data lives, for messages on the Settings page
    function savedWhere() {
        return useDatabase ? "the database" : "this browser";
    }

    // Reads the copy of db saved in this browser (localStorage), or null if there isn't one
    function readBrowserCopy() {
        try {
            return JSON.parse(localStorage.getItem(KEY));
        } catch (e) {
            return null;
        }
    }

    // Starts the data when a page opens: reads it (database or browser), fills in starting data if there's none,
    // then brings it up to date (new rent charges, late fees, ended holds)
    function load() {
        db = null;
        var fromBrowser = false;
        if (useDatabase) {
            try {
                db = readDatabase();
                saved = db ? rowsOf(db) : emptyRows();
                savedRev = db ? db.rev : null;
            } catch (e) {
                cantSave = true;
                warned = true;
                console.error(e);
                window.alert("StoragePro couldn't reach the database, so it's showing the copy saved in this browser. "
                    + "Changes made now won't be saved. Check your internet connection and js/supabase-config.js, then reload.");
            }
            // An empty database (first time): moves the data saved in this browser up to the database
            if (!db) {
                db = readBrowserCopy();
                fromBrowser = !!db && !cantSave;
            }
        } else {
            db = readBrowserCopy();
        }
        if (!db || db.version !== VERSION) {
            fromBrowser = false;
            db = seed();
            save();
        }
        // Adds the tickets list to older saved data
        if (!db.tickets) {
            db.tickets = [];
            save();
        }
        giveActivityIds();
        if (fromBrowser) {
            save();
        }
        ensureOwner();
        // One time: removes every staff account except the owner
        if (!db.ownerOnly) {
            db.staff = db.staff.filter(function (s) { return s.role === "OWNER"; });
            db.ownerOnly = true;
            save();
        }
        // One time: moves the owner from the old starting password to the new one
        if (!db.ownerPassword) {
            db.staff.forEach(function (s) {
                if (s.role === "OWNER" && s.password === DEFAULT_PASSWORD) {
                    s.password = OWNER_PASSWORD;
                }
            });
            db.ownerPassword = true;
            save();
        }
        catchUp();
        return db;
    }

    // Saves every change. Each function that changes data calls this once at the end.
    function save() {
        // Change counter (used by Undo, and to notice when someone else saved first)
        db.rev = Math.max(db.rev || 0, savedRev || 0) + 1;
        if (!useDatabase) {
            try {
                localStorage.setItem(KEY, JSON.stringify(db));
            } catch (e) {
                window.alert("This browser couldn't save StoragePro's data. Changes will be lost when you leave the page.");
            }
            return;
        }
        if (cantSave) {
            if (!warned) {
                warned = true;
                window.alert("Not connected to the database, so this change wasn't saved.");
            }
            return;
        }
        try {
            sendChanges();
        } catch (e) {
            console.error(e);
            cantSave = true;
            warned = true;
            window.alert("StoragePro couldn't save to the database, so this change wasn't saved. "
                + "Check your internet connection, then reload the page.");
        }
    }

    /* Undo for payments, move-outs and deleting staff.
       Works for 15 seconds, and only if nothing else changed. */
    // Where the Undo copy is kept (this browser), and how long the Undo button stays available
    var UNDO_KEY = "storagepro-undo";
    var UNDO_SECONDS = 15;

    // A full copy of the data as text, taken before a change that can be undone
    function snapshot() {
        return JSON.stringify(db);
    }

    // Keeps the copy from snapshot() for a few seconds so the Undo button can put it back
    function offerUndo(label, before) {
        try {
            localStorage.setItem(UNDO_KEY, JSON.stringify({ label: label, before: before, rev: db.rev,
                until: Date.now() + UNDO_SECONDS * 1000 }));
        } catch (e) {
            // No room to keep the copy: Undo is skipped
        }
    }

    // The saved Undo copy, but only if nothing else has changed since and it hasn't run out of time
    function readUndo() {
        try {
            var u = JSON.parse(localStorage.getItem(UNDO_KEY));
            return u && u.rev === db.rev && Date.now() < u.until ? u : null;
        } catch (e) {
            return null;
        }
    }

    // True while an Undo is still possible (shows the Undo button)
    function canUndo() {
        return !!readUndo();
    }

    // Puts the data back the way it was before the last undoable change
    function undo() {
        var u = readUndo();
        localStorage.removeItem(UNDO_KEY);
        if (!u) {
            return { error: "It's too late to undo that. Something else changed, or more than " + UNDO_SECONDS + " seconds passed." };
        }
        db = JSON.parse(u.before);
        log(now(), "s-rs", "rotate-left", "Undone: " + u.label, "Put back the way it was", "dashboard.html");
        save();
        return { ok: true, label: u.label };
    }

    // "Clear all data" on Settings: back to the starting data (empty lockers, starting staff accounts)
    function resetData() {
        db = seed();
        save();
    }

    // The next id number for a kind of record (customer, rental, charge ...), counting up and never reused
    function nextId(kind) {
        db.ids[kind] = (db.ids[kind] || 0) + 1;
        return db.ids[kind];
    }

    // Find one record by its id (or locker number). Each returns null when there's no match.
    function findCustomer(id) {
        id = Number(id);
        for (var i = 0; i < db.customers.length; i++) {
            if (db.customers[i].id === id) {
                return db.customers[i];
            }
        }
        return null;
    }

    // One locker by number ("b-203" works too), or null
    function findLocker(number) {
        number = String(number || "").toUpperCase();
        for (var i = 0; i < db.lockers.length; i++) {
            if (db.lockers[i].number === number) {
                return db.lockers[i];
            }
        }
        return null;
    }

    // One rental by id, or null
    function findRental(id) {
        for (var i = 0; i < db.rentals.length; i++) {
            if (db.rentals[i].id === id) {
                return db.rentals[i];
            }
        }
        return null;
    }

    // One charge by id, or null
    function findCharge(id) {
        for (var i = 0; i < db.charges.length; i++) {
            if (db.charges[i].id === id) {
                return db.charges[i];
            }
        }
        return null;
    }

    // The rental a locker is in right now (not moved out), or null if it's free
    function activeRentalFor(number) {
        for (var i = 0; i < db.rentals.length; i++) {
            if (db.rentals[i].locker === number && !db.rentals[i].moveOut) {
                return db.rentals[i];
            }
        }
        return null;
    }

    // Adds a line to Recent activity on the Dashboard (status = color, link = page it opens)
    function log(at, status, icon, title, meta, link) {
        db.activity.push({ id: nextId("activity"), at: at, status: status, icon: icon, title: title, meta: meta, link: link });
    }

    // The newest activity lines, newest first
    function recentActivity() {
        // Newest first
        return db.activity.slice().reverse().sort(function (a, b) {
            return a.at < b.at ? 1 : a.at > b.at ? -1 : 0;
        }).slice(0, 6);
    }


    /* ----------------------------------------------------------------------
       4. Starting data (first visit, or "Clear all data")
       60 empty lockers, the owner account and the default prices.
       ---------------------------------------------------------------------- */
    function seed() {
        db = {
            version: VERSION,
            ids: {},
            lastBilling: null,
            settings: {
                base: { SMALL: 4500, MEDIUM: 7000, LARGE: 12000, XL: 19500 },
                pct: { SENIOR: 10, AAA: 5, STUDENT: 15 },
                lateFee: 1500,
                graceDays: 5
            },
            staff: [],
            customers: [],
            lockers: [],
            rentals: [],
            charges: [],
            payments: [],
            activity: [],
            tickets: []
        };

        // Owner account (managers and clerks are added in Settings)
        db.staff.push({ id: nextId("staff"), name: "Francisco Orellana", username: "francisco.orellana",
            password: OWNER_PASSWORD, role: "OWNER", active: true, lastSignIn: null });
        db.ownerOnly = true;
        db.ownerPassword = true;

        // Lockers: row A = A-101 to A-115, row B = B-201 to B-215, and so on
        ROWS.forEach(function (row, r) {
            for (var n = 1; n <= 15; n++) {
                db.lockers.push({ number: row + "-" + ((r + 1) * 100 + n), row: row, size: sizeForRow(row),
                    maintenance: false, maintenanceNote: null, holdFor: null, holdUntil: null });
            }
        });

        db.lastBilling = today();
        return db;
    }


    /* ----------------------------------------------------------------------
       5. Billing: rent, late fees, holds (runs once a day)
       ---------------------------------------------------------------------- */
    function catchUp() {
        var t = today();
        if (db.lastBilling === t) {
            return;
        }
        addRentCharges(t);
        addLateFees(t);
        expireHolds(t);
        db.lastBilling = t;
        save();
    }

    // Every charge not fully paid, oldest first. Payments pay them in this order.
    function unpaidCharges() {
        return db.charges.filter(function (c) {
            return c.paid < c.amount;
        }).sort(function (a, b) {
            return a.due < b.due ? -1 : a.due > b.due ? 1 : a.id - b.id;
        });
    }

    // Adds a rent charge for every month that has come due up to date t, for every active rental.
    // Runs each day the site is opened, so nothing is missed even after a few days closed.
    function addRentCharges(t) {
        var lastRent = {};
        db.charges.forEach(function (c) {
            if (c.type === "RENT" && (!lastRent[c.rentalId] || c.due > lastRent[c.rentalId])) {
                lastRent[c.rentalId] = c.due;
            }
        });
        db.rentals.forEach(function (rental) {
            if (rental.moveOut) {
                return;
            }
            var last = lastRent[rental.id];
            var next = last ? nextChargeAfter(rental.chargeDay, last) : rental.moveIn;
            while (next <= t) {
                db.charges.push({ id: nextId("charge"), rentalId: rental.id, due: next, type: "RENT",
                    amount: rental.monthlyRate, paid: 0, paidOn: null, lateFeeAdded: false });
                next = nextChargeAfter(rental.chargeDay, next);
            }
        });
    }

    // Adds the late fee (once) to every rent charge still unpaid after the grace period
    function addLateFees(t) {
        var s = db.settings;
        unpaidCharges().forEach(function (charge) {
            if (charge.type !== "RENT" || charge.lateFeeAdded || s.lateFee <= 0) {
                return;
            }
            var feeDate = addDays(charge.due, s.graceDays + 1);
            if (feeDate > t) {
                return;
            }
            var rental = findRental(charge.rentalId);
            db.charges.push({ id: nextId("charge"), rentalId: rental.id, due: feeDate, type: "LATE_FEE",
                amount: s.lateFee, paid: 0, paidOn: null, lateFeeAdded: false });
            charge.lateFeeAdded = true;
            log(feeDate + "T09:00", "s-od", "circle-exclamation",
                money(s.lateFee) + " late fee added to " + rental.locker,
                findCustomer(rental.customerId).name + " · " + s.graceDays + "-day grace period passed",
                "locker.html?n=" + rental.locker);
        });
    }

    // Ends holds whose date has passed, so those lockers can be rented again
    function expireHolds(t) {
        db.lockers.forEach(function (locker) {
            if (locker.holdUntil && locker.holdUntil < t) {
                log(t + "T00:00", "s-av", "clock", "Hold on " + locker.number + " ended",
                    "Was held for " + locker.holdFor, "locker.html?n=" + locker.number);
                locker.holdFor = null;
                locker.holdUntil = null;
            }
        });
    }


    /* ----------------------------------------------------------------------
       6. Locker and customer status (built fresh for each page)
       ---------------------------------------------------------------------- */
    function lockerView(locker, rental, unpaid, t) {
        var v = { number: locker.number, locker: locker, rental: rental, unpaid: unpaid,
            customer: rental ? findCustomer(rental.customerId) : null,
            balance: 0, oldestUnpaid: null, daysOverdue: 0, dueToday: false, nextCharge: null };
        unpaid.forEach(function (c) {
            v.balance += c.amount - c.paid;
            if (!v.oldestUnpaid || c.due < v.oldestUnpaid) {
                v.oldestUnpaid = c.due;
            }
        });
        if (rental) {
            var late = v.oldestUnpaid && v.oldestUnpaid < t;
            v.status = late ? "OVERDUE" : "OCCUPIED";
            v.daysOverdue = late ? daysBetween(v.oldestUnpaid, t) : 0;
            v.dueToday = v.oldestUnpaid === t;
            v.nextCharge = nextChargeAfter(rental.chargeDay, t);
        } else if (locker.maintenance) {
            v.status = "MAINTENANCE";
        } else if (locker.holdFor && locker.holdUntil && locker.holdUntil >= t) {
            v.status = "RESERVED";
        } else {
            v.status = "AVAILABLE";
        }
        v.rented = !!rental;
        v.css = STATUS[v.status].css;
        v.label = STATUS[v.status].label;
        v.tileSub = v.rented ? lastName(v.customer.name)
            : { AVAILABLE: "Open", RESERVED: "Hold", MAINTENANCE: "Repair" }[v.status];
        v.footer = v.status === "OVERDUE" ? days(v.daysOverdue) + " overdue"
            : v.status === "OCCUPIED" ? (v.dueToday ? "Rent due today" : "Next charge " + fmtShort(v.nextCharge))
            : { AVAILABLE: "Ready to rent", RESERVED: "On hold", MAINTENANCE: "Not rentable until fixed" }[v.status];
        v.icon = { OVERDUE: "fa-triangle-exclamation", RESERVED: "fa-clock", MAINTENANCE: "fa-wrench" }[v.status] || null;
        return v;
    }

    // One customer with everything the pages show worked out: lockers, total balance, monthly rent,
    // days overdue, the most overdue locker, and a status label for the table
    function customerView(customer, lockers) {
        var v = { id: customer.id, name: customer.name, customer: customer, lockers: lockers,
            balance: 0, monthly: 0, daysOverdue: 0, dueToday: false, oldestUnpaid: null, mostOverdue: null };
        lockers.forEach(function (l) {
            v.balance += l.balance;
            v.monthly += l.rental.monthlyRate;
            if (l.dueToday) {
                v.dueToday = true;
            }
            if (!v.mostOverdue || l.daysOverdue > v.mostOverdue.daysOverdue) {
                v.mostOverdue = l;
            }
            v.daysOverdue = Math.max(v.daysOverdue, l.daysOverdue);
            if (l.oldestUnpaid && (!v.oldestUnpaid || l.oldestUnpaid < v.oldestUnpaid)) {
                v.oldestUnpaid = l.oldestUnpaid;
            }
        });
        v.overdue = v.daysOverdue > 0;
        // Former customer: no lockers now, but the file is kept
        v.movedOut = !lockers.length && db.rentals.some(function (r) { return r.customerId === customer.id; });
        v.statusLabel = v.overdue ? "Overdue" : v.dueToday ? "Due today" : v.movedOut ? "Moved out" : "Current";
        v.statusCss = v.overdue ? "s-od" : v.dueToday ? "s-rs" : v.movedOut ? "s-mt" : "s-av";
        v.statusRank = v.overdue ? 0 : v.dueToday ? 1 : v.movedOut ? 3 : 2;
        v.lockerNumbers = lockers.length ? lockers.map(function (l) { return l.number; }).join(", ") : "—";
        return v;
    }

    // Everything the pages show, worked out in one go: every locker with its status, renter, balance and
    // days overdue, every customer (customerView), and counts for the Dashboard. Pages call this once when they load.
    function board() {
        var t = today();
        var rentalByLocker = {};
        db.rentals.forEach(function (r) {
            if (!r.moveOut) {
                rentalByLocker[r.locker] = r;
            }
        });
        var unpaidByRental = {};
        unpaidCharges().forEach(function (c) {
            (unpaidByRental[c.rentalId] = unpaidByRental[c.rentalId] || []).push(c);
        });

        var lockers = db.lockers.slice().sort(function (a, b) {
            return a.number < b.number ? -1 : 1;
        }).map(function (locker) {
            var rental = rentalByLocker[locker.number] || null;
            return lockerView(locker, rental, rental ? (unpaidByRental[rental.id] || []) : [], t);
        });

        var lockersByCustomer = {};
        lockers.forEach(function (l) {
            if (l.rented) {
                (lockersByCustomer[l.customer.id] = lockersByCustomer[l.customer.id] || []).push(l);
            }
        });
        var customers = db.customers.slice().sort(function (a, b) {
            return a.name.localeCompare(b.name);
        }).map(function (c) {
            return customerView(c, lockersByCustomer[c.id] || []);
        });

        var b = {
            today: t,
            settings: db.settings,
            lockers: lockers,
            customers: customers,
            locker: function (number) {
                number = String(number || "").toUpperCase();
                return lockers.filter(function (l) { return l.number === number; })[0] || null;
            },
            customer: function (id) {
                id = Number(id);
                return customers.filter(function (c) { return c.id === id; })[0] || null;
            },
            count: function (status) {
                return lockers.filter(function (l) { return l.status === status; }).length;
            },
            countSize: function (size) {
                return lockers.filter(function (l) { return l.locker.size === size; }).length;
            },
            countAvailable: function (size) {
                return lockers.filter(function (l) { return l.locker.size === size && l.status === "AVAILABLE"; }).length;
            },
            inRow: function (row) {
                return lockers.filter(function (l) { return l.locker.row === row; });
            },
            overdueCustomers: function () {
                return customers.filter(function (c) { return c.overdue; })
                    .sort(function (a, b2) { return b2.daysOverdue - a.daysOverdue; });
            }
        };
        b.rented = lockers.filter(function (l) { return l.rented; }).length;
        b.occupancyPct = lockers.length ? b.rented * 100 / lockers.length : 0;
        b.totalOwed = customers.reduce(function (sum, c) { return sum + c.balance; }, 0);
        b.accountsOwing = customers.filter(function (c) { return c.balance > 0; }).length;
        return b;
    }


    /* ----------------------------------------------------------------------
       7. Payments (money goes to the oldest unpaid charge first)
       ---------------------------------------------------------------------- */
    function unpaidFor(customerId) {
        customerId = Number(customerId);
        return unpaidCharges().filter(function (c) {
            return findRental(c.rentalId).customerId === customerId;
        }).sort(function (a, b) {
            if (a.due !== b.due) {
                return a.due < b.due ? -1 : 1;
            }
            var la = findRental(a.rentalId).locker;
            var lb = findRental(b.rentalId).locker;
            return la !== lb ? (la < lb ? -1 : 1) : a.id - b.id;
        });
    }

    // What one customer owes right now, in cents
    function balanceOf(customerId) {
        return unpaidFor(customerId).reduce(function (sum, c) { return sum + c.amount - c.paid; }, 0);
    }

    // Receipt number like "R-20261031-004" (date + the day's count)
    function receiptNo(at) {
        var day = at.slice(0, 10);
        var count = db.payments.filter(function (p) { return p.at.slice(0, 10) === day; }).length;
        return "R-" + day.replace(/-/g, "") + "-" + String(count + 1).padStart(3, "0");
    }

    // The locker numbers a payment went to, like "B-203, C-305"
    function paymentLockers(payment) {
        var seen = [];
        payment.lines.forEach(function (line) {
            var number = findRental(findCharge(line.chargeId).rentalId).locker;
            if (seen.indexOf(number) < 0) {
                seen.push(number);
            }
        });
        return seen.join(", ");
    }

    // Saves a payment and spreads it over the charges given, oldest first.
    // Each part paid is written in payment.lines so the receipt can list it.
    function record(customer, amount, method, reference, staffName, charges) {
        var at = now();
        var payment = { id: nextId("payment"), customerId: customer.id, amount: amount, method: method,
            reference: reference ? reference.trim() : null, at: at, staff: staffName,
            receiptNo: receiptNo(at), balanceAfter: 0, lines: [] };
        var left = amount;
        charges.forEach(function (charge) {
            if (left <= 0) {
                return;
            }
            var used = Math.min(left, charge.amount - charge.paid);
            charge.paid += used;
            if (charge.paid >= charge.amount) {
                charge.paidOn = at.slice(0, 10);
            }
            payment.lines.push({ chargeId: charge.id, amount: used });
            left -= used;
        });
        db.payments.push(payment);
        payment.balanceAfter = balanceOf(customer.id);
        log(at, "s-av", "money-bill-wave", "Payment of " + money(amount) + " from " + customer.name,
            paymentLockers(payment) + " · " + METHODS[method] + " · by " + staffName,
            "payments.html?customer=" + customer.id + "&receipt=" + payment.id);
        save();
        return payment;
    }

    // Takes a payment. Returns { payment } or { error }.
    function takePayment(customerId, amount, method, reference, staffName) {
        var customer = findCustomer(customerId);
        if (!customer) {
            return { error: "That customer no longer exists." };
        }
        var balance = balanceOf(customer.id);
        if (isNaN(amount) || amount <= 0) {
            return { error: "Enter an amount greater than $0.00." };
        }
        if (amount > balance) {
            return { error: "The amount can't be more than the balance (" + money(balance) + ")." };
        }
        if (!METHODS[method]) {
            return { error: "Choose cash, card or check." };
        }
        return { payment: record(customer, amount, method, reference, staffName, unpaidFor(customer.id)) };
    }

    /* Voids a payment (managers and owner only).
       The money goes back onto the charges, and the payment stays on file marked voided. */
    function voidPayment(id, reason, me) {
        var payment = findPayment(id);
        if (!me || !me.manager) {
            return { error: "Only a manager or the owner can void a payment." };
        }
        if (!payment) {
            return { error: "That payment doesn't exist." };
        }
        if (payment.voided) {
            return { error: "This payment is already voided." };
        }
        if (!reason || reason.trim().length < 3) {
            return { error: "Say why the payment is being voided." };
        }
        var ended = payment.lines.some(function (line) {
            return findRental(findCharge(line.chargeId).rentalId).moveOut;
        });
        if (ended) {
            return { error: "This payment is for a rental that has ended, so it can't be voided here." };
        }
        payment.lines.forEach(function (line) {
            var charge = findCharge(line.chargeId);
            charge.paid = Math.max(0, charge.paid - line.amount);
            if (charge.paid < charge.amount) {
                charge.paidOn = null;
            }
        });
        payment.voided = { at: now(), by: me.name, reason: reason.trim() };
        var customer = findCustomer(payment.customerId);
        log(payment.voided.at, "s-od", "ban", "Payment voided: " + money(payment.amount) + " from " + customer.name,
            payment.receiptNo + " · " + payment.voided.reason + " · by " + me.name,
            "payments.html?customer=" + customer.id + "&receipt=" + payment.id);
        save();
        return { ok: true, payment: payment };
    }

    // One payment by id, or null
    function findPayment(id) {
        id = Number(id);
        return db.payments.filter(function (p) { return p.id === id; })[0] || null;
    }

    // The newest payment (shown as "Last receipt" on Payments)
    function lastPayment() {
        var last = null;
        db.payments.forEach(function (p) {
            if (!last || p.at > last.at || (p.at === last.at && p.id > last.id)) {
                last = p;
            }
        });
        return last;
    }

    // A customer's payments, newest first (at most "limit" of them)
    function paymentsFor(customerId, limit) {
        customerId = Number(customerId);
        return db.payments.filter(function (p) { return p.customerId === customerId; })
            .sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : b.id - a.id; })
            .slice(0, limit || 6);
    }

    // Every rental a customer has had, newest first
    function rentalsFor(customerId) {
        customerId = Number(customerId);
        return db.rentals.filter(function (r) { return r.customerId === customerId; })
            .sort(function (a, b) { return a.moveIn < b.moveIn ? 1 : -1; });
    }

    // A rental's charges, newest first (the Charges table on a locker's page)
    function chargesFor(rentalId) {
        return db.charges.filter(function (c) { return c.rentalId === rentalId; })
            .sort(function (a, b) { return a.due < b.due ? 1 : a.due > b.due ? -1 : b.id - a.id; });
    }


    /* ----------------------------------------------------------------------
       8. Rentals, locker actions and maintenance tickets
       Each returns { ok: true, ... } or { error: "message" }.
       ---------------------------------------------------------------------- */
    function rateFor(size, discount) {
        var base = db.settings.base[size];
        var off = discount === "NONE" ? 0 : Math.round(base * db.settings.pct[discount] / 100);
        return base - off;
    }

    // The percent off for a discount key ("SENIOR" → 10); 0 for no discount
    function discountPct(discount) {
        return discount === "NONE" ? 0 : db.settings.pct[discount];
    }

    // New rental: checks the locker and the customer details, adds the customer if they're new, starts the rental
    // at the discounted rate, charges the first month and records its payment. Returns { ok, rental, customer, payment } or { error }.
    function createRental(req, staffName) {
        var t = today();
        var locker = findLocker(req.locker);
        if (!locker) {
            return { error: "Choose a locker." };
        }
        if (activeRentalFor(locker.number)) {
            return { error: locker.number + " is already rented." };
        }
        if (locker.maintenance) {
            return { error: locker.number + " is in maintenance." };
        }
        if (!DISCOUNTS[req.discount]) {
            return { error: "Choose a discount (or None)." };
        }
        if (!METHODS[req.method]) {
            return { error: "Choose how the first payment is made." };
        }
        var moveIn = req.moveIn || t;
        if (moveIn < t || moveIn > addDays(t, 30)) {
            return { error: "The move-in date must be between today and 30 days from now." };
        }

        var customer;
        if (req.name && req.name.trim()) {
            // Checks the new customer's details (no duplicate email or phone)
            var problems = checkCustomerDetails({ name: req.name, phone: req.phone, email: req.email });
            var firstProblem = Object.keys(problems)[0];
            if (firstProblem) {
                return { error: problems[firstProblem] };
            }
            customer = { id: nextId("customer"), name: req.name.trim(), phone: req.phone.trim(),
                email: req.email && req.email.trim() ? req.email.trim() : null,
                discount: "NONE", since: moveIn, notes: "", password: null, portalDisabled: false };
            giveTempPassword(customer);
            customer.isNew = true;
            db.customers.push(customer);
        } else {
            customer = findCustomer(req.customerId);
            if (!customer) {
                return { error: "Choose a customer or add a new one." };
            }
        }
        customer.discount = req.discount;

        // Renting again reopens an account that closed on move-out
        var accountReopened = false;
        if (customer.portalDisabled && customer.portalReason === "MOVED_OUT") {
            customer.portalDisabled = false;
            customer.portalReason = null;
            customer.portalNote = null;
            customer.portalChangedAt = now();
            customer.portalChangedBy = staffName;
            accountReopened = true;
            log(customer.portalChangedAt, "s-av", "unlock", "Online account reopened: " + customer.name,
                "Renting again · by " + staffName, "customers.html?id=" + customer.id);
        }

        var rate = rateFor(locker.size, req.discount);
        var rental = { id: nextId("rental"), locker: locker.number, customerId: customer.id, moveIn: moveIn,
            moveOut: null, plannedMoveOut: null, discount: req.discount,
            baseRate: db.settings.base[locker.size], monthlyRate: rate, chargeDay: parseDate(moveIn).getDate() };
        db.rentals.push(rental);
        locker.holdFor = null;
        locker.holdUntil = null;

        // First month is charged and paid at the desk
        var first = { id: nextId("charge"), rentalId: rental.id, due: moveIn, type: "RENT",
            amount: rate, paid: 0, paidOn: null, lateFeeAdded: false };
        db.charges.push(first);
        var payment = record(customer, rate, req.method, "First month", staffName, [first]);

        log(now(), "s-oc", "file-signature", "Rental started: " + locker.number + " for " + customer.name,
            sizeLabel(locker.size) + " · " + (req.discount === "NONE" ? "No discount" : DISCOUNTS[req.discount] + " discount")
                + " · " + money(rate) + "/mo", "locker.html?n=" + locker.number);
        save();
        // Tells the page to show the new customer's sign-in slip
        var newCustomer = !!customer.isNew;
        delete customer.isNew;
        save();
        return { ok: true, rental: rental, customer: customer, payment: payment, newCustomer: newCustomer,
            accountReopened: accountReopened };
    }

    // Ends a rental. The balance must be $0.00 first. A customer's last move-out also closes their online account.
    function moveOut(number, staffName) {
        var locker = findLocker(number);
        var rental = locker && activeRentalFor(locker.number);
        if (!rental) {
            return { error: number + " isn't rented." };
        }
        var owed = unpaidCharges().filter(function (c) { return c.rentalId === rental.id; })
            .reduce(function (sum, c) { return sum + c.amount - c.paid; }, 0);
        if (owed > 0) {
            return { error: "Move out needs a $0.00 balance. " + number + " owes " + money(owed) + "." };
        }
        rental.moveOut = today();
        var customer = findCustomer(rental.customerId);
        log(now(), "s-oc", "right-from-bracket", customer.name + " moved out of " + number,
            sizeLabel(locker.size) + " · by " + staffName, "locker.html?n=" + number);

        // Last locker: close the online account, but keep the customer file
        var accountClosed = false;
        var stillRenting = db.rentals.some(function (r) { return r.customerId === customer.id && !r.moveOut; });
        if (!stillRenting && !customer.portalDisabled) {
            customer.portalDisabled = true;
            customer.portalReason = "MOVED_OUT";
            customer.portalNote = "Closed automatically after moving out of " + number + ".";
            customer.portalChangedAt = now();
            customer.portalChangedBy = staffName;
            accountClosed = true;
            log(customer.portalChangedAt, "s-mt", "lock", "Online account closed: " + customer.name,
                "Moved out · file and payments kept", "customers.html?id=" + customer.id);
        }
        save();
        return { ok: true, customer: customer, accountClosed: accountClosed };
    }

    // Mark as fixed: puts the locker back in service and resolves its open tickets
    function finishMaintenance(number, staffName) {
        var locker = findLocker(number);
        if (!locker || !locker.maintenance) {
            return { error: number + " isn't in maintenance." };
        }
        var at = now();
        db.tickets.forEach(function (t) {
            if (t.locker === locker.number && t.status !== "RESOLVED") {
                t.status = "RESOLVED";
                t.resolvedAt = at;
                t.resolvedBy = staffName;
                t.resolution = "Marked as fixed from the locker page.";
            }
        });
        locker.maintenance = false;
        locker.maintenanceNote = null;
        log(at, "s-av", "circle-check", number + " is ready to rent", "Maintenance finished · by " + staffName,
            "locker.html?n=" + number);
        save();
        return { ok: true };
    }

    // Holds an open locker for a person until a date (today to 14 days ahead)
    function hold(number, holdFor, until, staffName) {
        var t = today();
        var locker = findLocker(number);
        if (!locker || activeRentalFor(locker.number) || locker.maintenance) {
            return { error: "Only an open locker can be held." };
        }
        if (!holdFor || !holdFor.trim()) {
            return { error: "Enter who the locker is held for." };
        }
        if (!until || until < t || until > addDays(t, 14)) {
            return { error: "A hold can last up to 14 days." };
        }
        locker.holdFor = holdFor.trim();
        locker.holdUntil = until;
        log(now(), "s-rs", "clock", number + " held for " + locker.holdFor,
            "Hold until " + fmtShort(until) + " · by " + staffName, "locker.html?n=" + number);
        save();
        return { ok: true };
    }

    // Ends a hold early
    function releaseHold(number, staffName) {
        var locker = findLocker(number);
        if (!locker || !locker.holdFor) {
            return { error: number + " isn't on hold." };
        }
        var name = locker.holdFor;
        locker.holdFor = null;
        locker.holdUntil = null;
        log(now(), "s-av", "unlock", "Hold on " + number + " released", "Was held for " + name + " · by " + staffName,
            "locker.html?n=" + number);
        save();
        return { ok: true };
    }

    /* Maintenance tickets: Open -> In progress -> Resolved (or Reopen).
       A ticket can take an empty locker out of service until it is resolved. */
    // Maintenance ticket choices: what's wrong (with an icon), how urgent, and the status steps
    var TICKET_CATEGORIES = {
        DOOR: { label: "Door or lock", icon: "fa-door-closed" },
        LEAK: { label: "Leak or water", icon: "fa-droplet" },
        DAMAGE: { label: "Damage", icon: "fa-house-crack" },
        PEST: { label: "Pests", icon: "fa-bug" },
        LIGHT: { label: "Lighting", icon: "fa-lightbulb" },
        CLEAN: { label: "Cleaning", icon: "fa-broom" },
        OTHER: { label: "Something else", icon: "fa-circle-question" }
    };
    var TICKET_PRIORITIES = {
        URGENT: { label: "Urgent", help: "Fix today", css: "s-od", rank: 0 },
        NORMAL: { label: "Normal", help: "Fix this week", css: "s-oc", rank: 1 },
        LOW: { label: "Low", help: "When there's time", css: "s-mt", rank: 2 }
    };
    var TICKET_STATUS = {
        OPEN: { label: "Open", css: "s-rs" },
        IN_PROGRESS: { label: "In progress", css: "s-oc" },
        RESOLVED: { label: "Resolved", css: "s-av" }
    };

    // One maintenance ticket by id, or null
    function findTicket(id) {
        id = Number(id);
        return db.tickets.filter(function (t) { return t.id === id; })[0] || null;
    }

    // Sort order: urgent first, then oldest. Resolved: newest first.
    function ticketList(which) {
        return db.tickets.filter(function (t) {
            return which === "ALL" || (which === "RESOLVED" ? t.status === "RESOLVED" : t.status !== "RESOLVED");
        }).sort(function (a, b) {
            if (a.status === "RESOLVED" || b.status === "RESOLVED") {
                return a.status !== b.status ? (a.status === "RESOLVED" ? 1 : -1) : (a.createdAt < b.createdAt ? 1 : -1);
            }
            var p = TICKET_PRIORITIES[a.priority].rank - TICKET_PRIORITIES[b.priority].rank;
            return p || (a.createdAt < b.createdAt ? -1 : 1);
        });
    }

    // How many tickets are open, in progress, resolved, still active, and urgent
    function ticketCounts() {
        var counts = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, ACTIVE: 0, URGENT: 0 };
        db.tickets.forEach(function (t) {
            counts[t.status]++;
            if (t.status !== "RESOLVED") {
                counts.ACTIVE++;
                if (t.priority === "URGENT") {
                    counts.URGENT++;
                }
            }
        });
        return counts;
    }

    // Creates a ticket. Returns { ticket } or { errors: { field: message } }.
    function createTicket(req, staffName) {
        var errors = {};
        var locker = req.locker ? findLocker(req.locker) : null;
        if (req.locker && !locker) {
            errors.locker = "Pick a locker from the list.";
        }
        if (!TICKET_CATEGORIES[req.category]) {
            errors.category = "Choose what kind of problem it is.";
        }
        if (!TICKET_PRIORITIES[req.priority]) {
            errors.priority = "Choose how urgent it is.";
        }
        var description = (req.description || "").trim();
        if (description.length < 5) {
            errors.description = "Describe the problem in a few words (at least 5 characters).";
        }
        if (req.outOfService && (!locker || activeRentalFor(locker.number))) {
            errors.outOfService = "Only an empty locker can be taken out of service.";
        }
        if (Object.keys(errors).length) {
            return { errors: errors };
        }

        var at = now();
        var id = nextId("ticket");
        var ticket = {
            id: id, number: "T-" + String(id).padStart(4, "0"),
            locker: locker ? locker.number : null, category: req.category, priority: req.priority,
            description: description, outOfService: !!req.outOfService,
            status: "OPEN", createdAt: at, reportedBy: staffName,
            // Set when a customer sent it
            customerId: req.customerId ? Number(req.customerId) : null,
            startedAt: null, startedBy: null, resolvedAt: null, resolvedBy: null, resolution: null
        };
        db.tickets.push(ticket);
        if (ticket.outOfService) {
            locker.holdFor = null;
            locker.holdUntil = null;
            locker.maintenance = true;
            locker.maintenanceNote = TICKET_CATEGORIES[req.category].label + " · " + ticket.number;
        }
        log(at, "s-mt", "screwdriver-wrench", ticket.number + " reported" + (locker ? " for " + locker.number : ""),
            TICKET_CATEGORIES[req.category].label + " · " + TICKET_PRIORITIES[req.priority].label + " · by " + staffName,
            "maintenance.html?ticket=" + id);
        save();
        return { ticket: ticket };
    }

    // Ticket steps: start work (Open → In progress), resolve with what was done (puts an out-of-service
    // locker back in service), and reopen
    function startTicket(id, staffName) {
        var t = findTicket(id);
        if (!t || t.status !== "OPEN") {
            return { error: "Only an open ticket can be started." };
        }
        t.status = "IN_PROGRESS";
        t.startedAt = now();
        t.startedBy = staffName;
        save();
        return { ok: true, ticket: t };
    }

    // Resolve: needs a few words on what was done
    function resolveTicket(id, resolution, staffName) {
        var t = findTicket(id);
        if (!t || t.status === "RESOLVED") {
            return { error: "This ticket is already resolved." };
        }
        if (!resolution || resolution.trim().length < 3) {
            return { error: "Say what was done so the next person knows." };
        }
        t.status = "RESOLVED";
        t.resolvedAt = now();
        t.resolvedBy = staffName;
        t.resolution = resolution.trim();
        var backInService = false;
        if (t.outOfService && t.locker) {
            var stillOpen = db.tickets.some(function (o) {
                return o.locker === t.locker && o.outOfService && o.status !== "RESOLVED";
            });
            var locker = findLocker(t.locker);
            if (!stillOpen && locker && locker.maintenance) {
                locker.maintenance = false;
                locker.maintenanceNote = null;
                backInService = true;
            }
        }
        log(t.resolvedAt, "s-av", "circle-check", t.number + " resolved" + (t.locker ? " for " + t.locker : ""),
            t.resolution + (backInService ? " · back in service" : "") + " · by " + staffName, "maintenance.html?ticket=" + t.id);
        save();
        return { ok: true, ticket: t, backInService: backInService };
    }

    // Reopen a resolved ticket (back to Open)
    function reopenTicket(id, staffName) {
        var t = findTicket(id);
        if (!t || t.status !== "RESOLVED") {
            return { error: "Only a resolved ticket can be reopened." };
        }
        t.status = "OPEN";
        t.startedAt = null;
        t.startedBy = null;
        t.resolvedAt = null;
        t.resolvedBy = null;
        t.resolution = null;
        // Reopened: the locker stays in service
        t.outOfService = false;
        log(now(), "s-rs", "rotate-left", t.number + " reopened", "by " + staffName, "maintenance.html?ticket=" + t.id);
        save();
        return { ok: true, ticket: t };
    }


    /* ----------------------------------------------------------------------
       9. Customers, settings and staff
       ---------------------------------------------------------------------- */
    function saveNotes(id, notes) {
        var customer = findCustomer(id);
        if (!customer) {
            return { error: "That customer no longer exists." };
        }
        customer.notes = notes.trim();
        save();
        return { ok: true };
    }

    /* Checks a customer's name, phone and email (no two customers can share them).
       Returns { field: message }, empty if fine. */
    function checkCustomerDetails(d, exceptId) {
        var errors = {};
        var name = (d.name || "").trim();
        var phone = (d.phone || "").trim();
        var email = (d.email || "").trim().toLowerCase();
        var digits = phone.replace(/\D/g, "");
        if (name.length < 2) {
            errors.name = "Enter the customer's full name.";
        }
        if (digits.length < 7) {
            errors.phone = "Enter a phone number with at least 7 digits.";
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.email = "That doesn't look like an email address.";
        }
        if (d.discount && !DISCOUNTS[d.discount]) {
            errors.discount = "Choose a discount.";
        }
        db.customers.forEach(function (c) {
            if (c.id === Number(exceptId)) {
                return;
            }
            if (!errors.phone && c.phone.replace(/\D/g, "").slice(-10) === digits.slice(-10)) {
                errors.phone = "This phone number already belongs to " + c.name + ".";
            }
            if (!errors.email && email && c.email && c.email.toLowerCase() === email) {
                errors.email = "This email already belongs to " + c.name + ".";
            }
        });
        return errors;
    }

    // Creates a customer account. Returns { customer } or { errors }.
    function createCustomer(d, staffName) {
        var errors = checkCustomerDetails(d);
        if (Object.keys(errors).length) {
            return { errors: errors };
        }
        var customer = {
            id: nextId("customer"), name: d.name.trim(), phone: d.phone.trim(),
            email: d.email && d.email.trim() ? d.email.trim() : null,
            discount: DISCOUNTS[d.discount] ? d.discount : "NONE",
            since: today(), notes: "", password: null, portalDisabled: false
        };
        var temp = giveTempPassword(customer);
        db.customers.push(customer);
        log(now(), "s-av", "user-plus", "Customer account created: " + customer.name,
            (customer.email || customer.phone) + " · by " + staffName, "customers.html?id=" + customer.id);
        save();
        return { customer: customer, tempPassword: temp };
    }

    // Updates a customer's details. A new discount only applies to new rentals.
    function updateCustomer(id, d, staffName) {
        var customer = findCustomer(id);
        if (!customer) {
            return { errors: { name: "That customer no longer exists." } };
        }
        var errors = checkCustomerDetails(d, customer.id);
        if (Object.keys(errors).length) {
            return { errors: errors };
        }
        customer.name = d.name.trim();
        customer.phone = d.phone.trim();
        customer.email = d.email && d.email.trim() ? d.email.trim() : null;
        if (DISCOUNTS[d.discount]) {
            customer.discount = d.discount;
        }
        log(now(), "s-oc", "user-pen", "Customer details updated: " + customer.name, "by " + staffName,
            "customers.html?id=" + customer.id);
        save();
        return { ok: true, customer: customer };
    }

    // Why a customer's online account can be paused (MOVED_OUT is set automatically)
    var PAUSE_REASONS = {
        OVERDUE: "Overdue payment",
        REQUEST: "Customer asked",
        SECURITY: "Account security",
        OTHER: "Other",
        // Set by move-out, not by staff
        MOVED_OUT: "Moved out"
    };

    // Pauses a customer's online account (with a reason) or turns it back on
    function setCustomerAccess(id, enabled, reason, note, staffName) {
        var customer = findCustomer(id);
        if (!customer) {
            return { error: "That customer no longer exists." };
        }
        if (!enabled && !PAUSE_REASONS[reason]) {
            return { error: "Choose why the account is being paused." };
        }
        customer.portalDisabled = !enabled;
        customer.portalReason = enabled ? null : reason;
        customer.portalNote = enabled ? null : (note || "").trim() || null;
        customer.portalChangedAt = now();
        customer.portalChangedBy = staffName;
        log(customer.portalChangedAt, enabled ? "s-av" : "s-od", enabled ? "unlock" : "lock",
            "Online account " + (enabled ? "turned back on" : "paused") + ": " + customer.name,
            (enabled ? "" : PAUSE_REASONS[reason] + " · ") + "by " + staffName, "customers.html?id=" + customer.id);
        save();
        return { ok: true, customer: customer };
    }

    // Settings: new base prices (in cents) for each size. Rentals already going keep their rate.
    function savePrices(prices, staffName) {
        for (var i = 0; i < SIZE_ORDER.length; i++) {
            if (isNaN(prices[SIZE_ORDER[i]]) || prices[SIZE_ORDER[i]] <= 0) {
                return { error: "Every price must be a number above $0.00." };
            }
        }
        SIZE_ORDER.forEach(function (size) {
            db.settings.base[size] = prices[size];
        });
        log(now(), "s-rs", "tags", "Locker prices updated",
            SIZE_ORDER.map(function (s) { return SIZES[s].label + " " + money(prices[s]); }).join(" · ") + " · by " + staffName,
            "settings.html");
        save();
        return { ok: true };
    }

    // Settings: discount percents, each a whole number from 0 to 100
    function saveDiscounts(senior, aaa, student) {
        var all = [senior, aaa, student];
        for (var i = 0; i < all.length; i++) {
            if (isNaN(all[i]) || all[i] < 0 || all[i] > 100) {
                return { error: "Discounts must be between 0% and 100%." };
            }
        }
        db.settings.pct = { SENIOR: senior, AAA: aaa, STUDENT: student };
        save();
        return { ok: true };
    }

    // Settings: late fee (cents) and how many days of grace before it's added
    function saveLateFee(fee, graceDays) {
        if (isNaN(fee) || fee < 0 || isNaN(graceDays) || graceDays < 0 || graceDays > 60) {
            return { error: "The late fee can't be negative and the grace period must be 0–60 days." };
        }
        db.settings.lateFee = fee;
        db.settings.graceDays = graceDays;
        save();
        return { ok: true };
    }

    // One staff account by username (not case sensitive), or null
    function findStaff(username) {
        username = String(username || "").trim().toLowerCase();
        return db.staff.filter(function (s) { return s.username === username; })[0] || null;
    }

    // Adds a staff account with the starting password for its role
    function addStaff(name, username, role) {
        var user = username.trim().toLowerCase();
        if (!name.trim() || !user) {
            return { error: "Enter a full name and a username." };
        }
        if (!/^[a-z0-9._-]+$/.test(user)) {
            return { error: "Usernames can use letters, numbers, dots, dashes and underscores." };
        }
        if (findStaff(user)) {
            return { error: "The username " + user + " is taken." };
        }
        db.staff.push({ id: nextId("staff"), name: name.trim(), username: user, password: DEFAULT_PASSWORD,
            role: role === "MANAGER" ? "MANAGER" : "CLERK", active: true, lastSignIn: null });
        save();
        return { ok: true };
    }

    /* Who can change whose account:
       - Delete: only accounts ranked below you
       - Disable, enable, reset password: your level or below (only the owner changes the owner)
       - Nobody deletes or disables their own account */
    function canDelete(me, staff) {
        return staff.username !== me.username && RANK[me.role] >= RANK.MANAGER && RANK[me.role] > RANK[staff.role];
    }

    // True if staff member "me" may reset or disable "staff": managers and up, never someone ranked higher
    function canChange(me, staff) {
        return RANK[me.role] >= RANK.MANAGER && RANK[me.role] >= RANK[staff.role];
    }

    // Staff account changes (each checks canChange first): reset password, disable/enable, delete
    function resetPassword(username, me) {
        var staff = findStaff(username);
        if (!staff) {
            return { error: "There is no account " + username + "." };
        }
        if (!canChange(me, staff)) {
            return { error: "You can't change the " + ROLES[staff.role].toLowerCase() + "'s account." };
        }
        staff.password = startingPassword(staff.role);
        save();
        return { ok: true, staff: staff };
    }

    // Disable or enable a staff account's sign-in (you can't disable yourself)
    function setActive(username, active, me) {
        var staff = findStaff(username);
        if (!staff) {
            return { error: "There is no account " + username + "." };
        }
        if (!active && staff.username === me.username) {
            return { error: "You can't disable your own account." };
        }
        if (!canChange(me, staff)) {
            return { error: "You can't change the " + ROLES[staff.role].toLowerCase() + "'s account." };
        }
        staff.active = active;
        save();
        return { ok: true, staff: staff };
    }

    // Delete a staff account (their past payments and rentals stay on file)
    function deleteStaff(username, me) {
        var staff = findStaff(username);
        if (!staff) {
            return { error: "There is no account " + username + "." };
        }
        if (staff.username === me.username) {
            return { error: "You can't delete your own account." };
        }
        if (!canDelete(me, staff)) {
            return { error: staff.role === "MANAGER" ? "Only the owner can delete manager accounts."
                : "The " + ROLES[staff.role].toLowerCase() + "'s account can't be deleted." };
        }
        db.staff = db.staff.filter(function (s) { return s.id !== staff.id; });
        save();
        return { ok: true, staff: staff };
    }

    // Owner first, then managers, then clerks
    function staffList() {
        return db.staff.slice().sort(function (a, b) {
            return a.role !== b.role ? RANK[b.role] - RANK[a.role] : a.name.localeCompare(b.name);
        });
    }

    // Adds the owner account if it is missing
    function ensureOwner() {
        var hasOwner = db.staff.some(function (s) { return s.role === "OWNER"; });
        if (!hasOwner && !findStaff("francisco.orellana")) {
            db.staff.push({ id: nextId("staff"), name: "Francisco Orellana", username: "francisco.orellana",
                password: OWNER_PASSWORD, role: "OWNER", active: true, lastSignIn: null });
            save();
        }
    }


    /* ----------------------------------------------------------------------
       10. Sign in and passwords
       Staff sign in with their username, customers with their email or phone.
       The signed-in person is kept for this browser tab (sessionStorage).
       ---------------------------------------------------------------------- */
    // Where "who is signed in" is kept: sessionStorage, so it ends when the tab closes
    var SESSION_KEY = "storagepro-session";

    // Finds a customer by email or phone (phone matches on digits only)
    function findCustomerByLogin(login) {
        var text = String(login || "").trim().toLowerCase();
        var isPhone = /^[\d\s()+.-]+$/.test(text);
        var digits = text.replace(/\D/g, "").slice(-10);
        if (!text) {
            return null;
        }
        return db.customers.filter(function (c) {
            if (isPhone) {
                return digits.length >= 7 && c.phone.replace(/\D/g, "").slice(-10) === digits;
            }
            return c.email && c.email.toLowerCase() === text;
        })[0] || null;
    }

    // Remembers who is signed in, for this browser tab only (sessionStorage)
    function keep(session) {
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        } catch (e) {
            // Private windows may block storage
        }
    }

    // The message a customer sees when their online account is paused or closed
    function closedMessage(customer) {
        if (customer.portalReason === "MOVED_OUT") {
            return "Your online account closed when you moved out. Your records are kept on file. "
                + "Call us at " + FACILITY.phone + " if you need a copy of your payments or want to rent again.";
        }
        return "Your online account is paused. Please call us at " + FACILITY.phone
            + (customer.portalReason === "OVERDUE" ? " to bring your payment up to date." : ".");
    }

    // Signs in. Returns { ok, kind: "staff" or "customer" } or { error }.
    function signIn(login, password) {
        var staff = findStaff(login);
        if (staff) {
            if (staff.password !== password) {
                return { error: "Wrong username or password." };
            }
            if (!staff.active) {
                return { error: "This account is disabled. Ask a manager to enable it." };
            }
            staff.lastSignIn = now();
            save();
            keep({ type: "staff", username: staff.username });
            return { ok: true, kind: "staff", name: staff.name, roleLabel: ROLES[staff.role] };
        }
        var customer = findCustomerByLogin(login);
        if (customer && (customer.password || DEFAULT_PASSWORD) === password) {
            if (customer.portalDisabled) {
                return { error: closedMessage(customer) };
            }
            customer.lastSignIn = now();
            save();
            keep({ type: "customer", customerId: customer.id });
            return { ok: true, kind: "customer", name: customer.name };
        }
        return { error: "Wrong username, email or password." };
    }

    // Who is signed in on this tab, or null
    function readSession() {
        try {
            return JSON.parse(sessionStorage.getItem(SESSION_KEY));
        } catch (e) {
            return null;
        }
    }

    // The signed-in staff member, or null
    function session() {
        var s = readSession();
        var staff = s && s.type !== "customer" ? findStaff(s.username) : null;
        if (!staff || !staff.active) {
            return null;
        }
        return {
            username: staff.username,
            name: staff.name,
            role: staff.role,
            // true for managers and the owner
            manager: RANK[staff.role] >= RANK.MANAGER,
            owner: staff.role === "OWNER",
            roleLabel: ROLES[staff.role],
            initials: initials(staff.name),
            firstName: staff.name.split(" ")[0]
        };
    }

    // The signed-in customer, or null
    function customerSession() {
        var s = readSession();
        var customer = s && s.type === "customer" ? findCustomer(s.customerId) : null;
        if (customer && customer.portalDisabled) {
            signOut();
            return null;
        }
        return customer;
    }

    /* Temporary passwords like "Cedar-4821".
       The customer picks their own on first sign-in. */
    // Words for temporary passwords (a word + a number is easy to read out at the desk)
    var TEMP_WORDS = ["Amber", "Cedar", "Maple", "River", "Stone", "Harbor", "Summit", "Willow", "Copper", "Meadow"];

    // A random temporary password for a customer
    function makeTempPassword() {
        var word = TEMP_WORDS[Math.floor(Math.random() * TEMP_WORDS.length)];
        return word + "-" + String(1000 + Math.floor(Math.random() * 9000));
    }

    // Gives a customer a new temporary password they must change at their next sign-in
    function giveTempPassword(customer) {
        customer.tempPassword = makeTempPassword();
        customer.password = customer.tempPassword;
        customer.mustChangePassword = true;
        return customer.tempPassword;
    }

    // Checks a new password: 8+ characters, not the temporary one, typed the same twice. Returns null when it's fine.
    function checkNewPassword(customer, next, confirm) {
        if (!next || next.length < 8) {
            return { field: "next", error: "Use at least 8 characters." };
        }
        if (next === customer.tempPassword) {
            return { field: "next", error: "Pick a new password, not the temporary one." };
        }
        if (next !== confirm) {
            return { field: "confirm", error: "The two passwords don't match." };
        }
        return null;
    }

    // Saves the customer's own password and ends the temporary one
    function setOwnPassword(customer, next) {
        customer.password = next;
        customer.tempPassword = null;
        customer.mustChangePassword = false;
        save();
    }

    // Account page: change password (the current one must be right)
    function changeCustomerPassword(id, current, next, confirm) {
        var customer = findCustomer(id);
        if (!customer) {
            return { error: "We couldn't find your account." };
        }
        if ((customer.password || DEFAULT_PASSWORD) !== current) {
            return { field: "current", error: "That isn't your current password." };
        }
        var problem = checkNewPassword(customer, next, confirm);
        if (problem) {
            return problem;
        }
        setOwnPassword(customer, next);
        return { ok: true };
    }

    // First sign-in: sets the customer's own password
    function setFirstPassword(id, next, confirm) {
        var customer = findCustomer(id);
        if (!customer || !customer.mustChangePassword) {
            return { error: "Your password is already set." };
        }
        var problem = checkNewPassword(customer, next, confirm);
        if (problem) {
            return problem;
        }
        setOwnPassword(customer, next);
        return { ok: true };
    }

    // Staff give a customer a new temporary password
    function resetCustomerPassword(id, staffName) {
        var customer = findCustomer(id);
        if (!customer) {
            return { error: "That customer no longer exists." };
        }
        var temp = giveTempPassword(customer);
        log(now(), "s-rs", "key", "New temporary password for " + customer.name, "by " + (staffName || "staff"),
            "customers.html?id=" + customer.id);
        save();
        return { ok: true, customer: customer, tempPassword: temp };
    }

    /* Forgot password on the sign-in page: checks the full name on the account,
       then shows a new temporary password on screen. */
    function forgotPassword(login, fullName) {
        var sameName = function (a, b) {
            return String(a || "").trim().replace(/\s+/g, " ").toLowerCase()
                === String(b || "").trim().replace(/\s+/g, " ").toLowerCase();
        };
        if (!String(login || "").trim()) {
            return { field: "login", error: "Type your username, email or phone." };
        }
        if (!String(fullName || "").trim()) {
            return { field: "fullName", error: "Type your full name." };
        }
        var staff = findStaff(login);
        var customer = staff ? null : findCustomerByLogin(login);
        var account = staff || customer;
        if (!account || !sameName(account.name, fullName)) {
            return { error: "We couldn't find an account with those details. Check the spelling, "
                + "or call us at " + FACILITY.phone + "." };
        }
        if (staff && !staff.active) {
            return { error: "This account is disabled. Ask a manager to enable it." };
        }
        if (customer && customer.portalDisabled) {
            return { error: closedMessage(customer) };
        }
        var temp;
        if (customer) {
            temp = giveTempPassword(customer);
        } else {
            temp = makeTempPassword();
            staff.password = temp;
        }
        log(now(), "s-rs", "key", "Password reset from the sign-in page: " + account.name, "Forgot password",
            customer ? "customers.html?id=" + customer.id : "settings.html");
        save();
        return { ok: true, kind: customer ? "customer" : "staff", login: staff ? staff.username : String(login).trim(),
            name: account.name, tempPassword: temp };
    }

    // 6-digit gate code per customer
    function gateCodeFor(id) {
        var customer = findCustomer(id);
        if (!customer.gateCode) {
            customer.gateCode = String(100000 + Math.floor(Math.random() * 900000));
            save();
        }
        return customer.gateCode;
    }

    // Tickets the customer sent, newest first
    function ticketsForCustomer(id) {
        id = Number(id);
        return db.tickets.filter(function (t) {
            return t.customerId === id;
        }).sort(function (a, b) {
            return a.createdAt < b.createdAt ? 1 : -1;
        });
    }

    // Signs out of this browser tab
    function signOut() {
        try {
            sessionStorage.removeItem(SESSION_KEY);
        } catch (e) {
            // nothing to clear
        }
    }


    /* ----------------------------------------------------------------------
       11. Reports
       ---------------------------------------------------------------------- */
    function report(b, months) {
        var t = parseDate(b.today);
        var monthLabel = function (y, m) {
            return new Date(y, m, 1).toLocaleDateString("en-US", { month: "short" });
        };
        var first = new Date(t.getFullYear(), t.getMonth() - months + 1, 1);

        // Revenue: payments taken each month
        var totals = [];
        for (var i = 0; i < months; i++) {
            totals.push(0);
        }
        db.payments.forEach(function (p) {
            if (p.voided) {
                return; // voided payments aren't revenue
            }
            var d = parseDate(p.at);
            var index = (d.getFullYear() - first.getFullYear()) * 12 + d.getMonth() - first.getMonth();
            if (index >= 0 && index < months) {
                totals[index] += p.amount;
            }
        });
        var scale = Math.max.apply(null, totals.concat([1])) * 1.1;
        var revenue = totals.map(function (total, k) {
            var d = new Date(first.getFullYear(), first.getMonth() + k, 1);
            return { label: monthLabel(d.getFullYear(), d.getMonth()), value: total, pct: total * 100 / scale,
                current: k === months - 1 };
        });

        // Occupancy: rentals active at the end of each month
        var lockerCount = Math.max(1, db.lockers.length);
        var occupancy = [];
        for (var k = 0; k < months; k++) {
            var md = new Date(first.getFullYear(), first.getMonth() + k, 1);
            var at = k === months - 1 ? b.today : isoDate(new Date(md.getFullYear(), md.getMonth() + 1, 0));
            var active = db.rentals.filter(function (r) {
                return r.moveIn <= at && (!r.moveOut || r.moveOut > at);
            }).length;
            var p = active * 100 / lockerCount;
            occupancy.push({ label: monthLabel(md.getFullYear(), md.getMonth()), value: Math.round(p), pct: p,
                current: k === months - 1 });
        }

        // Discount use among active rentals
        var activeRentals = db.rentals.filter(function (r) { return !r.moveOut; });
        var discounts = DISCOUNT_ORDER.map(function (d) {
            var using = activeRentals.filter(function (r) { return r.discount === d; });
            var off = using.reduce(function (sum, r) { return sum + r.baseRate - r.monthlyRate; }, 0);
            return { label: DISCOUNTS[d], pct: activeRentals.length ? using.length * 100 / activeRentals.length : 0,
                value: plural(using.length, "rental"), note: d === "NONE" ? "Base price" : money(off) + " off / mo" };
        });

        // Overdue balances grouped by how long they've been unpaid
        var labels = ["0–30 days", "31–60 days", "61–90 days", "90+ days"];
        var owed = [0, 0, 0, 0];
        var counts = [0, 0, 0, 0];
        b.lockers.forEach(function (l) {
            if (l.status !== "OVERDUE") {
                return;
            }
            var bucket = l.daysOverdue <= 30 ? 0 : l.daysOverdue <= 60 ? 1 : l.daysOverdue <= 90 ? 2 : 3;
            owed[bucket] += l.balance;
            counts[bucket]++;
        });
        var maxOwed = Math.max.apply(null, owed);
        var aging = labels.map(function (label, n) {
            return { label: label, pct: maxOwed ? owed[n] * 100 / maxOwed : 0, value: money(owed[n]),
                note: plural(counts[n], "locker") };
        });

        return {
            revenue: revenue,
            revenueThisMonth: totals[months - 1],
            occupancy: occupancy,
            discounts: discounts,
            activeRentals: activeRentals.length,
            aging: aging,
            overdueTotal: owed.reduce(function (sum, x) { return sum + x; }, 0),
            range: fmtMonthYear(isoDate(first)) + " – " + fmtMonthYear(b.today)
        };
    }


    load();

    return {
        SIZES: SIZES, SIZE_ORDER: SIZE_ORDER, ROWS: ROWS, DISCOUNTS: DISCOUNTS, DISCOUNT_ORDER: DISCOUNT_ORDER,
        METHODS: METHODS, STATUS: STATUS, STATUS_ORDER: STATUS_ORDER, DEFAULT_PASSWORD: DEFAULT_PASSWORD, startingPassword: startingPassword,
        ROLES: ROLES, canDelete: canDelete, canChange: canChange, FACILITY: FACILITY,
        customerSession: customerSession, changeCustomerPassword: changeCustomerPassword, setFirstPassword: setFirstPassword,
        resetCustomerPassword: resetCustomerPassword, forgotPassword: forgotPassword, gateCodeFor: gateCodeFor, ticketsForCustomer: ticketsForCustomer,
        sizeLabel: sizeLabel, sizeFromCode: sizeFromCode,
        today: today, addDays: addDays, money: money, wholeMoney: wholeMoney, plain: plain, toCents: toCents,
        fmtDate: fmtDate, fmtShort: fmtShort, fmtMonthYear: fmtMonthYear, fmtDayDate: fmtDayDate,
        fmtTopbar: fmtTopbar, fmtLong: fmtLong, fmtTime: fmtTime, fmtDateTime: fmtDateTime, fmtWhen: fmtWhen,
        fmtSignIn: fmtSignIn, ordinal: ordinal, plural: plural, days: days, pct: pct, initials: initials,
        board: board, recentActivity: recentActivity, findCustomer: findCustomer, findLocker: findLocker,
        findRental: findRental, findCharge: findCharge, findPayment: findPayment, lastPayment: lastPayment, voidPayment: voidPayment,
        snapshot: snapshot, offerUndo: offerUndo, canUndo: canUndo, undo: undo,
        paymentsFor: paymentsFor, paymentLockers: paymentLockers, chargesFor: chargesFor, rentalsFor: rentalsFor,
        unpaidFor: unpaidFor, balanceOf: balanceOf, takePayment: takePayment,
        rateFor: rateFor, discountPct: discountPct, createRental: createRental, moveOut: moveOut,
        finishMaintenance: finishMaintenance, hold: hold, releaseHold: releaseHold,
        TICKET_CATEGORIES: TICKET_CATEGORIES, TICKET_PRIORITIES: TICKET_PRIORITIES, TICKET_STATUS: TICKET_STATUS,
        findTicket: findTicket, ticketList: ticketList, ticketCounts: ticketCounts, createTicket: createTicket,
        startTicket: startTicket, resolveTicket: resolveTicket, reopenTicket: reopenTicket,
        saveNotes: saveNotes, createCustomer: createCustomer, updateCustomer: updateCustomer,
        setCustomerAccess: setCustomerAccess, PAUSE_REASONS: PAUSE_REASONS, savePrices: savePrices, saveDiscounts: saveDiscounts,
        saveLateFee: saveLateFee, addStaff: addStaff, resetPassword: resetPassword, setActive: setActive,
        deleteStaff: deleteStaff, staffList: staffList, signIn: signIn, session: session, signOut: signOut, report: report,
        resetData: resetData, savedWhere: savedWhere
    };
})();
