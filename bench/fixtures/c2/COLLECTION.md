# C2 collection and bounds

Part of the [C2 protocol](PROTOCOL.md), frozen with it (Frozen before the first
run). Collection, text extraction and the checks run in its second sandbox
(Isolation).

## The collector

The collector works in this order:
1. It walks the run folder with `lstat` only, opening nothing, and prunes
   `node_modules`, `.venv` and `__pycache__` when they are real directories
   (a symlink with such a name is a violation). It accepts regular files and
   directories only. A symlink, FIFO, socket, device, a file with `st_nlink`
   above 1, a name that is not valid UTF-8 or holds a control character, and a
   path over the limits below are violations.
2. Limits come from the fixtures: the largest task input is 38 KB and 5 files
   (at most 50 zip entries, the largest 438 KB inflated). The collector
   allows 500 entries, depth 6, a relative path of 200 bytes, a name of 100
   bytes, 8 MiB per file and 32 MiB in all. Sizes are `st_size`, so a sparse
   file counts at full length, and a file is never read to measure it.
3. Only then does it open each file (`O_RDONLY|O_NOFOLLOW|O_NONBLOCK`, so a
   swapped-in FIFO cannot block), `fstat` the descriptor, which must show a
   regular file with `nlink` 1 and the size the walk saw, and read at most
   that many bytes.
4. It writes a tar stream of regular files and directories, with names it has
   checked, to its stdout, and is killed after 32 MiB plus headers. The host
   never uses `docker cp` or any copy that follows links; it reads only that
   stream, with a bounded parser, into a fresh folder under names it
   generated (`O_EXCL`, `O_NOFOLLOW`). Another entry type, an unchecked name,
   a size that disagrees with its header and a stream over its cap fail the
   same way.

Any violation fails the run as `output rejected`: nothing from its folder is
scanned, extracted or judged; the run is counted per arm, not rerun (see
[Arms](PROTOCOL.md#arms)).

## Bounds

Every later step that touches bytes or metadata the agent controls has a bound
too, or runs in the sandbox without network. A step that hits its bound fails
the run as `output rejected` (collect) or fails that check or extraction
(counted, never named); it does not stall the batch.

| Step | Where | Bound |
|---|---|---|
| Credential scan, pass one | host, on the validated copy | streams each file, constant memory. The patterns in [scan-patterns.json](scan-patterns.json) must be linear time (no nested quantifier, and two quantified runs only with a literal between them that the first cannot match); the runner refuses a pattern that is not |
| Office files (zip) | extraction stage | reads entries in memory, never writes an entry to disk by name. At most 200 entries; 16 MiB inflated per entry and 64 MiB in all; inflation stops at the limit whatever the header says; a nested archive is not opened; a part holding `<!DOCTYPE` or `<!ENTITY` is not parsed |
| PDF, SQLite, CSV | extraction and check stages | 200 pages; databases opened read-only; the limits in the next row |
| Extraction and checks, as processes | second sandbox | 60 s CPU and 1 GiB memory per file or check, 10 minutes per run, no network. Over the limit, the extraction or check fails and is counted. The host reads at most 1 MiB of stdout from each and 8 MiB per run, kills the sandbox past either, and counts the extractions it skipped |
| Judge input | host | extracted text cut at 256 KiB per output, the cut counted and reported; the same text rules for both arms; redaction runs on that text |
| Stream JSON | host | read line by line with no whole-file parse. A line over 4 MiB (`claude` itself cuts tool output near 30 KB) is skipped, not parsed, and counted. Only the top-level events `system` (init, and the hook events `--include-hook-events` adds), `assistant` and `result` are parsed, after a prefix test and a nesting-depth scan (64 at most); tool results are never parsed. Numbers are taken from named fields and must be finite and not negative. The stream is cut at 128 MiB, stderr and the final message at 1 MiB each. An out-of-order event or a second or missing `result` is counted (see [Evidence](PROTOCOL.md#evidence)) |
| Commit scans | host | streamed through the scans in constant memory. A run is at most about 170 MiB (32 MiB files, 128 MiB stream, 8 MiB extracted text); the runner stops if free disk is below that |

The collector, the host's tar parser and its stream parser have tests on
made-up inputs before the smoke run, as the check script does. Collector: one
folder per violation (symlink, FIFO, socket, hard link, sparse file over the
limit, too many files, too deep, a long name, a symlink named `node_modules`),
each rejected inside 60 s. Tar: a wrong entry type, a size mismatch, an
oversize stream, an unchecked name. Stream: an over-long line, deep nesting, a
bad number, an oversize stream, no `result`.
