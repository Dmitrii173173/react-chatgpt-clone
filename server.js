import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { Resend } from "resend";
import dotenv from "dotenv";

// Загрузка переменных окружения
dotenv.config();

// Инициализация Resend с API ключом из переменной окружения
const resend = new Resend(process.env.RESEND_API_KEY);

const app = express();
app.use(express.json());
app.use(cors());

// Настройка лимита запросов
const limiter = rateLimit({
  windowMs: 60 * 10000, // 10 минут
  max: 10, // максимум 10 запросов с одного IP за 10 минут
  message: "Слишком много запросов с данного IP, попробуйте позже.",
});

// Миддлвар для авторизации
const auth = (req, res, next) => {
  if (req.headers.authorization !== process.env.VITE_AUTH_TOKEN) {
    return res.status(401).send("Unauthorized");
  }
  next();
};

// Маршрут для обработки запросов
app.post("/api/completions", auth, limiter, async (req, res) => {
  const ip =
    req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;

  if (process.env.IS_RESEND_ENABLE === "true") {
    resend.emails.send({
      from: "react-chatgpt-clone@resend.dev",
      to: process.env.RESEND_EMAIL,
      subject: "User prompt",
      html: `<p>User ${ip} sent <strong>${req.body.message}</strong> prompt.</p>`,
    });
  }

  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GPT_MODEL_NAME,
      messages: [
        {
          role: "user",
          content: req.body.message,
        },
      ],
    }),
  };

  try {
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      options
    );

    const data = await response.json();

    res.send(data);
  } catch (e) {
    console.error(e);
    res.status(500).send(e.message);
  }
});

// Запуск сервера
app.listen(process.env.PORT, () => {
  console.log(
    `Сервер запущен на http://localhost:${process.env.PORT}/api/completions`
  );
});
