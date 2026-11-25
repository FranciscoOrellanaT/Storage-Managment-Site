/* StoragePro - login.js
   Sign-in page: signs in staff and customers, and handles forgot password. */
(function () {
    "use strict";

    // Someone already signed in skips this page: staff go to the Dashboard, customers to their own page
    if (SP.session()) {
        window.location.replace("dashboard.html");
        return;
    }
    if (SP.customerSession()) {
        window.location.replace("customer.html");
        return;
    }

    // The sign-in form and its two message boxes (red error, green note)
    var form = document.getElementById("login-form");
    var errorBox = document.getElementById("login-error");
    var messageBox = document.getElementById("login-message");

    // Shows the message from the last page (for example "Signed out.")
    try {
        var f = JSON.parse(sessionStorage.getItem("storagepro-flash"));
        sessionStorage.removeItem("storagepro-flash");
        if (f) {
            var box = f.type === "err" ? errorBox : messageBox;
            box.querySelector("span").textContent = f.message;
            box.hidden = false;
        }
    } catch (e) {
        // no message
    }

    // Show / hide password button
    var password = document.getElementById("password");
    var reveal = document.getElementById("show-password");
    reveal.addEventListener("click", function () {
        var showing = password.type === "text";
        password.type = showing ? "password" : "text";
        reveal.setAttribute("aria-pressed", showing ? "false" : "true");
        reveal.setAttribute("aria-label", showing ? "Show password" : "Hide password");
        reveal.title = showing ? "Show password" : "Hide password";
        reveal.innerHTML = "<i class=\"fa-solid " + (showing ? "fa-eye" : "fa-eye-slash") + "\"></i>";
        password.focus();
    });

    // Forgot password
    // The three cards of the "Forgot password" steps, and the parts inside them
    var forgotForm = document.getElementById("forgot-form");
    var forgotError = document.getElementById("forgot-error");
    var forgotDone = document.getElementById("forgot-done");
    var saved = document.getElementById("forgot-saved");
    var returnBtn = document.getElementById("forgot-return");
    var username = document.getElementById("username");
    // The temporary password made by SP.forgotPassword(), kept for the Copy and Return buttons
    var newPassword = null;

    // Shows one card (sign in, forgot password, or new password) and hides the other two
    function showCard(card) {
        [form, forgotForm, forgotDone].forEach(function (c) { c.hidden = c !== card; });
    }

    // Hides the forgot-password error and un-marks the red fields
    function clearForgotError() {
        forgotError.hidden = true;
        forgotForm.querySelectorAll(".input.invalid").forEach(function (i) { i.classList.remove("invalid"); });
    }

    // "Forgot password?" link: opens the forgot-password card
    document.getElementById("forgot-link").addEventListener("click", function () {
        clearForgotError();
        forgotForm.reset();
        // Fills in the username they already typed
        document.getElementById("forgot-login").value = username.value.trim();
        showCard(forgotForm);
        document.getElementById(username.value.trim() ? "forgot-name" : "forgot-login").focus();
    });

    // "Back to sign in" link
    forgotForm.querySelector(".back-to-signin").addEventListener("click", function () {
        showCard(form);
        username.focus();
    });

    // Typing in the forgot-password form clears its error
    forgotForm.addEventListener("input", clearForgotError);

    // Forgot-password form sent: checks the username + full name match an account (SP.forgotPassword),
    // then shows the new temporary password
    forgotForm.addEventListener("submit", function (event) {
        event.preventDefault();
        clearForgotError();
        var data = UI.formData(forgotForm);
        var result = SP.forgotPassword(data.login, data.fullName);
        if (result.error) {
            forgotError.querySelector("span").textContent = result.error;
            forgotError.hidden = false;
            var field = document.getElementById(result.field === "fullName" ? "forgot-name" : "forgot-login");
            if (result.field) {
                field.classList.add("invalid");
            }
            field.focus();
            return;
        }
        newPassword = result;
        document.getElementById("forgot-account").textContent = result.name + " (" + result.login + ")";
        document.getElementById("forgot-password").textContent = result.tempPassword;
        document.getElementById("forgot-next").textContent = result.kind === "customer"
            ? "Sign in with this password. Right after, you'll be asked to pick your own."
            : "Sign in with this password. It stays your password until a manager resets it.";
        saved.checked = false;
        returnBtn.disabled = true;
        showCard(forgotDone);
        document.getElementById("forgot-done-title").focus();
    });

    // Return button only works after the box is ticked
    saved.addEventListener("change", function () {
        returnBtn.disabled = !saved.checked;
    });

    // Copy button: puts the temporary password on the clipboard
    document.getElementById("copy-password").addEventListener("click", function () {
        var done = function () { UI.toast("Password copied.", "ok"); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(newPassword.tempPassword).then(done, function () {
                UI.toast("Couldn't copy. Write the password down instead.", "err");
            });
        } else {
            UI.toast("Couldn't copy. Write the password down instead.", "err");
        }
    });

    // Return button: back to the sign-in card with the username filled in
    returnBtn.addEventListener("click", function () {
        username.value = newPassword.login;
        password.value = "";
        errorBox.hidden = true;
        messageBox.querySelector("span").textContent = "Your password was reset. Sign in with your new temporary password.";
        messageBox.hidden = false;
        showCard(form);
        password.focus();
    });

    // Sign-in form sent: SP.signIn() checks the username and password against the staff and customer records
    form.addEventListener("submit", function (event) {
        event.preventDefault();
        var data = UI.formData(form);
        var result = SP.signIn(data.username, data.password);
        if (result.error) {
            messageBox.hidden = true;
            errorBox.querySelector("span").textContent = result.error;
            errorBox.hidden = false;
            return;
        }
        // Staff go to the dashboard, customers to their own page
        if (result.kind === "customer") {
            UI.go("customer.html", "Welcome, " + result.name.split(" ")[0] + ".");
        } else {
            UI.go("dashboard.html", "Signed in as " + result.name + " (" + result.roleLabel + ")");
        }
    });
})();
