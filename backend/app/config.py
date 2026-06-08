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

    # --- OpenAI ---
    openai_api_key: str = Field(..., alias="OPENAI_API_KEY")
    openai_model: str = Field("gpt-5-mini", alias="OPENAI_MODEL")

    # --- DataSpace MCP ---
    mcp_server_url: str = Field(
        "https://dataspace-mcp.onrender.com/mcp", alias="MCP_SERVER_URL"
    )
    mcp_server_label: str = Field("mps", alias="MCP_SERVER_LABEL")

    # --- CORS ---
    allowed_origins: str = Field("http://localhost:5173", alias="ALLOWED_ORIGINS")

    # --- GitHub OAuth (Publish; optional until P4) ---
    github_client_id: str = Field("", alias="GITHUB_CLIENT_ID")
    github_client_secret: str = Field("", alias="GITHUB_CLIENT_SECRET")
    github_oauth_callback_url: str = Field(
        "http://localhost:8000/api/github/callback",
        alias="GITHUB_OAUTH_CALLBACK_URL",
    )
    session_secret: str = Field("change-me", alias="SESSION_SECRET")

    @property
    def allowed_origins_list(self) -> list[str]:
        """CORS origins as a clean list."""
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (read env once per process)."""
    return Settings()  # type: ignore[call-arg]
