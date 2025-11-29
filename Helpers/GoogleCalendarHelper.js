const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

class GoogleCalendarHelper {
    /**
     * @param {string} keyFilePath Path ke file kunci JSON Service Account.
     * @param {string} calendarId ID kalender target.
     * @param {string[]} scopes Daftar scope API yang diperlukan.
     */
    constructor(keyFilePath, calendarId, scopes) {
        if (!calendarId) {
            console.error("Gagal inisialisasi: GOOGLE_CALENDAR_ID tidak ditemukan. Pastikan .env terkonfigurasi.");
            throw new Error("Calendar ID is required.");
        }

        this.calendarId = calendarId;
        this.scopes = scopes || [
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/calendar.events',
        ];
        
        // 1. Inisialisasi GoogleAuth (Otentikasi)
        this.auth = new google.auth.GoogleAuth({
            keyFile: keyFilePath,
            scopes: this.scopes,
        });

        // 2. Inisialisasi Klien Calendar
        this.calendar = google.calendar({
            version: 'v3',
            auth: this.auth
        });

        console.log("Helper Kalender Google berhasil diinisialisasi.");
    }

    /**
     * Mengubah tanggal dan waktu menjadi string ISO 8601 dengan offset zona waktu.
     * @param {string} date Tanggal dalam format 'YYYY-MM-DD'.
     * @param {string} time Jam dalam format 'HH:MM'.
     * @param {string} offset Offset zona waktu, e.g., '+07:00' untuk Asia/Jakarta (WIB).
     * @returns {string} String waktu ISO 8601.
     */
    _toIsoStringWithOffset(date, time, offset = '+07:00') {
        // Gabungkan tanggal, waktu, dan offset zona waktu.
        return `${date}T${time}:00${offset}`;
    }

    /**
     * Mengecek apakah kalender tersedia dalam rentang waktu yang ditentukan.
     * @param {string} date Tanggal target dalam format 'YYYY-MM-DD'.
     * @param {string} startTime Jam mulai dalam format 'HH:MM'.
     * @param {string} endTime Jam selesai dalam format 'HH:MM'.
     * @param {string} timeZoneOffset Offset zona waktu, default '+07:00' (WIB).
     * @returns {Promise<boolean>} True jika ada bentrok (TIDAK BEBAS), False jika BEBAS.
     */
    async checkAvailability(date, startTime, endTime, timeZoneOffset = '+07:00') {
        const timeMinISO = this._toIsoStringWithOffset(date, startTime, timeZoneOffset);
        const timeMaxISO = this._toIsoStringWithOffset(date, endTime, timeZoneOffset);

        console.log(`\n========================================`);
        console.log(`[CHECK] Mencari bentrok agenda:`);
        console.log(`Mulai: ${timeMinISO}`);
        console.log(`Selesai: ${timeMaxISO}`);
        console.log(`========================================`);
        
        try {
            const response = await this.calendar.events.list({
                calendarId: this.calendarId,
                // Menggunakan Date object untuk memastikan format yang benar untuk Google API
                timeMin: new Date(timeMinISO).toISOString(), 
                timeMax: new Date(timeMaxISO).toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
            });

            const events = response.data.items;
            const isConflict = events && events.length > 0;

            if (isConflict) {
                console.log(`\n✅ Agenda ditemukan (${events.length} acara) yang bentrok:`);
                events.forEach((event, i) => {
                    const start = event.start.dateTime || event.start.date || 'N/A';
                    const end = event.end.dateTime || event.end.date || 'N/A';
                    console.log(`  ${i + 1}. Judul: ${event.summary} (${start} - ${end})`);
                });
                console.log('\nKESIMPULAN: 🔴 Waktu TIDAK BEBAS (ADA KONFLIK).');
            } else {
                console.log('\nTidak ada agenda ditemukan pada rentang waktu tersebut.');
                console.log('KESIMPULAN: 🟢 Waktu BEBAS.');
            }

            return isConflict;

        } catch (error) {
            console.error('\n❌ Terjadi kesalahan saat mengakses Google Calendar API.');
            this._handleGoogleApiError(error);
            throw error;
        }
    }

    /**
     * Membuat acara baru di Google Calendar.
     * @param {string} summary Ringkasan/Judul acara.
     * @param {string} location Lokasi fisik acara.
     * @param {string} date Tanggal acara dalam format 'YYYY-MM-DD'.
     * @param {string} startTime Jam mulai dalam format 'HH:MM'.
     * @param {string} endTime Jam selesai dalam format 'HH:MM'.
     * @param {string} timeZone Nama zona waktu, default 'Asia/Jakarta' (WIB).
     * @returns {Promise<object>} Data acara yang baru dibuat.
     */
    async createEvent(summary, location, date, startTime, endTime, timeZone = 'Asia/Jakarta') {
        const startDateTime = `${date}T${startTime}:00`;
        const endDateTime = `${date}T${endTime}:00`;

        const eventResource = {
            'summary': summary,
            'location': location,
            'description': `Acara dibuat secara otomatis melalui API Node.js.`,
            'start': { 'dateTime': startDateTime, 'timeZone': timeZone },
            'end': { 'dateTime': endDateTime, 'timeZone': timeZone },
            'reminders': {
                'useDefault': false,
                'overrides': [
                    {'method': 'email', 'minutes': 24 * 60}, // 1 hari sebelumnya
                    {'method': 'popup', 'minutes': 10},      // 10 menit sebelumnya
                ],
            },
        };

        try {
            console.log(`\n========================================`);
            console.log(`[CREATE] Mencoba membuat acara: "${summary}"`);
            console.log(`Waktu: ${startDateTime} (${timeZone})`);
            console.log(`========================================`);

            const response = await this.calendar.events.insert({
                calendarId: this.calendarId,
                resource: eventResource,
            });

            console.log(`\n✅ Acara berhasil ditambahkan!`);
            console.log(`ID Acara: ${response.data.id}`);
            console.log(`Link Google Calendar: ${response.data.htmlLink}`);
            return response.data;

        } catch (error) {
            console.error('\n❌ Terjadi kesalahan saat menambahkan acara ke Google Calendar API.');
            this._handleGoogleApiError(error);
            throw error;
        }
    }

    async listEvents() {
      try {
        // 1. Autentikasi menggunakan Service Account
        const auth = new google.auth.GoogleAuth({
          keyFile: KEY_FILE_PATH,
          scopes: SCOPES,
        });
        
        // Dapatkan instance klien terautentikasi
        const authClient = await auth.getClient();
        
        // 2. Inisialisasi klien Calendar API
        const calendar = google.calendar({
          version: 'v3',
          auth: authClient,
        });
    
        // 3. Panggil API untuk mendapatkan daftar acara
        console.log(`Mengambil 10 acara mendatang dari kalender: ${CALENDAR_ID}`);
        
        const now = new Date();
        const response = await calendar.events.list({
          calendarId: CALENDAR_ID,
          timeMin: now.toISOString(), // Acara dari waktu sekarang
          maxResults: 1, // Batasi hasilnya
          singleEvents: true,
          orderBy: 'startTime',
        });
    
        const events = response.data.items;
        
        // 4. Tampilkan hasilnya
        if (!events || events.length === 0) {
          console.log('Tidak ada acara mendatang yang ditemukan.');
          return;
        }
        
        console.log('--- Acara Mendatang ---');
        events.map((event, i) => {
          // Ambil waktu mulai, bisa berupa tanggal (untuk acara sehari penuh) atau dateTime
          const start = event.start.dateTime || event.start.date;
          console.log(`${i + 1}. ${start} - ${event.summary}`);
        });
    
      } catch (error) {
        console.error('Terjadi kesalahan saat mengakses Google Calendar API:', error.message);
        // Tampilkan detail error jika ada
        if (error.code === 404) {
             console.error('Pesan: Kalender tidak ditemukan atau Service Account tidak memiliki izin.');
        } else if (error.code === 403) {
             console.error('Pesan: Akses ditolak. Pastikan Service Account sudah di-share ke kalender.');
        }
      }
    }

    /**
     * Fungsi utilitas untuk menangani dan menampilkan error Google API secara lebih jelas.
     * @param {Error} error Objek Error yang diterima dari API.
     */
    _handleGoogleApiError(error) {
        if (error.errors && error.errors.length > 0) {
             console.error(`Pesan Error Detail: ${error.errors[0].message}`);
             console.error(`Kode Status: ${error.code || error.status}`);
             if (error.code === 403) {
                console.error('TIPS: Pastikan Service Account memiliki izin yang memadai (Editor/Owner) pada kalender ini.');
             }
        } else {
            console.error(`Pesan Error Umum: ${error.message}`);
        }
    }
}

// --- Konfigurasi dan Penggunaan Contoh (Simulasi Controller) ---

// Konstanta Konfigurasi
const KEY_FILE_PATH = path.join(__dirname, 'Config/google-config.json'); 
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

module.exports = GoogleCalendarHelper;