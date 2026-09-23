import { test, expect } from "@playwright/test";

test("бизнес создаёт, публикует и обновляет задачу", async ({ page }) => {
  const title = `E2E задача ${Date.now()}`;
  await page.goto("/login");
  await page.getByLabel("Электронная почта").fill("demo-business-1@example.local");
  await page.getByLabel("Пароль").fill(process.env.DEMO_USER_PASSWORD ?? "demo12345");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByRole("heading", { name: "Ваши задачи" })).toBeVisible();
  await page.getByRole("link", { name: "Создать задачу" }).click();
  await page.getByLabel("Краткое описание задачи").fill("Хотим улучшить поиск заявок клиентов и сократить время обработки обращений.");
  await page.getByLabel("Тема", { exact: true }).fill("Сервис");
  await page.getByRole("button", { name: "Создать черновик и начать" }).click();
  await expect(page.getByText("Черновик создан.", { exact: false })).toBeVisible();

  await expect(page.getByLabel("Ваш ответ")).toBeVisible();
  await page.getByLabel("Ваш ответ").fill("Сотрудники службы поддержки обрабатывают заявки клиентов ежедневно.");
  await page.getByRole("button", { name: "Ответить и продолжить" }).click();
  await expect(page.getByRole("progressbar", { name: "Рейтинг готовности задачи" })).toBeVisible();
  await page.getByRole("button", { name: "Сохранить и выйти" }).click();
  await expect(page).toHaveURL(/\/business$/);
  await page.getByRole("article").filter({ hasText: "Хотим улучшить поиск заявок" }).getByRole("link", { name: "Редактировать" }).click();
  await page.getByRole("button", { name: "Продолжить вопросы" }).click();
  await expect(page.getByLabel("Ваш ответ")).toBeVisible();
  await page.getByText("Посмотреть и изменить всю карточку").click();
  await page.getByLabel("Название", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Подтвердить и опубликовать" }).click();
  await expect(page).toHaveURL(/\/tasks\/\d+$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.goto("/business");
  const task = page.getByRole("article").filter({ hasText: title });
  await expect(task).toContainText("Опубликована");
  await task.getByRole("link", { name: "Редактировать" }).click();
  await page.getByText("Посмотреть и изменить всю карточку").click();
  await page.getByLabel("Название", { exact: true }).fill(`${title} — обновлено`);
  await page.reload();
  await page.getByText("Посмотреть и изменить всю карточку").click();
  await expect(page.getByLabel("Название", { exact: true })).toHaveValue(title);
  await page.getByLabel("Название", { exact: true }).fill(`${title} — обновлено`);
  await page.getByRole("button", { name: "Подтвердить обновление" }).click();
  await expect(page.getByRole("heading", { name: `${title} — обновлено` })).toBeVisible();
  await page.goto("/tasks");
  await expect(page.getByRole("link", { name: `${title} — обновлено` })).toBeVisible();
});

test("команда видит каталог без кабинета бизнеса", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Электронная почта").fill("demo-team-6@example.local");
  await page.getByLabel("Пароль").fill(process.env.DEMO_USER_PASSWORD ?? "demo12345");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByRole("link", { name: "Кабинет бизнеса" })).toHaveCount(0);
  await page.goto("/business");
  await expect(page).toHaveURL(/\/tasks$/);
});
