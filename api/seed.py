from sqlmodel import Session, select

from app.db import create_schema, engine
from app.models import Business, Proposal, Task, Team, now
from app.rating import score_task
from app.serializers import card_data
from demo_data import BUSINESS_NAMES, PROPOSAL, PUBLISHED_TASKS, TEAM_NAMES


def seed(session: Session) -> None:
    for name in BUSINESS_NAMES:
        if not session.exec(select(Business).where(Business.name == name)).first():
            session.add(Business(name=name))
    for name in TEAM_NAMES:
        if not session.exec(select(Team).where(Team.name == name)).first():
            session.add(Team(
                name=name,
                interests="Городские и социальные задачи",
                skills="Аналитика, разработка",
                technologies="Python, React",
            ))
    session.commit()

    businesses = {business.name: business for business in session.exec(select(Business)).all()}
    teams = {team.name: team for team in session.exec(select(Team)).all()}
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
    session.commit()


if __name__ == "__main__":
    create_schema()
    with Session(engine) as session:
        seed(session)
