import os
from urllib.parse import urlparse, urlunparse

from langchain_ollama import ChatOllama
from langchain.agents import create_agent as create_react_agent

from tools.web_search import web_search

MODEL = os.environ.get("LOCAL_LLM_MODEL", "qwen3.5")
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_AUTH = os.environ.get("OLLAMA_BASIC_AUTH", "")


def _get_ollama_url() -> str:
    """Embed OLLAMA_BASIC_AUTH credentials into the base URL if set."""
    if not OLLAMA_AUTH:
        return OLLAMA_BASE_URL
    parsed = urlparse(OLLAMA_BASE_URL)
    authed = parsed._replace(netloc=f"{OLLAMA_AUTH}@{parsed.hostname}" + (f":{parsed.port}" if parsed.port else ""))
    return urlunparse(authed)


def _ollama_kwargs(model: str) -> dict:
    """Build ChatOllama kwargs with auth-embedded URL."""
    return {"model": model, "base_url": _get_ollama_url()}


class BaseAgent:
    """Async agent with configurable tools via LangGraph + Ollama."""

    def __init__(self, name: str, system_prompt: str, tools=None):
        self.name = name
        self._tools = tools if tools is not None else [web_search]
        self._system_prompt = "Always respond in English.\n If you are not confident and can web search for information, web_search\n" + system_prompt
        llm = ChatOllama(**_ollama_kwargs(MODEL))
        self.graph = create_react_agent(llm, self._tools, system_prompt=self._system_prompt)

    async def run(self, user_message: str) -> str:
        print(f"  [{self.name}] thinking...", flush=True)
        result = await self.graph.ainvoke({"messages": [{"role": "user", "content": user_message}]})
        print(f"  [{self.name}] Done", flush=True)
        return result["messages"][-1].content

    async def run_structured(self, user_message: str, schema: type):
        # Step 1: run agent normally (tools, web search, etc.)
        text = await self.run(user_message)

        # Step 2: bare LLM (no tools) extracts structure from the text
        formatter = ChatOllama(**_ollama_kwargs(MODEL)).with_structured_output(schema)
        result = await formatter.ainvoke(
            "Always respond in English. "
            "Extract the following information from this architecture report "
            f"and return it as structured data:\n\n{text}"
        )
        return result.model_dump() if hasattr(result, "model_dump") else result  # type: ignore[union-attr]
