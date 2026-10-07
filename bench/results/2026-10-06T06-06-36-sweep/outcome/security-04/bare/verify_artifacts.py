"""Check review artifacts without importing or running the synthetic application."""

import ast
import json
import re
import struct
import zlib
from pathlib import Path


def main():
    root = Path(__file__).resolve().parent
    source = (root / "samples/sample_upload_source.txt").read_text()
    tree = ast.parse(source)
    assert {node.name for node in tree.body if isinstance(node, ast.FunctionDef)} == {
        "upload", "download", "thumbnail"
    }
    assert source.startswith("# SYNTHETIC REVIEW INPUT")
    source_lines = len(source.splitlines())
    print(f"PASS: synthetic source parses; {source_lines} lines, 3 illustrative handlers")

    assumptions = json.loads((root / "samples/deployment_assumptions.json").read_text())
    cases = json.loads((root / "samples/upload_cases.json").read_text())
    assert assumptions["evidence_kind"].startswith("synthetic_")
    assert cases["evidence_kind"] == "synthetic_test_plan_not_execution_results"
    assert {case["id"] for case in cases["cases"]} == {
        f"C{number:02d}" for number in range(1, 17)
    }
    assert len(cases["cases"]) == 16
    for case in cases["cases"]:
        assert case["expected_secure_behavior"]
        if "body_file" in case:
            assert (root / "samples" / case["body_file"]).is_file()
    print("PASS: assumptions and 16 scenario descriptors parse; referenced bodies exist")

    png = (root / "samples/pixel.png").read_bytes()
    assert png[:8] == b"\x89PNG\r\n\x1a\n"
    offset = 8
    chunks = []
    while offset < len(png):
        length = struct.unpack("!I", png[offset:offset + 4])[0]
        kind = png[offset + 4:offset + 8]
        body = png[offset + 8:offset + 8 + length]
        checksum = struct.unpack("!I", png[offset + 8 + length:offset + 12 + length])[0]
        assert zlib.crc32(kind + body) == checksum
        chunks.append((kind, body))
        offset += 12 + length
    assert offset == len(png)
    assert [kind for kind, _ in chunks] == [b"IHDR", b"IDAT", b"IEND"]
    assert struct.unpack("!IIBBBBB", chunks[0][1]) == (1, 1, 8, 2, 0, 0, 0)
    assert zlib.decompress(chunks[1][1]) == b"\x00\x20\x80\xc0"
    assert (root / "samples/invoice.pdf").read_text().startswith("<!doctype html>")
    print("PASS: 69-byte 1x1 RGB PNG structure/CRC/pixels; renamed HTML fixture")

    document = (root / "UPLOAD_THREAT_MODEL.md").read_text()
    references = re.findall(r"S:(\d+(?:–\d+)?(?:,\d+(?:–\d+)?)*)", document)
    for reference in references:
        for part in reference.split(","):
            endpoints = [int(value) for value in part.split("–")]
            assert all(1 <= value <= source_lines for value in endpoints), reference
            assert endpoints == sorted(endpoints), reference
    links = re.findall(r"\]\(([^)]+)\)", document)
    local_links = [link for link in links if not link.startswith("https://")]
    for link in local_links:
        assert (root / link).is_file(), link
    threat_ids = re.findall(r"\| ([STRIDE]\d) —", document)
    assert len(threat_ids) == len(set(threat_ids)) == 21
    assert all(f"B{number} —" in document for number in range(9))
    print(f"PASS: {len(references)} sample references in range; {len(local_links)} local links exist")
    print("PASS: 21 distinct STRIDE threats and launch gates B0–B8")
    print("No application, HTTP, browser, scanner or deployment tests were run.")


if __name__ == "__main__":
    main()
