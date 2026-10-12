logsum.py summarises an nginx access log (try it on access.log). I need two new options: `--since 2026-03-10` to ignore requests before that date, and `--status 5xx` (or an exact code like 404) to count only matching responses. They should work together, and the output format must stay the same.

The script is a mess and I'd like to be able to trust changes to it, so tidy it up as much as you need to, and add tests I can run with `python3 -m unittest`.
