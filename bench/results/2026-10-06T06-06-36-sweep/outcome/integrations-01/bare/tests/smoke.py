"""Optional stdlib-only smoke check for runners that block Node child spawning."""
import json
import os
from pathlib import Path
import queue
import shutil
import subprocess
import threading

PROJECT = Path(__file__).resolve().parent.parent
NODE = shutil.which("node")
assert NODE, "Install Node.js first"


def check(mode):
    args = [NODE, str(PROJECT / "dist/server.js")]
    env = dict(os.environ)
    env.pop("DOCS_ROOT", None)
    root = str(PROJECT / "sample-docs")
    if mode == "cli":
        args += ["--docs-root", root]
    else:
        env["DOCS_ROOT"] = root
    process = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, text=True, env=env)
    messages = queue.Queue()

    def read():
        for line in process.stdout:
            messages.put(line)
        messages.put(None)

    threading.Thread(target=read, daemon=True).start()

    def send(message):
        process.stdin.write(json.dumps(message) + "\n")
        process.stdin.flush()

    def request(identifier, method, params):
        send({"jsonrpc": "2.0", "id": identifier, "method": method, "params": params})
        while True:
            line = messages.get(timeout=10)
            assert line is not None, "Server exited before responding"
            response = json.loads(line)
            if response.get("id") == identifier:
                assert "error" not in response, response
                return response["result"]

    try:
        request(1, "initialize", {"protocolVersion": "2025-11-25", "capabilities": {},
                                  "clientInfo": {"name": "smoke-check", "version": "1.0.0"}})
        send({"jsonrpc": "2.0", "method": "notifications/initialized"})
        tools = request(2, "tools/list", {})["tools"]
        assert sorted(tool["name"] for tool in tools) == ["get_page", "search_docs"]
        search = request(3, "tools/call", {"name": "search_docs",
                                          "arguments": {"query": "deployment", "limit": 1}})
        assert not search.get("isError"), search
        hits = json.loads(search["content"][0]["text"])
        assert len(hits) == 1 and hits[0]["path"] == "runbooks/deployment.md", hits
        assert hits[0]["title"] == "Production deployment"
        page = request(4, "tools/call", {"name": "get_page", "arguments": {"path": hits[0]["path"]}})
        assert not page.get("isError"), page
        document = json.loads(page["content"][0]["text"])
        assert document["content"] == (PROJECT / "sample-docs/runbooks/deployment.md").read_text()
        assert document["title"] == "Production deployment"
        for identifier, name, arguments, message in [
            (5, "search_docs", {"query": " "}, "Query must not be empty"),
            (6, "get_page", {"path": "missing.md"}, "Page not found"),
            (7, "get_page", {"path": "../README.md"}, "Invalid page path"),
        ]:
            result = request(identifier, "tools/call", {"name": name, "arguments": arguments})
            assert result.get("isError") and message in result["content"][0]["text"], result
        print(f"PASS {mode}: initialize, tools/list, search, full retrieval, empty query, missing page, traversal")
    finally:
        process.stdin.close()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        stderr = process.stderr.read()
        process.stdout.close()
        process.stderr.close()
    assert process.returncode == 0 and not stderr, (process.returncode, stderr)


for mode in ["cli", "env"]:
    check(mode)
env = dict(os.environ)
env.pop("DOCS_ROOT", None)
for args in [[], ["--docs-root", str(PROJECT / "nonexistent-docs")]]:
    result = subprocess.run([NODE, str(PROJECT / "dist/server.js"), *args],
                            env=env, capture_output=True, text=True, timeout=5)
    assert result.returncode == 1 and not result.stdout
    assert "Set DOCS_ROOT" in result.stderr or "Docs root must" in result.stderr
print("PASS startup configuration errors")
