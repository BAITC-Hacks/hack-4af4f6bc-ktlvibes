from sqlmodel import Session, select

from app.db import create_schema, engine
from app.models import Proposal, SeedState, Task, User, now
from app.rating import score_task
from app.serializers import card_data
from app.user_migration import assign_seed_credentials
from demo_data import BUSINESS_NAMES, PROPOSAL, PUBLISHED_TASKS, TEAM_NAMES


def seed(session: Session) -> None:
    if session.get(SeedState, "demo-v1"):
        return
    for name in BUSINESS_NAMES:
        if not session.exec(select(User).where(User.role == "business", User.name == name)).first():
            session.add(User(role="business", name=name))
    for name in TEAM_NAMES:
        if not session.exec(select(User).where(User.role == "team", User.name == name)).first():
            session.add(User(
                role="team",
                name=name,
                interests="Городские и социальные задачи",
                skills="Аналитика, разработка",
                technologies="Python, React",
            ))
    session.commit()
    assign_seed_credentials(session)

    businesses = {business.name: business for business in session.exec(select(User).where(User.role == "business")).all()}
    teams = {team.name: team for team in session.exec(select(User).where(User.role == "team")).all()}
    for index, (topic, title, fields) in enumerate(PUBLISHED_TASKS):
        owner = businesses[BUSINESS_NAMES[index]]
        existing = session.exec(select(Task).where(Task.business_id == owner.id, Task.initial_description == title)).first()
        if not existing:
            task = Task(
                business_id=owner.id,
                status="published",
                initial_description=title,
                topic=topic,
                title=title,
                **fields,
            )
            task.score = score_task(card_data(task))["total"]
            task.confirmed_at = now()
            session.add(task)

        draft_title = f"Демо черновик {index + 1}"
        existing_draft = session.exec(select(Task).where(
            Task.business_id == owner.id,
            Task.initial_description == draft_title,
        )).first()
        if not existing_draft:
            session.add(Task(business_id=owner.id, initial_description=draft_title, topic=topic))
    session.commit()

    published = session.exec(select(Task).where(Task.status == "published").order_by(Task.id)).all()
    for index, task in enumerate(published[:5]):
        selected_team = teams[TEAM_NAMES[index]]
        existing = session.exec(select(Proposal).where(
            Proposal.task_id == task.id,
            Proposal.team_id == selected_team.id,
        )).first()
        if not existing:
            session.add(Proposal(task_id=task.id, team_id=selected_team.id, **PROPOSAL))
    session.add(SeedState(key="demo-v1"))
    session.commit()


if __name__ == "__main__":
    create_schema()
    with Session(engine) as session:
        seed(session)
