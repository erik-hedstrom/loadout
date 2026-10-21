import sys, re

if len(sys.argv) < 2:
    print("usage: logsum.py access.log")
    sys.exit(1)

f = open(sys.argv[1])
lines = f.readlines()
total = 0
bad = 0
codes = {}
paths = {}
ips = {}
nbytes = 0
for l in lines:
    m = re.match(r'^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) [^"]*" (\d{3}) (\d+|-)', l)
    if not m:
        bad = bad + 1
        continue
    total = total + 1
    ip = m.group(1)
    p = m.group(4).split('?')[0]
    c = m.group(5)
    b = m.group(6)
    if c in codes:
        codes[c] = codes[c] + 1
    else:
        codes[c] = 1
    if p in paths:
        paths[p] = paths[p] + 1
    else:
        paths[p] = 1
    if ip in ips:
        ips[ip] = ips[ip] + 1
    else:
        ips[ip] = 1
    if b != '-':
        nbytes = nbytes + int(b)

print("requests: %d" % total)
print("unparsed lines: %d" % bad)
print("bytes: %d" % nbytes)
print("")
print("status codes")
for k in sorted(codes):
    print("  %s  %d" % (k, codes[k]))
print("")
print("top paths")
x = sorted(paths.items(), key=lambda kv: (-kv[1], kv[0]))
for i in range(min(5, len(x))):
    print("  %-30s %d" % (x[i][0], x[i][1]))
print("")
print("top clients")
y = sorted(ips.items(), key=lambda kv: (-kv[1], kv[0]))
for i in range(min(5, len(y))):
    print("  %-30s %d" % (y[i][0], y[i][1]))
