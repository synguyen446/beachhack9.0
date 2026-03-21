from typing import Optional

from pydantic import BaseModel


# -- Request/Response schemas --------------------------------------------------

class GenerateRequest(BaseModel):
    idea: str
    agent: str  # one of the 8 names or "all"
    project_id: Optional[int] = None


class ChatRequest(BaseModel):
    project_id: int
    message: str


# -- Agent output schemas ------------------------------------------------------

class ArchitectureReport(BaseModel):
    executive_summary: list[str]
    recommended_architecture: str
    cloud_infrastructure: str
    dev_tooling: str
    ai_llm_stack: str
    language_and_framework: str
    further_investigation: list[str]
    sources: list[str]


class ProjectOverviewDoc(BaseModel):
    project_name: str
    name_rationale: str
    what_is_this: str
    problem_statement: str
    target_users: list[str]
    key_features: list[str]
    positioning: str


class RequirementsDoc(BaseModel):
    functional_requirements: dict[str, list[str]]  # {area: ["FR-001: ..."]}
    non_functional_requirements: list[str]
    constraints: list[str]
    assumptions: list[str]
    out_of_scope: list[str]


class UserStoriesDoc(BaseModel):
    personas: list[str]
    epics: list[str]
    user_stories: list[str]


class SystemArchitectureDoc(BaseModel):
    architecture_style: str
    component_diagram: str
    components: list[str]
    data_flow: list[str]
    tech_stack: list[str]
    scalability_notes: str
    trade_offs: list[str]


class ApiSpecDoc(BaseModel):
    auth_method: str
    base_url: str
    error_format: str
    endpoints: list[str]


class DataModelDoc(BaseModel):
    database_recommendation: str
    entities: list[str]
    relationships: list[str]
    er_diagram: str
    indexes: list[str]
    data_integrity_notes: str


class DevOpsDoc(BaseModel):
    cicd_platform: str
    pipeline_stages: list[str]
    containerization: str
    infrastructure: str
    environments: list[str]
    deployment_strategy: str
    secrets_management: str
    monitoring: str
    rollback_strategy: str


class TestingStrategyDoc(BaseModel):
    philosophy: str
    pyramid: list[str]
    unit_testing: str
    integration_testing: str
    e2e_scenarios: list[str]
    performance_testing: str
    security_testing: str
    test_data_management: str
    quality_gates: list[str]
