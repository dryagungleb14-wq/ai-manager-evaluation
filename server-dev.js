import express from "express";
import { createServer } from "http";

const app = express();
app.use(express.json());

// Простые маршруты для демонстрации
app.get("/api/stats", (req, res) => {
  // Моковые данные для демонстрации
  const stats = {
    totalAnalyses: 15,
    callAnalyses: 12,
    correspondenceAnalyses: 3,
    languageStats: {
      ru: 14,
      en: 1
    },
    managerStats: {
      "1": 5,
      "2": 4,
      "3": 3,
      "4": 2,
      "5": 1
    },
    overallAvgScore: 0.78,
    recentAnalyses: 8,
    lastUpdated: new Date().toISOString()
  };
  
  res.json(stats);
});

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "AI Manager Evaluation API работает!",
    timestamp: new Date().toISOString()
  });
});

// Простой HTML для тестирования
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>AI Manager Evaluation - Локальная разработка</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        .feature { background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .api-test { background: #e8f4fd; padding: 15px; margin: 10px 0; border-radius: 5px; }
        button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
        button:hover { background: #0056b3; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 AI Manager Evaluation - Локальная разработка</h1>
        
        <div class="feature">
          <h2>✨ Новая функция: Статистика анализов</h2>
          <p>Добавлен новый API endpoint <code>/api/stats</code> для получения статистики по всем анализам.</p>
          
          <div class="api-test">
            <h3>Тестирование API</h3>
            <button onclick="testStats()">Получить статистику</button>
            <button onclick="testHealth()">Проверить здоровье API</button>
            <div id="result"></div>
          </div>
        </div>
        
        <div class="feature">
          <h2>📊 Что показывает статистика:</h2>
          <ul>
            <li>Общее количество анализов</li>
            <li>Количество звонков vs переписки</li>
            <li>Статистика по языкам</li>
            <li>Статистика по менеджерам</li>
            <li>Средний балл по чек-листам</li>
            <li>Анализы за последние 30 дней</li>
          </ul>
        </div>
      </div>
      
      <script>
        async function testStats() {
          try {
            const response = await fetch('/api/stats');
            const data = await response.json();
            document.getElementById('result').innerHTML = '<h4>Статистика:</h4><pre>' + JSON.stringify(data, null, 2) + '</pre>';
          } catch (error) {
            document.getElementById('result').innerHTML = '<p style="color: red;">Ошибка: ' + error.message + '</p>';
          }
        }
        
        async function testHealth() {
          try {
            const response = await fetch('/api/health');
            const data = await response.json();
            document.getElementById('result').innerHTML = '<h4>Статус API:</h4><pre>' + JSON.stringify(data, null, 2) + '</pre>';
          } catch (error) {
            document.getElementById('result').innerHTML = '<p style="color: red;">Ошибка: ' + error.message + '</p>';
          }
        }
      </script>
    </body>
    </html>
  `);
});

const port = parseInt(process.env.PORT || '3000', 10);
const server = createServer(app);

server.listen(port, () => {
  console.log(`🚀 Сервер запущен на порту ${port}`);
  console.log(`📊 Откройте http://localhost:${port} для тестирования`);
  console.log(`🔗 API статистики: http://localhost:${port}/api/stats`);
});
