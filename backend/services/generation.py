import asyncio
import json
import os
from typing import AsyncGenerator

from langchain_ollama import ChatOllama

from models.schemas import ArchitectureGraph
from utils.doc_agents import make_doc_agents
from models.database import create_project, save_document, get_project_context


AGENT_NAMES = [
    "Project Overview",
    "Requirements",
    "User Stories",
    "System Architecture",
    "API Spec",
    "Data Model",
    "DevOps & Deployment",
    "Testing Strategy",
]

ARCH_AGENT_NAME = "System Architecture"
DATA_MODEL_AGENT_NAME = "Data Model"
GRAPH_AGENTS = {ARCH_AGENT_NAME, DATA_MODEL_AGENT_NAME}


def _build_prompt(idea: str, context: str | None = None) -> str:
    parts = [
        "Produce your documentation artifact for this software project idea:\n",
        idea,
    ]
    if context:
        parts.append("\n\n## Project Details (from user interview)\n")
        parts.append(context)
    parts.append("\n\nFollow your instructions exactly and return only your document.")
    return "\n".join(parts)


async def _extract_graph(markdown: str, instruction: str) -> dict:
    """Run a bare formatter LLM to extract a graph structure from markdown."""
    try:
        model = os.environ.get("LOCAL_LLM_MODEL", "qwen3.5")
        base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
        auth = os.environ.get("OLLAMA_BASIC_AUTH", "")
        if auth:
            from urllib.parse import urlparse, urlunparse
            parsed = urlparse(base_url)
            base_url = urlunparse(parsed._replace(
                netloc=f"{auth}@{parsed.hostname}" + (f":{parsed.port}" if parsed.port else "")
            ))
        formatter = ChatOllama(model=model, base_url=base_url).with_structured_output(ArchitectureGraph)
        result = await formatter.ainvoke(f"Always respond in English. {instruction}\n\n{markdown}")
        return result.model_dump() if hasattr(result, "model_dump") else {"nodes": [], "edges": []}
    except Exception:
        import traceback
        traceback.print_exc()
        return {"nodes": [], "edges": []}


async def _run_single_agent(agent, prompt: str, queue: asyncio.Queue, project_id: int):
    """Run one agent, persist output, push events to queue."""
    await queue.put({"type": "status", "agent": agent.name})
    try:
        if agent.name in GRAPH_AGENTS:
            markdown = await agent.run(prompt)

            if agent.name == ARCH_AGENT_NAME:
                instruction = (
                    "Extract the architecture graph from this report and return it as structured data "
                    "with nodes and edges."
                )
            else:
                instruction = (
                    "Extract the entity-relationship graph from this data model document. "
                    "Map each database entity/table to a node (use node_type='database', assign each entity "
                    "a unique lowercase-hyphenated id, a short label, its primary technology/engine, "
                    "and a layer integer grouping related entities together). "
                    "Map each relationship (foreign key / association) to an edge with a label like "
                    "'1:N', 'M:N', or the FK column name. Return structured data with nodes and edges."
                )

            graph_data = await _extract_graph(markdown, instruction)

            doc_id = await save_document(project_id, agent.name, markdown, arch_graph=json.dumps(graph_data))
            await queue.put({
                "type": "result",
                "agent": agent.name,
                "markdown": markdown,
                "doc_id": doc_id,
                "nodes": graph_data.get("nodes", []),
                "edges": graph_data.get("edges", []),
            })
        else:
            output = await agent.run(prompt)
            doc_id = await save_document(project_id, agent.name, output)
            await queue.put({"type": "result", "agent": agent.name, "markdown": output, "doc_id": doc_id})
    except Exception as e:
        import traceback
        traceback.print_exc()
        await queue.put({"type": "error", "agent": agent.name, "message": str(e)})


async def run_generation(idea: str, agent_name: str, project_id: int | None) -> AsyncGenerator[dict, None]:
    """Async generator yielding SSE event dicts for document generation."""
    agents = make_doc_agents()
    agent_map = {a.name: a for a in agents}

    context = None
    if project_id is not None:
        context = await get_project_context(project_id)
    prompt = _build_prompt(idea, context)

    if agent_name != "all" and agent_name not in agent_map:
        yield {"type": "error", "agent": agent_name, "error": f"Unknown agent: {agent_name}"}
        return

    if project_id is None:
        project_id = await create_project(idea)
    yield {"type": "project", "project_id": project_id}

    queue: asyncio.Queue = asyncio.Queue()

    if agent_name == "all":
        targets = agents
    else:
        targets = [agent_map[agent_name]]

    tasks = [
        asyncio.create_task(_run_single_agent(a, prompt, queue, project_id))
        for a in targets
    ]

    # Each agent produces 2 events (status + result/error)
    expected = len(targets) * 2
    received = 0
    while received < expected:
        event = await queue.get()
        yield event
        received += 1

    await asyncio.gather(*tasks, return_exceptions=True)
    yield {"type": "done"}
