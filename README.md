# StoragePro

A website for running a small self-storage business: renting lockers, taking payments,
tracking repairs, and a page where renters can see their own locker and balance.
It's plain HTML, CSS and JavaScript (no build step), and it saves its data in a
Supabase database.

## Opening the site

Open `index.html` in a web browser and sign in.

| Account | Username | Password |
| --- | --- | --- |
| Owner | `francisco.orellana` | `test1234` |
| New managers and clerks | the username made for them in Settings | `storagepro` |
| Customers | their email or phone number | the temporary password on their sign-in slip |

## Pages

| Page | What it's for |
| --- | --- |
| `index.html` | Sign in (staff and customers), and "Forgot password" |
| `dashboard.html` | Today at a glance: occupancy, open lockers, money owed, recent activity |
| `lockers.html` | Map of all 60 lockers, colored by status |
| `locker.html` | One locker: its renter, history, holds and move-out |
| `customers.html` | Customer list, account details, sign-in slips and welcome emails |
| `new-rental.html` | Rent a locker in four steps: customer, locker, discount, payment |
| `payments.html` | Take a payment, print a receipt, see overdue accounts |
| `maintenance.html` | Report a problem and follow repair tickets |
| `reports.html` | Revenue by month, occupancy trend, discount use and overdue balances |
| `settings.html` | Locker prices, discounts, late fee, staff accounts, and clearing the data |
| `search.html` | Search results for customers and lockers |
| `customer.html` | The renter's own page: locker, balance, payments, repairs, account |

## Folders

| Folder | What's in it |
| --- | --- |
| `css/styles.css` | Every style for the whole site, in numbered sections |
| `js/store.js` | All the data and the rules for changing it (prices, discounts, rentals, payments) |
| `js/supabase-config.js` | The database's address and publishable key |
| `js/layout.js` | The sidebar and top bar shared by the staff pages |
| `js/<page>.js` | One script per page, named after the page it draws |
| `js/app.js` | Dark mode, sidebar collapse, print button and keyboard shortcuts |
| `database/supabase-setup.sql` | Creates the database tables, access rules and views |
| `images/logo.svg` | The logo and browser-tab icon |

## Database

The data lives in Supabase. `database/supabase-setup.sql` builds the tables, and
`js/supabase-config.js` holds the project's address and its publishable key (the key
that's meant to be public). If those two values are left as placeholders, the site
saves its data in the browser instead.

Discounts: full price, 10% for seniors, 5% for AAA members, 15% for students.

## Welcome emails

Each new customer gets a sign-in slip with a temporary password. If they have an
email on file, the slip's **Email welcome** button opens the staff member's email app
with a welcome message and their sign-in details filled in, ready to send.

Once the site is online, put its sign-in page address in `website` in `js/store.js`
(in `FACILITY`), so slips and emails link to it instead of to a file on this computer.
