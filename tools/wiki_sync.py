#!/usr/bin/env python3
"""Build Flee's static wiki indexes and compact monthly audit logs.

The script uses only Python's standard library so every LLM environment can run it.
Semantic documentation remains human/LLM-authored; this script owns generated indexes,
metadata dates for changed notes, and all/wiki/design/code two-line audit entries.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WIKI = ROOT / "docs" / "wiki"
META = WIKI / "_meta"
GENERATED_MD = {
    META / "wiki-index.md",
    META / "tag-index.md",
}
GENERATED_JSON = META / "search-catalog.json"
LOG_ROOT = WIKI / "90-logs"
MAX_LOG_EVENTS = 300
REQUIRED_FIELDS = ("title", "type", "status", "tags", "updated", "summary")
VALID_TYPES = {
    "product",
    "design",
    "technology",
    "research",
    "decision",
    "progress",
    "guide",
    "implementation",
    "reference",
}
VALID_STATUSES = {"draft", "verified", "accepted", "deprecated"}
VALID_CATEGORIES = {"code", "docs", "research", "decision", "design", "test", "ops"}
TYPE_ORDER = [
    "product",
    "design",
    "technology",
    "research",
    "decision",
    "progress",
    "guide",
    "implementation",
    "reference",
]
TAG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
WIKILINK_RE = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]")


@dataclass(frozen=True)
class Note:
    path: Path
    rel: str
    meta: dict[str, object]
    headings: list[str]


def now_kst() -> datetime:
    return datetime.now(timezone(timedelta(hours=9), name="KST"))


def run_git(*args: str, check: bool = True) -> str:
    result = subprocess.run(
        ["git", "-C", str(ROOT), *args],
        check=check,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return result.stdout


def is_generated(path: Path) -> bool:
    path = path.resolve()
    if path in {p.resolve() for p in GENERATED_MD} or path == GENERATED_JSON.resolve():
        return True
    try:
        rel = path.relative_to(LOG_ROOT.resolve())
    except ValueError:
        return False
    return rel.name != "README.md"


def is_template(path: Path) -> bool:
    try:
        return path.resolve().is_relative_to((WIKI / "_templates").resolve())
    except AttributeError:
        try:
            path.resolve().relative_to((WIKI / "_templates").resolve())
            return True
        except ValueError:
            return False


def canonical_markdown_files() -> list[Path]:
    files: list[Path] = []
    for path in WIKI.rglob("*.md"):
        if is_generated(path) or is_template(path):
            continue
        files.append(path)
    return sorted(files, key=lambda p: p.relative_to(WIKI).as_posix().lower())


def parse_scalar(value: str) -> object:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    if value.startswith("[") and value.endswith("]"):
        inner = value[1:-1].strip()
        if not inner:
            return []
        return [part.strip().strip('"\'') for part in inner.split(",")]
    if value.lower() == "true":
        return True
    if value.lower() == "false":
        return False
    return value


def read_frontmatter(path: Path) -> tuple[dict[str, object], str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---\n", 4)
    if end < 0:
        return {}, text
    block = text[4:end]
    meta: dict[str, object] = {}
    for line in block.splitlines():
        if not line.strip() or line.lstrip().startswith("#") or ":" not in line:
            continue
        key, value = line.split(":", 1)
        meta[key.strip()] = parse_scalar(value)
    return meta, text[end + 5 :]


def extract_headings(body: str) -> list[str]:
    headings: list[str] = []
    in_fence = False
    for line in body.splitlines():
        if line.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        match = re.match(r"^#{1,3}\s+(.+?)\s*$", line)
        if match:
            headings.append(match.group(1))
    return headings


def load_notes() -> list[Note]:
    notes: list[Note] = []
    for path in canonical_markdown_files():
        meta, body = read_frontmatter(path)
        notes.append(
            Note(
                path=path,
                rel=path.relative_to(WIKI).as_posix(),
                meta=meta,
                headings=extract_headings(body),
            )
        )
    return notes


def quote_table(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ").strip()


def note_link(note: Note) -> str:
    target = Path("..") / Path(note.rel).with_suffix("")
    return target.as_posix()


def generated_header(title: str, summary: str, tags: list[str], timestamp: datetime) -> str:
    return (
        "---\n"
        f"title: {title}\n"
        "type: reference\n"
        "status: verified\n"
        f"tags: [{', '.join(tags)}]\n"
        f"updated: {timestamp.date().isoformat()}\n"
        "generated: true\n"
        f"summary: {summary}\n"
        "---\n\n"
    )


def render_wiki_index(notes: list[Note], timestamp: datetime) -> str:
    groups: dict[str, list[Note]] = defaultdict(list)
    for note in notes:
        groups[str(note.meta.get("type", "unknown"))].append(note)

    lines = [
        generated_header(
            "Wiki Index",
            "원본 위키 문서를 유형별로 나열한 LLM용 정적 인덱스.",
            ["wiki", "generated-index", "llm-context"],
            timestamp,
        ),
        "# Wiki Index\n\n",
        "> 생성 파일이다. 직접 편집하지 말고 `python tools/wiki_sync.py sync`를 실행한다.\n\n",
        f"- 생성 시각: {timestamp.isoformat(timespec='seconds')}\n",
        f"- 원본 문서: {len(notes)}개\n\n",
    ]
    for note_type in TYPE_ORDER + sorted(set(groups) - set(TYPE_ORDER)):
        typed = groups.get(note_type)
        if not typed:
            continue
        lines.extend(
            [
                f"## {note_type}\n\n",
                "| 문서 | 상태 | 태그 | 요약 | 갱신 |\n",
                "|---|---|---|---|---|\n",
            ]
        )
        for note in sorted(typed, key=lambda n: str(n.meta.get("title", n.rel)).lower()):
            tags = note.meta.get("tags", [])
            tag_text = ", ".join(tags) if isinstance(tags, list) else str(tags)
            lines.append(
                f"| [[{note_link(note)}|{quote_table(note.meta.get('title', note.rel))}]] "
                f"| {quote_table(note.meta.get('status', ''))} "
                f"| {quote_table(tag_text)} "
                f"| {quote_table(note.meta.get('summary', ''))} "
                f"| {quote_table(note.meta.get('updated', ''))} |\n"
            )
        lines.append("\n")
    return "".join(lines)


def render_tag_index(notes: list[Note], timestamp: datetime) -> str:
    tag_map: dict[str, list[Note]] = defaultdict(list)
    for note in notes:
        tags = note.meta.get("tags", [])
        if isinstance(tags, list):
            for tag in tags:
                tag_map[str(tag)].append(note)

    lines = [
        generated_header(
            "Tag Index",
            "원본 위키를 제한된 태그로 역탐색하는 정적 인덱스.",
            ["wiki", "generated-index", "tags"],
            timestamp,
        ),
        "# Tag Index\n\n",
        "> 생성 파일이다. 태그는 원본 노트 frontmatter에서 수정한다.\n\n",
    ]
    for tag in sorted(tag_map):
        links = ", ".join(
            f"[[{note_link(note)}|{note.meta.get('title', note.rel)}]]"
            for note in sorted(tag_map[tag], key=lambda n: str(n.meta.get("title", n.rel)).lower())
        )
        lines.append(f"- **{tag}** — {links}\n")
    return "".join(lines)


def render_catalog(notes: list[Note], timestamp: datetime) -> str:
    payload = {
        "generated": True,
        "generatedAt": timestamp.isoformat(timespec="seconds"),
        "documentCount": len(notes),
        "documents": [
            {
                "path": note.rel,
                "title": note.meta.get("title", ""),
                "type": note.meta.get("type", ""),
                "status": note.meta.get("status", ""),
                "tags": note.meta.get("tags", []),
                "updated": note.meta.get("updated", ""),
                "summary": note.meta.get("summary", ""),
                "headings": note.headings,
            }
            for note in notes
        ],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def write_if_changed(path: Path, content: str) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return False
    path.write_text(content, encoding="utf-8", newline="\n")
    return True


def sync_indexes(timestamp: datetime | None = None) -> list[Path]:
    timestamp = timestamp or now_kst()
    notes = load_notes()
    changed: list[Path] = []
    outputs = {
        META / "wiki-index.md": render_wiki_index(notes, timestamp),
        META / "tag-index.md": render_tag_index(notes, timestamp),
        GENERATED_JSON: render_catalog(notes, timestamp),
    }
    for path, content in outputs.items():
        if write_if_changed(path, content):
            changed.append(path)
    return changed


def repo_path(path_text: str) -> Path:
    path_text = path_text.strip().strip('"')
    if " -> " in path_text:
        path_text = path_text.split(" -> ", 1)[1]
    return (ROOT / path_text).resolve()


def working_changes() -> list[tuple[str, Path]]:
    changes: list[tuple[str, Path]] = []
    output = run_git("status", "--short", "--untracked-files=all")
    for line in output.splitlines():
        if len(line) < 4:
            continue
        status = line[:2].strip() or "M"
        changes.append((status, repo_path(line[3:])))
    return changes


def staged_changes() -> list[tuple[str, Path]]:
    changes: list[tuple[str, Path]] = []
    output = run_git("diff", "--cached", "--name-status", "--diff-filter=ACMRTUXB")
    for line in output.splitlines():
        parts = line.split("\t")
        if len(parts) >= 2:
            changes.append((parts[0][0], repo_path(parts[-1])))
    return changes


def meaningful_changes(changes: list[tuple[str, Path]]) -> list[tuple[str, Path]]:
    result: list[tuple[str, Path]] = []
    for status, path in changes:
        if ".git" in path.parts or is_generated(path):
            continue
        result.append((status, path))
    return result


def scoped_changes(changes: list[tuple[str, Path]], prefixes: list[str] | None) -> list[tuple[str, Path]]:
    if not prefixes:
        return changes
    normalized = [prefix.replace("\\", "/").strip("/") for prefix in prefixes]
    result: list[tuple[str, Path]] = []
    for status, path in changes:
        rel = relative_display(path)
        if any(rel == prefix or rel.startswith(prefix + "/") for prefix in normalized):
            result.append((status, path))
    return result


def wiki_changes(changes: list[tuple[str, Path]]) -> list[tuple[str, Path]]:
    result: list[tuple[str, Path]] = []
    for status, path in changes:
        try:
            path.resolve().relative_to(WIKI.resolve())
        except ValueError:
            continue
        if path.suffix.lower() != ".md" or is_generated(path) or is_template(path):
            continue
        result.append((status, path))
    return result


def design_changes(changes: list[tuple[str, Path]]) -> list[tuple[str, Path]]:
    """Return product, design, and ADR source changes for the design audit log."""
    prefixes = (
        "docs/wiki/01-product/",
        "docs/wiki/02-design/",
        "docs/wiki/04-decisions/",
    )
    return [
        (status, path)
        for status, path in changes
        if relative_display(path).startswith(prefixes)
    ]


def code_changes(changes: list[tuple[str, Path]]) -> list[tuple[str, Path]]:
    """Return implementation sources and implementation-wiki changes."""
    directory_prefixes = (
        "apps/",
        "packages/",
        "services/",
        "src/",
        "client/",
        "server/",
        "db/",
        "database/",
        "migrations/",
        "infra/",
        "scripts/",
        "tools/",
        ".github/workflows/",
        "docs/wiki/06-code/",
    )
    root_files = {
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        "tsconfig.json",
        "vite.config.ts",
        "vitest.config.ts",
        "playwright.config.ts",
        "Cargo.toml",
        "Cargo.lock",
        "Dockerfile",
        "docker-compose.yml",
        "docker-compose.yaml",
    }
    source_suffixes = {
        ".c",
        ".cc",
        ".cpp",
        ".cs",
        ".css",
        ".graphql",
        ".h",
        ".hpp",
        ".html",
        ".js",
        ".jsx",
        ".mjs",
        ".proto",
        ".py",
        ".rs",
        ".scss",
        ".sql",
        ".ts",
        ".tsx",
        ".vue",
        ".wgsl",
    }
    result: list[tuple[str, Path]] = []
    for status, path in changes:
        rel = relative_display(path)
        if rel in root_files or rel.startswith(directory_prefixes) or path.suffix.lower() in source_suffixes:
            result.append((status, path))
    return result


def touch_updated(paths: list[Path], date_text: str) -> list[Path]:
    touched: list[Path] = []
    canonical = {p.resolve() for p in canonical_markdown_files()}
    for path in sorted({p.resolve() for p in paths}):
        if path not in canonical or not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        end = text.find("\n---\n", 4) if text.startswith("---\n") else -1
        if end < 0:
            continue
        front = text[: end + 5]
        rest = text[end + 5 :]
        updated = re.sub(r"(?m)^updated:\s*.*$", f"updated: {date_text}", front, count=1)
        if updated != front:
            path.write_text(updated + rest, encoding="utf-8", newline="\n")
            touched.append(path)
    return touched


def relative_display(path: Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def change_signature(
    changes: list[tuple[str, Path]],
    summary: str,
    why: str,
    impact: str,
    validation: str,
    documentation: str,
    category: str,
) -> str:
    rows = [f"{status}:{relative_display(path)}" for status, path in sorted(changes, key=lambda x: relative_display(x[1]))]
    raw = "\n".join([category, summary, why, impact, validation, documentation, *rows]).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:12]


def log_candidates(kind: str, timestamp: datetime) -> list[Path]:
    year_dir = LOG_ROOT / kind / f"{timestamp.year:04d}"
    base = timestamp.strftime("%Y-%m")
    return [year_dir / f"{base}.md", *[year_dir / f"{base}-part{i:02d}.md" for i in range(2, 100)]]


def count_events(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(1 for line in path.read_text(encoding="utf-8").splitlines() if line.startswith("- "))


def log_header(kind: str, timestamp: datetime) -> str:
    titles = {
        "all": "All Work Log",
        "wiki": "Wiki Change Log",
        "design": "Design Change Log",
        "code": "Code Change Log",
    }
    tags = {
        "all": "work-log",
        "wiki": "wiki-change-log",
        "design": "design-change-log",
        "code": "code-change-log",
    }
    title = titles[kind]
    tag = tags[kind]
    summary = {
        "all": "스크립트가 생성한 두 줄 전체 작업 감사 로그. 자세한 차이는 Git과 원본 노트를 확인한다.",
        "wiki": "스크립트가 생성한 두 줄 위키 변경 로그. 자세한 근거는 원본 노트와 ADR을 확인한다.",
        "design": "제품·기획·ADR 변경만 모은 두 줄 기획 변경 로그. 결정 근거는 원본 노트와 ADR을 확인한다.",
        "code": "중요 구현 소스와 코드 위키 변경을 모은 두 줄 코드 변경 로그. 계약과 의도는 06-code 원본을 확인한다.",
    }[kind]
    return generated_header(
        f"{title} {timestamp.strftime('%Y-%m')}",
        summary,
        ["generated-log", tag, timestamp.strftime("%Y")],
        timestamp,
    ) + f"# {title} — {timestamp.strftime('%Y-%m')}\n\n"


def append_log(
    kind: str,
    changes: list[tuple[str, Path]],
    summary: str,
    why: str,
    impact: str,
    validation: str,
    documentation: str,
    category: str,
    actor: str,
    timestamp: datetime,
) -> Path | None:
    if not changes:
        return None
    signature = change_signature(changes, summary, why, impact, validation, documentation, category)
    candidates = log_candidates(kind, timestamp)
    for path in candidates:
        if path.exists() and f"sig:{signature}" in path.read_text(encoding="utf-8"):
            return None

    target = next(path for path in candidates if count_events(path) < MAX_LOG_EVENTS)
    if target.exists():
        text = target.read_text(encoding="utf-8")
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        text = log_header(kind, timestamp)

    ordered = sorted(changes, key=lambda item: relative_display(item[1]))
    shown = ordered[:12]
    paths_text = ", ".join(f"`{status} {relative_display(path)}`" for status, path in shown)
    if len(ordered) > len(shown):
        paths_text += f", +{len(ordered) - len(shown)} more"
    entry = (
        f"- {timestamp.strftime('%d %H:%M')} | `{category}` | what:{summary.strip()} | actor:{actor.strip()} | files:{len(ordered)} | sig:{signature}\n"
        f"  - why:{why.strip()} | impact:{impact.strip()} | validation:{validation.strip()} | docs:{documentation.strip()} | paths:{paths_text}\n"
    )
    target.write_text(text + entry, encoding="utf-8", newline="\n")
    return target


def resolve_wikilink(source: Path, target: str) -> bool:
    target_path = Path(target)
    candidates: list[Path] = []
    if target_path.suffix == ".md":
        candidates.extend([source.parent / target_path, WIKI / target_path])
    else:
        candidates.extend([source.parent / target_path.with_suffix(".md"), WIKI / target_path.with_suffix(".md")])
    if any(path.resolve().exists() for path in candidates):
        return True
    if "/" not in target and "\\" not in target:
        matches = list(WIKI.rglob(f"{target}.md"))
        return len(matches) == 1
    return False


def validate_notes(notes: list[Note]) -> list[str]:
    errors: list[str] = []
    for note in notes:
        for field in REQUIRED_FIELDS:
            if field not in note.meta or note.meta[field] in ("", []):
                errors.append(f"{note.rel}: missing frontmatter field '{field}'")
        note_type = str(note.meta.get("type", ""))
        status = str(note.meta.get("status", ""))
        if note_type and note_type not in VALID_TYPES:
            errors.append(f"{note.rel}: invalid type '{note_type}'")
        if status and status not in VALID_STATUSES:
            errors.append(f"{note.rel}: invalid status '{status}'")
        updated = str(note.meta.get("updated", ""))
        if updated and not DATE_RE.match(updated):
            errors.append(f"{note.rel}: updated must be YYYY-MM-DD")
        tags = note.meta.get("tags", [])
        if not isinstance(tags, list):
            errors.append(f"{note.rel}: tags must be an inline list")
        else:
            if not 2 <= len(tags) <= 6:
                errors.append(f"{note.rel}: use 2-6 tags, found {len(tags)}")
            for tag in tags:
                if not TAG_RE.match(str(tag)):
                    errors.append(f"{note.rel}: invalid tag '{tag}'")

        text = note.path.read_text(encoding="utf-8")
        for target in WIKILINK_RE.findall(text):
            if not resolve_wikilink(note.path, target.strip()):
                errors.append(f"{note.rel}: unresolved wikilink '[[{target}]]'")
    return errors


def check_generated(notes: list[Note]) -> list[str]:
    errors: list[str] = []
    for path in [*GENERATED_MD, GENERATED_JSON]:
        if not path.exists():
            errors.append(f"missing generated file: {relative_display(path)}")
    if GENERATED_JSON.exists():
        try:
            data = json.loads(GENERATED_JSON.read_text(encoding="utf-8"))
            if data.get("documentCount") != len(notes):
                errors.append("search-catalog.json documentCount is stale")
        except json.JSONDecodeError as exc:
            errors.append(f"search-catalog.json is invalid JSON: {exc}")
    return errors


def do_finalize(args: argparse.Namespace, staged: bool = False) -> list[Path]:
    timestamp = now_kst()
    changes = staged_changes() if staged else working_changes()
    changes = meaningful_changes(changes)
    changes = scoped_changes(changes, getattr(args, "path", None))
    touch_updated([path for _, path in wiki_changes(changes)], timestamp.date().isoformat())
    if not staged:
        changes = meaningful_changes(working_changes())
        changes = scoped_changes(changes, getattr(args, "path", None))
    changed_outputs: list[Path] = []
    all_log = append_log(
        "all", changes, args.summary, args.why, args.impact, args.validation, args.documentation,
        args.category, args.actor, timestamp,
    )
    if all_log:
        changed_outputs.append(all_log)
    wiki_only = wiki_changes(changes)
    wiki_log = append_log(
        "wiki", wiki_only, args.summary, args.why, args.impact, args.validation, args.documentation,
        args.category, args.actor, timestamp,
    )
    if wiki_log:
        changed_outputs.append(wiki_log)
    design_only = design_changes(wiki_only)
    design_log = append_log(
        "design", design_only, args.summary, args.why, args.impact, args.validation, args.documentation,
        args.category, args.actor, timestamp,
    )
    if design_log:
        changed_outputs.append(design_log)
    code_only = code_changes(changes)
    code_log = append_log(
        "code", code_only, args.summary, args.why, args.impact, args.validation, args.documentation,
        args.category, args.actor, timestamp,
    )
    if code_log:
        changed_outputs.append(code_log)
    changed_outputs.extend(sync_indexes(timestamp))
    return changed_outputs


def stage_generated(paths: list[Path], touched: list[Path]) -> None:
    candidates = [*paths, *touched]
    existing = [relative_display(path) for path in candidates if path.exists()]
    if existing:
        run_git("add", "--", *existing)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("sync", help="regenerate wiki and tag indexes plus JSON catalog")
    sub.add_parser("check", help="validate metadata, wikilinks and generated outputs")
    for name in ("finalize", "pre-commit"):
        cmd = sub.add_parser(name)
        cmd.add_argument("--summary", required=name == "finalize", default="Git 커밋 전 위키 자동 동기화")
        cmd.add_argument(
            "--why",
            required=name == "finalize",
            default="스테이징된 변경을 감사 로그와 위키 인덱스에 반영",
        )
        cmd.add_argument(
            "--impact",
            required=name == "finalize",
            default="변경 경로와 연결된 기능",
        )
        cmd.add_argument(
            "--validation",
            required=name == "finalize",
            default="pre-commit 위키 메타데이터·링크 검사",
        )
        cmd.add_argument(
            "--documentation",
            required=name == "finalize",
            default="스테이징된 코드 위키·ADR 경로 참조; 없으면 후속 문서화 검토",
        )
        cmd.add_argument("--category", choices=sorted(VALID_CATEGORIES), default="ops")
        cmd.add_argument("--actor", default="git-hook" if name == "pre-commit" else "llm")
        if name == "finalize":
            cmd.add_argument(
                "--path",
                action="append",
                help="limit audit input to a repository path prefix; repeat as needed",
            )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.command == "sync":
        changed = sync_indexes()
        print(f"wiki sync: {len(changed)} generated file(s) updated")
        return 0
    if args.command == "check":
        notes = load_notes()
        errors = [*validate_notes(notes), *check_generated(notes)]
        if errors:
            for error in errors:
                print(f"ERROR: {error}", file=sys.stderr)
            print(f"wiki check failed: {len(errors)} error(s)", file=sys.stderr)
            return 1
        print(f"wiki check passed: {len(notes)} canonical note(s)")
        return 0
    if args.command == "finalize":
        changed = do_finalize(args, staged=False)
        print(f"wiki finalize: {len(changed)} generated/log file(s) updated")
        return 0
    if args.command == "pre-commit":
        staged = meaningful_changes(staged_changes())
        if not staged:
            print("wiki pre-commit: no staged source changes")
            return 0
        timestamp = now_kst()
        touched = touch_updated([path for _, path in wiki_changes(staged)], timestamp.date().isoformat())
        changed = do_finalize(args, staged=True)
        stage_generated(changed, touched)
        notes = load_notes()
        errors = [*validate_notes(notes), *check_generated(notes)]
        if errors:
            for error in errors:
                print(f"ERROR: {error}", file=sys.stderr)
            return 1
        print(f"wiki pre-commit: staged {len(changed) + len(touched)} synchronized file(s)")
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
