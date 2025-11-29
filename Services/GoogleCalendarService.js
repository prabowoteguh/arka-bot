const { google } = require('googleapis');
const CALENDAR_SCOPES = [
    'https://www.googleapis.com/auth/calendar'
];

class GoogleCalendarService {
    /**
     * @param {object} config Objek konfigurasi yang berisi SERVICE_ACCOUNT_CREDENTIALS (JSON key), dan ID Kalender.
     * @param {string[]} rooms Daftar nama ruangan.
     * @param {string[]} timeSlots Daftar slot waktu.
     */
    constructor(config, rooms, timeSlots) {
        this.SERVICE_ACCOUNT_CREDENTIALS = config.SERVICE_ACCOUNT_CREDENTIALS;
        this.CALENDAR_ID = config.CALENDAR_ID || 'primary';
        this.rooms = rooms;
        this.timeSlots = timeSlots;

        // Pastikan kredensial Service Account tersedia
        if (!this.SERVICE_ACCOUNT_CREDENTIALS) {
            throw new Error("Service Account credentials (SERVICE_ACCOUNT_CREDENTIALS) are required in the config.");
        }
        
        // 1. Inisialisasi GoogleAuth dengan kredensial Service Account
        this.auth = new google.auth.GoogleAuth({
            credentials: this.SERVICE_ACCOUNT_CREDENTIALS,
            scopes: CALENDAR_SCOPES,
        });

        // 2. Inisialisasi Google Calendar API Client
        this.calendar = google.calendar({ version: 'v3', auth: this.auth });
        console.log("Google Calendar Service diinisialisasi menggunakan GoogleAuth (Service Account).");
    }

    /**
     * Mengubah indeks slot waktu menjadi objek Date yang valid.
     */
    _getDateTimeFromSlot(date, slotIndex) {
        const dateTime = new Date(date);
        const [hours] = this.timeSlots[slotIndex].split(':').map(Number);
        // Set waktu ke HH:00:00.000
        dateTime.setHours(hours, 0, 0, 0); 
        return dateTime;
    }

    /**
     * Mendapatkan status ketersediaan semua ruangan untuk slot waktu yang diminta.
     * Menggunakan calendar.events.list dari googleapis.
     * * @param {string} date Tanggal acara (YYYY-MM-DD).
     * @param {number} startIndex Index waktu mulai.
     * @param {number} endIndex Index waktu selesai.
     * @returns {Promise<Map<string, boolean>>} Map ruangan ke status ketersediaan (true=Tersedia, false=Terisi).
     */
    async getRoomStatusForTimeSlot(date, startIndex, endIndex) {
        const startTime = this._getDateTimeFromSlot(date, startIndex);
        const endTime = this._getDateTimeFromSlot(date, endIndex);
        
        // Inisialisasi semua ruangan sebagai tersedia
        const roomStatus = new Map(this.rooms.map(room => [room, true]));

        try {
            const response = await this.calendar.events.list({
                calendarId: this.CALENDAR_ID,
                timeMin: startTime.toISOString(),
                timeMax: endTime.toISOString(),
                singleEvents: true,
                maxResults: 250, // Batas maksimal hasil
            });
            
            // Ambil events dari response data
            const events = response.data.items || [];

            // Proses setiap event untuk menandai ruangan yang terisi
            for (const event of events) {
                // Gunakan event.location jika ada, atau cek di summary
                const occupiedLocation = event.location || event.summary;

                if (!occupiedLocation) continue;

                // Cek apakah lokasi atau summary mengandung salah satu nama ruangan yang kita miliki
                for (const room of this.rooms) {
                    if (occupiedLocation.toLowerCase().includes(room.toLowerCase())) {
                        // Tandai ruangan ini sebagai terisi
                        roomStatus.set(room, false); 
                        // Jika sudah ditemukan, tidak perlu cek nama ruangan lain dalam event yang sama
                        break; 
                    }
                }
            }
            
            return roomStatus;
            
        } catch (error) {
            console.error('Error getting room status using googleapis:', error.message);
            // Pada kasus error, kembalikan semua sebagai tersedia agar tidak ada user yang terblok
            return new Map(this.rooms.map(room => [room, true]));
        }
    }

    /**
     * Membuat acara booking baru di Google Calendar.
     * Menggunakan calendar.events.insert dari googleapis.
     */
    async createBooking(bookingData) {
        const room = this.rooms[bookingData.selectedRoom];
        
        const startTime = this._getDateTimeFromSlot(bookingData.selectedDate, bookingData.startTime);
        const endTime = this._getDateTimeFromSlot(bookingData.selectedDate, bookingData.endTime);
        
        const event = {
            summary: `${room} - ${bookingData.name}`,
            description: 
                `Nama: ${bookingData.name}\n` +
                `Department/Fungsi: ${bookingData.department}\n` +
                `Agenda: ${bookingData.agenda}\n` +
                `No. HP: ${bookingData.phoneNumber}`,
            start: {
                dateTime: startTime.toISOString(),
                timeZone: 'Asia/Jakarta'
            },
            end: {
                dateTime: endTime.toISOString(),
                timeZone: 'Asia/Jakarta'
            },
            location: room
        };
        
        try {
             await this.calendar.events.insert({
                calendarId: this.CALENDAR_ID,
                resource: event,
            });
        } catch (error) {
            console.error('Gagal membuat booking menggunakan googleapis:', error);
            // Tangkap error spesifik dari API dan lemparkan error yang lebih deskriptif
            throw new Error(`Gagal membuat booking: ${error.message || 'Error API tidak diketahui'}`);
        }
    }
}

module.exports = GoogleCalendarService;