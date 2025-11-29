const config = require('./Config/AppConfig');
const GoogleCalendarService = require('./Services/GoogleCalendarService');
const RoomController = require('./Controllers/RoomController');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();

// Middleware untuk mem-parsing body JSON (penting untuk Webhook Telegram)
app.use(bodyParser.json());

// Inisialisasi Layanan dan Controller secara Global (di luar handler)
let calendarService;
let botController;

try {
    console.log("Memulai inisialisasi layanan aplikasi...");

    // 1. Inisialisasi Google Calendar Service (Helper/Service Layer)
    calendarService = new GoogleCalendarService(
        config, 
        config.ROOMS, 
        config.TIME_SLOTS
    );

    // 2. Inisialisasi Telegram Bot Controller (MODE WEBHOOK)
    // Karena menggunakan Webhook, kita tidak memanggil .startPolling()
    botController = new RoomController(
        config.GOOGLE_BOT_TOKEN, 
        calendarService, 
        config.ROOMS, 
        config.TIME_SLOTS,
        { webHook: true } // Mengaktifkan mode Webhook di Controller
    );

    console.log("Layanan aplikasi berhasil diinisialisasi.");

} catch (error) {
    console.error("Gagal menginisialisasi layanan aplikasi:", error.message);
    // Di lingkungan serverless, error di luar handler tidak menghentikan proses, 
    // tetapi kita harus memastikan bahwa variabel di atas terdefinisi (atau gagal).
}

// -----------------------------------------------------
// 1. Endpoint Root (Health Check Vercel)
// -----------------------------------------------------
app.get('/', (req, res) => {
  res.status(200).send('Aplikasi Telegram Bot Web Server berjalan.');
});

// -----------------------------------------------------
// 2. Endpoint Webhook Telegram (Penting untuk Vercel)
// -----------------------------------------------------
app.post(`/${config.TELEGRAM_BOT_TOKEN}`, (req, res) => {
    // Meneruskan update dari Telegram ke botController
    if (botController && req.body) {
        // Proses update bot secara manual
        botController.processUpdate(req.body); 
    }
    
    // Harus merespons dengan cepat (biasanya 200 OK) ke Telegram agar tidak ada retry.
    res.status(200).send('OK'); 
});

// Mengekspor aplikasi Express sebagai fungsi handler serverless
module.exports = app;

// Catatan: app.listen dihapus karena Vercel menangani servernya sendiri