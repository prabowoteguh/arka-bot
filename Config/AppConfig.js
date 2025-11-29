require('dotenv').config();

// --- Konfigurasi Umum ---
const SERVICE_ACCOUNT_CREDENTIALS = process.env.SERVICE_ACCOUNT_CREDENTIALS;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ; 

// Daftar ruangan yang dapat dibooking
const ROOMS = [
  'Ruang Meeting A', 'Ruang Meeting B', 'Ruang Meeting C', 'Ruang Meeting D',
  'Ruang Meeting E', 'Ruang Meeting F', 'Ruang Meeting G', 'Ruang Meeting H'
];

// Daftar slot waktu (dalam format jam HH:00)
// Slot dimulai dari index 0. Slot terakhir adalah waktu tutup (tidak bisa dipilih sebagai waktu mulai)
const TIME_SLOTS = [
    "08:00", "09:00", "10:00", "11:00", "12:00", 
    "13:00", "14:00", "15:00", "16:00", "17:00"
];

module.exports = {
    TELEGRAM_BOT_TOKEN,
    SERVICE_ACCOUNT_CREDENTIALS,
    CALENDAR_ID,
    ROOMS,
    TIME_SLOTS
};