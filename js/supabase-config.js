/* StoragePro - supabase-config.js
   ------------------------------------
   The address and key of the Supabase database that stores StoragePro's data.
   Every page loads this file just before store.js, and store.js uses these two
   values for every read and save (see section 3 of store.js).

     url  The project's web address. Each table is reached at url + "/rest/v1/<table>".
     key  The project's publishable key. Supabase uses it to recognize this website;
          it's meant to be public, so it's safe in a file the browser can read.
          The table rules in database/supabase-setup.sql decide what this key may do.

   With placeholder values (any text containing "PASTE"), store.js saves the data in
   this browser's localStorage instead, the way the site worked before the database. */
var SUPABASE_CONFIG = {
    url: "https://xbsmopzrripjpewejrjz.supabase.co",
    key: "sb_publishable_TltTt8C0lS4PyFUOmoBxBw_TFauuYht"
};
