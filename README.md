# hack-4af4f6bc-ktlvibes
Hackathon team repository for KTLVibes

## Backend

FastAPI lives in `api/app`, with PostgreSQL 17 for tasks, teams, proposals, and progress confirmations. The API follows [MVP_PLAN.md](MVP_PLAN.md) section 11. JSON uses camelCase. `X-Demo-Actor-Id` selects a demo business or team for role-specific routes; it is not real authentication.

Backend layout: `app/main.py` assembles the app and runs startup; `app/routes/` contains feature routes; `app/schemas.py` defines request bodies; `app/serializers.py` converts database models to contract JSON; `app/checks.py` holds shared actor and ownership checks; `app/models.py` defines tables; `app/rating.py` and `app/ai.py` implement scoring and questions. `seed.py` inserts the synthetic records defined in `demo_data.py`.

Copy `.env.example` to `.env` to set database and optional AI settings. With Docker Desktop running, use `docker compose up --build` once the frontend's `web/` and `e2e/` directories are present. To run only the backend now, use `docker compose up --build db api`; the API is at `http://localhost:8000`, with health at `/api/health` and OpenAPI at `/docs`. PostgreSQL is internal to Compose and uses a persistent named volume. `docker compose down` keeps it.

At startup, the API creates tables and idempotently seeds five businesses, five teams, five published tasks at different rating levels, five drafts, and five proposals. The first actors are **Демо бизнес** and **Демо команда**; use `/api/demo-actors` to discover their IDs. Seed also runs manually with `docker compose exec api python seed.py`.

Run `docker compose exec api pytest -q` for tests. Tests use only the separate `aisana_test` database created by `db/init/01-test-db.sql`; they reset its tables and do not touch the demo database. The init script runs when the PostgreSQL volume is first created.

The rating measures description completeness, up to 100 points. Weights are 10 each for context, need, data description, data access, success metric, constraints, and users; 15 for expected result; 5 each for success target, valid contact, and interaction format. Levels are 0–39 «черновик», 40–69 «рабочая», 70–89 «готовая», and 90–100 «приоритетная». Published tasks remain in the catalog at every level, sorted by score and then confirmation time.

Question generation uses a server-side OpenAI-compatible chat completions endpoint when `AI_API_URL` and `AI_API_KEY` are set. Prompt v1 is: “Определи недостающие или неясные сведения в описании бизнес-задачи. Верни только JSON по заданной схеме с 3–5 короткими вопросами на русском, каждый с field из разрешённого списка. Не утверждай факты о компании, клиентах, данных или сроках, которых нет во входе. Если поля заполнены, спроси о конкретике или способе проверки.” The input contains the initial description and nonempty card fields, for example `{"initialDescription":"Клиенты долго ждут ответа","card":{"topic":"Поддержка"}}`. The response must be JSON with `questions`, each containing `field` and `text`. For example, `{"questions":[{"field":"users","text":"Какие группы клиентов сталкиваются с ожиданием?"},{"field":"dataDescription","text":"Какие данные доступны?"},{"field":"successMetric","text":"Как оценить результат?"}]}`. Missing settings, timeouts, network errors, and invalid model responses use deterministic template questions marked `source: "fallback"`.
