# Сквозной тест

Запустите API и web, затем в `e2e/` выполните:

```sh
npm install
npx playwright install chromium
npm test
```

По умолчанию тест открывает `http://localhost:5173`. Для другого адреса задайте `BASE_URL`. Тест создаёт новую задачу в демо базе при каждом запуске.
