from typing import Literal

from pydantic import BaseModel, Field


class Card(BaseModel):
    topic: str = ""
    title: str = ""
    context: str = ""
    need: str = ""
    users: str = ""
    dataDescription: str = ""
    dataAccess: str = ""
    constraints: str = ""
    expectedResult: str = ""
    successMetric: str = ""
    successTarget: str = ""
    contact: str = ""
    interactionFormat: str = ""


class CardRequest(BaseModel):
    card: Card


class DraftRequest(BaseModel):
    initialDescription: str = Field(min_length=1)
    topic: str = ""


class QuestionsRequest(BaseModel):
    initialDescription: str
    card: dict[str, str] = Field(default_factory=dict)


class ProposalRequest(BaseModel):
    idea: str
    plan: str
    duration: str
    prototypeUrl: str


class StatusRequest(BaseModel):
    status: Literal["selected", "rejected"]


class ProgressRequest(BaseModel):
    teamId: int
    note: str


class TeamRequest(BaseModel):
    name: str
    interests: str = ""
    skills: str = ""
    technologies: str = ""
