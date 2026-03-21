import json


def sse_frame(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"
