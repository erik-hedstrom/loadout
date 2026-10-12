The signup form (signup.html, signup.js) sends whatever is typed, even empty fields. Add client-side validation: a valid-looking email, a password of at least 10 characters with at least one number, the two passwords matching, and the terms box checked.

Each error should show next to its field, and screen reader users need to hear it. Don't touch the fetch call in signup.js. Put the validation rules somewhere I can test without a browser, and add a few tests I can run with `node --test`.
