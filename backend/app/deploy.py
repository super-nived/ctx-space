"""Deploy generated projects to Netlify (frontend) and Render (middleware).

Netlify — build server-side, deploy the static output.
  Two approaches were tried and rejected before this one:
  1. Direct-to-API zip of source files: Netlify treats an uploaded zip as the
     final publish directory and ignores netlify.toml's [build] command for
     file deploys — raw .tsx got served as static assets (wrong MIME type).
  2. Git-linked site via POST /sites with a repo path: Netlify's public API
     can't actually attach the GitHub App to a site this way, so it falls
     back to SSH cloning and fails with "Host key verification failed" even
     for public repos and even with the GitHub App connected account-wide.
  This approach avoids both: we write the Vite scaffold + generated files to
  a temp dir, run `npm install && npm run build` ourselves (Node 22 is in
  the backend image already), zip only the `dist/` output, and upload that.
  Netlify just serves static files — no build step on Netlify's side at all.

Render — Web Service from GitHub repo.
  Requires the project to have been published to GitHub first (uses repo_url).
  Creates a Render web service pointing at the repo; Render builds and deploys.

Both are fully isolated in this file. Drop this file + the /deploy route in
projects.py to remove the feature entirely with zero side effects.
"""

from __future__ import annotations

import asyncio
import io
import json
import re
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Any

import httpx

# ── Netlify ────────────────────────────────────────────────────────────────────

_NETLIFY = "https://api.netlify.com/api/v1"

# Fixed scaffold files injected around the user's generated src/ files.
# Mirrors the react-frontend scaffold template exactly.

_PACKAGE_JSON = json.dumps({
    "name": "ctx-space-app",
    "private": True,
    "version": "0.1.0",
    "type": "module",
    "scripts": {
        "dev": "vite",
        "build": "vite build",
        "preview": "vite preview"
    },
    "dependencies": {
        "react": "^18.3.1",
        "react-dom": "^18.3.1",
        "lucide-react": "^0.454.0"
    },
    "devDependencies": {
        "@types/react": "^18.3.1",
        "@types/react-dom": "^18.3.1",
        "@vitejs/plugin-react": "^4.3.4",
        "@tailwindcss/postcss": "^4.0.0",
        "tailwindcss": "^4.0.0",
        "typescript": "~5.7.2",
        "vite": "^6.0.5"
    }
}, indent=2)

_TSCONFIG_JSON = json.dumps({
    "files": [],
    "references": [
        {"path": "./tsconfig.app.json"},
        {"path": "./tsconfig.node.json"}
    ]
}, indent=2)

_TSCONFIG_APP_JSON = json.dumps({
    "compilerOptions": {
        "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
        "target": "ES2020",
        "useDefineForClassFields": True,
        "lib": ["ES2020", "DOM", "DOM.Iterable"],
        "module": "ESNext",
        "skipLibCheck": True,
        "moduleResolution": "bundler",
        "allowImportingTsExtensions": True,
        "isolatedModules": True,
        "moduleDetection": "force",
        "noEmit": True,
        "jsx": "react-jsx",
        "strict": True,
        "noUnusedLocals": False,
        "noUnusedParameters": False,
        "noFallthroughCasesInSwitch": True,
        "noUncheckedSideEffectImports": True
    },
    "include": ["src"]
}, indent=2)

_TSCONFIG_NODE_JSON = json.dumps({
    "compilerOptions": {
        "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
        "target": "ES2022",
        "lib": ["ES2022"],
        "module": "ESNext",
        "skipLibCheck": True,
        "moduleResolution": "bundler",
        "allowImportingTsExtensions": True,
        "isolatedModules": True,
        "moduleDetection": "force",
        "noEmit": True,
        "strict": True,
        "noUnusedLocals": False,
        "noUnusedParameters": False
    },
    "include": ["vite.config.ts"]
}, indent=2)

_VITE_CONFIG = """\
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
});
"""

_INDEX_HTML = """\
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
"""

_MAIN_TSX = """\
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
"""

_INDEX_CSS = """\
@import "tailwindcss";
"""

_VITE_ENV_DTS = """\
/// <reference types="vite/client" />
"""


_TAILWIND_V3_PATTERN = re.compile(
    r"@tailwind\s+(base|components|utilities)\s*;?", re.IGNORECASE
)


def _fix_css(css: str) -> str:
    """Ensure a CSS file uses Tailwind v4 @import, not v3 @tailwind directives.

    If the file already starts with @import "tailwindcss" it is returned unchanged.
    If it contains @tailwind directives (v3 syntax) those are stripped and
    @import "tailwindcss" is prepended instead.
    If it has neither, @import "tailwindcss" is prepended unconditionally so that
    Tailwind utilities are always included in the build output.
    """
    if '@import "tailwindcss"' in css or "@import 'tailwindcss'" in css:
        return css
    cleaned = _TAILWIND_V3_PATTERN.sub("", css).strip()
    return _INDEX_CSS + ("\n" + cleaned if cleaned else "")


def _write_scaffold(project_dir: Path, project_files: dict[str, str]) -> None:
    """Write the Vite scaffold + user generated files into project_dir."""
    (project_dir / "package.json").write_text(_PACKAGE_JSON)
    (project_dir / "tsconfig.json").write_text(_TSCONFIG_JSON)
    (project_dir / "tsconfig.app.json").write_text(_TSCONFIG_APP_JSON)
    (project_dir / "tsconfig.node.json").write_text(_TSCONFIG_NODE_JSON)
    (project_dir / "vite.config.ts").write_text(_VITE_CONFIG)
    (project_dir / "index.html").write_text(_INDEX_HTML)

    (project_dir / "src").mkdir(parents=True, exist_ok=True)

    has_main = any(
        p in ("src/main.tsx", "src/main.ts", "src/index.tsx")
        for p in project_files
    )
    if not has_main:
        (project_dir / "src" / "main.tsx").write_text(_MAIN_TSX)

    has_vite_env = "src/vite-env.d.ts" in project_files
    if not has_vite_env:
        (project_dir / "src" / "vite-env.d.ts").write_text(_VITE_ENV_DTS)

    for path, contents in project_files.items():
        full_path = project_dir / path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        # Always enforce Tailwind v4 syntax in every CSS file so builds never
        # silently produce unstyled output due to agent-written v3 directives.
        if path.endswith(".css"):
            contents = _fix_css(contents)
        full_path.write_text(contents)

    # If the agent wrote no CSS file at all, create the default one.
    has_css = any(p.endswith(".css") for p in project_files)
    if not has_css:
        (project_dir / "src" / "index.css").write_text(_INDEX_CSS)


async def _run(cmd: list[str], cwd: Path) -> None:
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=str(cwd),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    output, _ = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(
            f"{' '.join(cmd)} failed (exit {proc.returncode}):\n{output.decode(errors='replace')[-4000:]}"
        )


def _zip_dir(dir_path: Path) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in dir_path.rglob("*"):
            if file.is_file():
                zf.write(file, file.relative_to(dir_path))
    return buf.getvalue()


async def _build_dist_zip(project_files: dict[str, str]) -> bytes:
    """Write the scaffold, run npm install + build, zip the dist/ output."""
    tmp = Path(tempfile.mkdtemp(prefix="ctx-deploy-"))
    try:
        _write_scaffold(tmp, project_files)
        await _run(["npm", "install", "--no-audit", "--no-fund"], cwd=tmp)
        await _run(["npm", "run", "build"], cwd=tmp)
        dist = tmp / "dist"
        if not dist.is_dir():
            raise RuntimeError("Build finished but dist/ was not created.")
        return _zip_dir(dist)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _netlify_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _get_or_create_netlify_site(
    client: httpx.AsyncClient,
    token: str,
    site_name: str,
    existing_site_id: str | None,
) -> dict[str, Any]:
    """Return existing site or create a new one."""
    if existing_site_id:
        r = await client.get(
            f"{_NETLIFY}/sites/{existing_site_id}",
            headers=_netlify_headers(token),
        )
        if r.status_code == 200:
            return r.json()

    r = await client.post(
        f"{_NETLIFY}/sites",
        headers=_netlify_headers(token),
        json={"name": site_name},
    )
    r.raise_for_status()
    return r.json()


async def deploy_to_netlify(
    token: str,
    project_name: str,
    project_id: str,
    files: dict[str, str],
    existing_site_id: str | None = None,
) -> dict[str, str]:
    """Build the project ourselves, then upload the static dist/ to Netlify."""
    slug = re.sub(r"[^a-z0-9]+", "-", project_name.lower()).strip("-") or "ctx-app"
    site_name = f"ctx-{slug}-{project_id[:6]}"

    zip_bytes = await _build_dist_zip(files)

    async with httpx.AsyncClient(timeout=120) as client:
        site = await _get_or_create_netlify_site(
            client, token, site_name, existing_site_id
        )
        site_id: str = site["id"]

        deploy_r = await client.post(
            f"{_NETLIFY}/sites/{site_id}/deploys",
            headers={
                **_netlify_headers(token),
                "Content-Type": "application/zip",
            },
            content=zip_bytes,
        )
        deploy_r.raise_for_status()
        deploy = deploy_r.json()

        deploy_url: str = (
            deploy.get("deploy_ssl_url")
            or deploy.get("deploy_url")
            or site.get("ssl_url")
            or site.get("url")
            or f"https://{site_name}.netlify.app"
        )

    return {
        "site_id": site_id,
        "deploy_url": deploy_url,
        "site_url": site.get("ssl_url") or site.get("url") or deploy_url,
        "provider": "netlify",
    }


# ── Render ─────────────────────────────────────────────────────────────────────

_RENDER = "https://api.render.com/v1"


def _render_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Accept": "application/json"}


async def deploy_to_render(
    token: str,
    project_name: str,
    project_id: str,
    github_repo_url: str,
    existing_service_id: str | None = None,
) -> dict[str, str]:
    """Create or redeploy a Render web service from the GitHub repo.

    Requires the project to have been published to GitHub first.
    Returns service_id and service_url.
    """
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", project_name.lower()).strip("-") or "ctx-app"
    service_name = f"ctx-{slug}-{project_id[:6]}"

    # Extract owner/repo from URL e.g. https://github.com/user/repo
    repo_path = github_repo_url.rstrip("/").replace("https://github.com/", "")

    async with httpx.AsyncClient(timeout=60) as client:
        if existing_service_id:
            # Trigger a new deploy on the existing service
            r = await client.post(
                f"{_RENDER}/services/{existing_service_id}/deploys",
                headers=_render_headers(token),
                json={},
            )
            if r.status_code in (200, 201):
                svc_r = await client.get(
                    f"{_RENDER}/services/{existing_service_id}",
                    headers=_render_headers(token),
                )
                svc = svc_r.json().get("service", {})
                return {
                    "service_id": existing_service_id,
                    "service_url": f"https://{svc.get('slug', service_name)}.onrender.com",
                    "provider": "render",
                }

        # Create new web service
        payload = {
            "type": "web_service",
            "name": service_name,
            "repo": f"https://github.com/{repo_path}",
            "branch": "main",
            "buildCommand": "pip install -r requirements.txt",
            "startCommand": "uvicorn app.main:app --host 0.0.0.0 --port $PORT",
            "plan": "free",
            "region": "oregon",
            "envVars": [],
        }
        r = await client.post(
            f"{_RENDER}/services",
            headers=_render_headers(token),
            json=payload,
        )
        r.raise_for_status()
        data = r.json()
        svc = data.get("service", data)
        service_id: str = svc.get("id", "")
        service_url = f"https://{svc.get('slug', service_name)}.onrender.com"

    return {
        "service_id": service_id,
        "service_url": service_url,
        "provider": "render",
    }
