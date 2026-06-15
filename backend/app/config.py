"""Application configuration, loaded from the environment.

Secrets (OpenAI key, GitHub client secret, ...) MUST come from the environment
or a local ``.env`` file — never hard-code them in source. See ``.env.example``.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly-typed settings sourced from environment variables / ``.env``."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- LLM provider selection ---
    # This branch (ctx-space-claude) runs on Claude via the Agent SDK.
    # "claude" -> CtxSpaceClaudeAgent (Agent SDK, subscription auth)
    # "openai" -> CtxSpaceAgent (kept for parity with the main branch)
    llm_provider: str = Field("claude", alias="LLM_PROVIDER")

    # --- OpenAI (optional on this branch; required only if llm_provider="openai") ---
    openai_api_key: str = Field("", alias="OPENAI_API_KEY")
    openai_model: str = Field("gpt-5-mini", alias="OPENAI_MODEL")

    # --- Claude (Agent SDK) ---
    # Long-lived OAuth token from `claude setup-token` (subscription auth, ~1yr).
    # IMPORTANT: do NOT set ANTHROPIC_API_KEY in the same environment — per the SDK
    # auth precedence, an API key OVERRIDES this token and would bill differently.
    claude_code_oauth_token: str = Field("", alias="CLAUDE_CODE_OAUTH_TOKEN")
    # Default model for code generation. Sonnet balances quality/credit; bump to
    # claude-opus-4-8 for the hardest prompts.
    claude_model: str = Field("claude-sonnet-4-6", alias="CLAUDE_MODEL")
    # Fallback model if the primary is unavailable / overloaded.
    claude_fallback_model: str = Field("claude-haiku-4-5-20251001", alias="CLAUDE_FALLBACK_MODEL")
    # Hard per-run cost ceiling (USD-equivalent) to protect the monthly Agent SDK
    # credit. 0 disables the guard.
    claude_max_budget_usd: float = Field(0.0, alias="CLAUDE_MAX_BUDGET_USD")

    # --- MCP servers ---
    # Single-server legacy config (still works):
    #   MCP_SERVER_URL=http://...  MCP_SERVER_LABEL=myserver
    # Multi-server config (JSON, takes precedence when set):
    #   MCP_SERVERS=[{"label":"dataspace","url":"http://..."},{"label":"scaffold","url":"http://..."}]
    mcp_server_url: str = Field(
        "https://dataspace-mcp.onrender.com/mcp", alias="MCP_SERVER_URL"
    )
    mcp_server_label: str = Field("mps", alias="MCP_SERVER_LABEL")
    mcp_servers_json: str = Field("", alias="MCP_SERVERS")

    @property
    def mcp_servers_list(self) -> list[dict[str, str]]:
        """Return all MCP servers as [{"label": ..., "url": ...}, ...].

        If MCP_SERVERS JSON is set, use that exclusively.
        Otherwise fall back to the single MCP_SERVER_URL / MCP_SERVER_LABEL pair.
        """
        if self.mcp_servers_json.strip():
            import json as _json
            return _json.loads(self.mcp_servers_json)
        if self.mcp_server_url.strip():
            return [{"label": self.mcp_server_label, "url": self.mcp_server_url}]
        return []

    # --- CORS ---
    allowed_origins: str = Field("http://localhost:5173", alias="ALLOWED_ORIGINS")

    # --- GitHub (Publish — push generated code to your account) ---
    github_token: str = Field("", alias="GITHUB_TOKEN")
    github_username: str = Field("", alias="GITHUB_USERNAME")

    # --- PocketBase (project storage) ---
    pocketbase_url: str = Field("http://127.0.0.1:8090", alias="POCKETBASE_URL")
    pocketbase_email: str = Field("", alias="POCKETBASE_EMAIL")
    pocketbase_password: str = Field("", alias="POCKETBASE_PASSWORD")
    pocketbase_collection: str = Field(
        "ctx_space_projects", alias="POCKETBASE_COLLECTION"
    )

    @property
    def allowed_origins_list(self) -> list[str]:
        """CORS origins as a clean list."""
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (read env once per process)."""
    return Settings()  # type: ignore[call-arg]
