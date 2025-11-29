const config = require('./Config/AppConfig');
const GoogleCalendarService = require('./Services/GoogleCalendarService');
const RoomController = require('./Controllers/RoomController');
const express = require('express')
const app = express()
const port = 3000

function startApp() {
    try {
        console.log("Memulai inisialisasi aplikasi...");

        // 1. Inisialisasi Google Calendar Service (Helper/Service Layer)
        const calendarService = new GoogleCalendarService(
            config, 
            config.ROOMS, 
            config.TIME_SLOTS
        );

        // 2. Inisialisasi Telegram Bot Controller
        const botController = new RoomController(
            config.TELEGRAM_BOT_TOKEN, 
            calendarService, 
            config.ROOMS, 
            config.TIME_SLOTS
        );

        console.log("Aplikasi Telegram Bot telah berjalan dan siap untuk polling.");

    } catch (error) {
        console.error("Gagal memulai aplikasi:", error.message);
        process.exit(1);
    }
}

app.get('/', (req, res) => {
  res.send('Aplikasi Telegram Bot telah berjalan dan siap untuk polling.')
})

app.listen(port, () => {
  startApp();
  console.log(`Example app listening on port ${port}`)
})

startApp();
