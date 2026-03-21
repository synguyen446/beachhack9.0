from ddgs import DDGS
from langchain_core.tools import tool


@tool
def web_search(query: str) -> str:
    """Search the web for current best practices, articles, and documentation.
    Use specific, targeted queries to get the most relevant results."""
    print(f"  [Web Search] query: {query}", flush=True)
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))
        if not results:
            return f"No results found for: {query}"
        lines = [f"Search results for: '{query}'\n"]
        for i, r in enumerate(results, 1):
            lines.append(f"[{i}] {r.get('title', 'No title')}")
            lines.append(f"    URL: {r.get('href', 'N/A')}")
            lines.append(f"    {r.get('body', 'No snippet')}\n")
        return "\n".join(lines)
    except Exception as e:
        return f"Search error for '{query}': {e}"
