from datetime import timezone

from .models import ProgressConfirmation, Proposal, Task, User
from .rating import score_task
from .schemas import Card


CARD_COLUMNS = {
    "dataDescription": "data_description",
    "dataAccess": "data_access",
    "expectedResult": "expected_result",
    "successMetric": "success_metric",
    "successTarget": "success_target",
    "interactionFormat": "interaction_format",
}


def card_data(task: Task) -> dict:
    return {key: getattr(task, CARD_COLUMNS.get(key, key)) for key in Card.model_fields}


def iso(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def task_json(task: Task) -> dict:
    return {
        "id": task.id,
        "businessId": task.business_id,
        "status": task.status,
        "initialDescription": task.initial_description,
        **card_data(task),
        "score": task.score,
        "confirmedAt": iso(task.confirmed_at),
        "createdAt": iso(task.created_at),
        "updatedAt": iso(task.updated_at),
        "rating": score_task(card_data(task)) if task.status == "published" else None,
    }


def team_json(team: User) -> dict:
    return {
        "id": team.id,
        "name": team.name,
        "interests": team.interests,
        "skills": team.skills,
        "technologies": team.technologies,
        "points": team.points,
    }


def user_json(user: User) -> dict:
    return {"role": user.role, "email": user.email, **team_json(user)}


def proposal_json(proposal: Proposal, team: User) -> dict:
    return {
        "id": proposal.id,
        "taskId": proposal.task_id,
        "teamId": proposal.team_id,
        "teamName": team.name,
        "idea": proposal.idea,
        "plan": proposal.plan,
        "duration": proposal.duration,
        "prototypeUrl": proposal.prototype_url,
        "status": proposal.status,
        "createdAt": iso(proposal.created_at),
    }


def progress_json(progress: ProgressConfirmation) -> dict:
    return {
        "id": progress.id,
        "taskId": progress.task_id,
        "teamId": progress.team_id,
        "note": progress.note,
        "points": progress.points,
        "confirmedAt": iso(progress.confirmed_at),
    }
