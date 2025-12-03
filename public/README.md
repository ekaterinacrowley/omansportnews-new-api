README — Как публиковать сайт (файлы из `public`) и запускать `server.js`

Кратко
------
Проект отдаёт статические файлы из папки `public` и запускает Node-сервер `server.js`, который также выступает как прокси для внешних API. В папке `public` уже находятся собранные и готовые к публикации файлы.

Подготовка
----------
Файлы `index.html`, `i18n/translations.json`, `main.js`, `styles.css`, `images/` и т.д. уже находятся в папке `public` вместе с `server.js`.


Развёртывание на VPS (Ubuntu) + systemd + Nginx

Скопируйте всю папку public на сервер, например в /var/www/onesporst:

bash
sudo mkdir -p /var/www/onesporst
sudo chown $USER:$USER /var/www/onesporst
cd /var/www/onesporst
# скопируйте сюда все файлы из папки public (server.js, index.html, css, js, images, i18n и т.д.)
Установите зависимости Node.js (если требуется):

bash
npm ci
Поместите .env в /var/www/onesporst (как выше).

Создайте systemd unit /etc/systemd/system/onesporst.service:

ini
[Unit]
Description=onesporst Node app
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/onesporst
EnvironmentFile=/var/www/onesporst/.env
ExecStart=/usr/bin/node /var/www/onesporst/server.js
Restart=always
User=www-data
Group=www-data
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
Запустите сервис:

bash
sudo systemctl daemon-reload
sudo systemctl enable onesporst
sudo systemctl start onesporst
sudo journalctl -u onesporst -f

Настройте Nginx как реверс-прокси (пример /etc/nginx/sites-available/onesporst):

nginx
server {
    listen 80;
    server_name your-domain.tld;

    location / {
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   Host      $host;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_pass         http://127.0.0.1:5000;
    }
}
Docker

Пример Dockerfile:

dockerfile
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Копируем все файлы из папки public
COPY public/ ./

RUN npm ci --omit=dev

EXPOSE 5000
CMD ["node", "server.js"]
Сборка и запуск:

bash
docker build -t onesporst:latest .
docker run -d -p 5000:5000 --env-file .env --name onesporst onesporst:latest
PaaS (Heroku/Render/Railway)

В настройках платформы укажите:

Build command: (не требуется, файлы уже собраны)

Start command: cd public && node server.js

Корневая директория: public

Добавьте переменные окружения (API_KEY, CRICKET_API_KEY, NEWS_API_KEY).

Проверки после деплоя

В браузере откройте http://your-domain/ — страница должна отдаваться.

В DevTools → Network проверьте, что i18n/translations.json загружается по https://your-domain/i18n/translations.json.

Логи Node покажут ошибки API или проблемы с чтением файлов (journalctl -u onesporst -f, pm2 logs, docker logs -f).

Типичные проблемы

Если перевод не грузится — убедитесь, что i18n/translations.json доступен по ожидаемому URL и что файлы лежат в папке public.

Если API возвращает 401/403 — проверьте переменные окружения.

Права на файлы — убедитесь, что пользователь сервиса имеет доступ к файлам в папке public.

Полезные команды

bash
# Запуск локально из папки public
cd public
node server.js

# Docker (локально)
docker build -t onesporst:latest .
docker run -d -p 5000:5000 --env-file .env --name onesporst onesporst:latest

# Просмотр логов systemd
sudo journalctl -u onesporst -f