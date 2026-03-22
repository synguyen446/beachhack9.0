import os

from langchain_openai import ChatOpenAI
from langchain.agents import create_agent as create_react_agent

from tools.web_search import web_search

MODEL = os.environ.get("ASI1_MODEL", "asi1-mini")
ASI1_BASE_URL = os.environ.get("ASI1_BASE_URL", "https://api.asi1.ai/v1")
ASI1_API_KEY = os.environ.get("ASI1_API_KEY", "")


def _asi1_kwargs(model: str) -> dict:
    """Build ChatOpenAI kwargs for the ASI:One Premium API."""
    return {
        "model": model,
        "base_url": ASI1_BASE_URL,
        "api_key": ASI1_API_KEY,
    }


class BaseAgent:
    """Async agent with configurable tools via LangGraph + Ollama."""

    def __init__(self, name: str, system_prompt: str, tools=None):
        self.name = name
        self._tools = tools if tools is not None else [web_search]
        self._system_prompt = "Always respond in English.\n If you are not confident and can web search for information, web_search\n" + system_prompt
        llm = ChatOpenAI(**_asi1_kwargs(MODEL))
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
        formatter = ChatOpenAI(**_asi1_kwargs(MODEL)).with_structured_output(schema)
        result = await formatter.ainvoke(
            "Always respond in English. "
            "Extract the following information from this architecture report "
            f"and return it as structured data:\n\n{text}"
        )
        return result.model_dump() if hasattr(result, "model_dump") else result  # type: ignore[union-attr]
