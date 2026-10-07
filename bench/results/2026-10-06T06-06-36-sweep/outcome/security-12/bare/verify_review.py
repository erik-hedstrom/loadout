"""Validate the proposal in a temporary copy; never execute a workflow or publish."""
from pathlib import Path
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile

import yaml

ROOT = Path(__file__).resolve().parent
SAMPLES = ROOT / "samples"
WORKFLOWS = SAMPLES / ".github/workflows"


def run(args, cwd, env=None):
    result = subprocess.run(args, cwd=cwd, env=env, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(f"{args[0]} failed ({result.returncode}): {result.stderr}")
    return result.stdout


def load(path):
    # BaseLoader preserves 'on' instead of treating it as a YAML 1.1 boolean.
    return yaml.load(path.read_text(), Loader=yaml.BaseLoader)


def allowed(expression, event):
    def resolve(key):
        value = event
        for segment in key.split(".")[1:]:
            value = value.get(segment, {}) if isinstance(value, dict) else None
        return value

    for term in expression.split("&&"):
        match = re.fullmatch(r"\s*(github\.[a-z_.]+) == ('[^']+'|github\.[a-z_.]+)\s*", term)
        if not match:
            raise ValueError(f"Unsupported guard syntax: {term!r}")
        lhs, rhs = match.groups()
        expected = rhs[1:-1] if rhs.startswith("'") else resolve(rhs)
        if resolve(lhs) != expected:
            return False
    return True


def main():
    before = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in WORKFLOWS.glob("*.yml")}
    assert len(before) == 3
    for path in WORKFLOWS.glob("*.yml"):
        workflow = load(path)
        assert "on" in workflow and "jobs" in workflow
    print("PASS: 3 original workflow YAML files parse")

    with tempfile.TemporaryDirectory(prefix="actions-review-") as temporary:
        work = Path(temporary)
        shutil.copytree(SAMPLES, work / "repo")
        repo = work / "repo"
        run(["patch", "--dry-run", "--batch", "-p1", "-i", str(ROOT / "proposed-edits.diff")], repo)
        run(["patch", "--batch", "-p1", "-i", str(ROOT / "proposed-edits.diff")], repo)
        print("PASS: patch dry-run and application to temporary copy (3 files)")
        fixed = {p.name: load(p) for p in (repo / ".github/workflows").glob("*.yml")}
        for workflow in fixed.values():
            assert workflow["permissions"] == {"contents": "read"}
            assert workflow["cache-mode"] == "none"
            assert "env" not in workflow
            for job in workflow["jobs"].values():
                assert job["runs-on"] == "ubuntu-latest"
                for step in job["steps"]:
                    if "uses" in step:
                        assert re.fullmatch(r"[^@]+@[0-9a-f]{40}", step["uses"])
                        assert not step["uses"].startswith(("actions/cache", "dawidd6/", "actions/download-artifact"))
                        if step["uses"].startswith("actions/checkout"):
                            assert step["with"]["persist-credentials"] == "false"
                        if step["uses"].startswith("actions/setup-node"):
                            assert step["with"]["package-manager-cache"] == "false"
                    assert "${{" not in step.get("run", "")
                    assert "RELEASE_PAT" not in json.dumps(step)
        assert "pull_request" in fixed["pr-ci.yml"]["on"]
        assert "pull_request_target" not in fixed["pr-ci.yml"]["on"]
        print("PASS: proposed YAML parses; token, secret, runner, pin and cache checks")

        original_step = load(WORKFLOWS / "pr-ci.yml")["jobs"]["test"]["steps"][2]
        fixed_step = fixed["pr-ci.yml"]["jobs"]["test"]["steps"][2]
        title = "$(touch title-marker)"
        branch = "feature/$(touch${IFS}branch-marker)"
        run(["git", "check-ref-format", "--branch", branch], work)
        rendered = original_step["run"].replace("${{ github.event.pull_request.title }}", title).replace("${{ github.head_ref }}", branch)
        original_dir = work / "original-injection"
        original_dir.mkdir()
        run(["bash", "-e", "-c", rendered], original_dir)
        assert (original_dir / "title-marker").exists() and (original_dir / "branch-marker").exists()
        safe_dir = work / "safe-injection"
        safe_dir.mkdir()
        env = {"PATH": os.defpath, "PR_TITLE": title, "PR_BRANCH": branch}
        output = run(["bash", "-e", "-c", fixed_step["run"]], safe_dir, env)
        assert title in output and branch in output
        assert not (safe_dir / "title-marker").exists() and not (safe_dir / "branch-marker").exists()
        print("PASS: title and valid branch injection create markers before; treated literally after")

        artifact_dir = work / "artifact"
        artifact_dir.mkdir()
        (artifact_dir / "publish.sh").write_text("touch artifact-marker\n")
        run(["bash", "publish.sh"], artifact_dir)
        assert (artifact_dir / "artifact-marker").exists()
        publisher = fixed["publish.yml"]["jobs"]["publish"]
        assert not any("dist/publish.sh" in step.get("run", "") for step in publisher["steps"])
        secret_steps = [step for step in publisher["steps"] if "env" in step]
        assert len(secret_steps) == 1
        assert secret_steps[0]["run"] == "npm publish --ignore-scripts"
        assert secret_steps[0]["env"] == {"NODE_AUTH_TOKEN": "${{ secrets.NPM_TOKEN }}"}
        print("PASS: artifact shell execution reproduced locally; removed from proposal")

        cases = [
            ("trusted push", "push", "main", "example/project", "success", True),
            ("fork PR", "pull_request", "main", "attacker/project", "success", False),
            ("same-repo PR", "pull_request", "main", "example/project", "success", False),
            ("PR target", "pull_request_target", "main", "example/project", "success", False),
            ("other branch push", "push", "feature", "example/project", "success", False),
            ("other repo push", "push", "main", "attacker/project", "success", False),
            ("failed push", "push", "main", "example/project", "failure", False),
            ("cancelled push", "push", "main", "example/project", "cancelled", False),
        ]
        for label, trigger, branch_name, repository, conclusion, expected in cases:
            event = {"repository": "example/project", "event": {"workflow_run": {
                "event": trigger, "head_branch": branch_name,
                "head_repository": {"full_name": repository}, "conclusion": conclusion,
            }}}
            assert allowed(publisher["if"], event) is expected, label
        print("PASS: 8 publisher guard cases (restricted local expression model)")

        # No dependencies or remote requests are needed for this fixture.
        env = dict(os.environ, npm_config_cache=str(work / "npm-cache"))
        run(["npm", "ci", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"], repo, env)
        run(["npm", "test"], repo, env)
        run(["npm", "run", "build"], repo, env)
        assert (repo / "dist/index.js").exists() and (repo / "dist/publish.sh").exists()
        print("PASS: sample npm install (offline), unit test (1), and build")

    after = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in WORKFLOWS.glob("*.yml")}
    assert before == after
    print("PASS: original fixture workflow hashes unchanged; no publish performed")


if __name__ == "__main__":
    main()
