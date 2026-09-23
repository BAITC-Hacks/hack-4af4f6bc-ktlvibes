from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


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


class UserCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["business", "team"]
    name: str = Field(min_length=1)
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)
    interests: str = ""
    skills: str = ""
    technologies: str = ""


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["business", "team"] | None = None
    name: str | None = None
    email: str | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    interests: str | None = None
    skills: str | None = None
    technologies: str | None = None


class LoginRequest(BaseModel):
    email: str = Field(max_length=320)
    password: str = Field(max_length=128)
