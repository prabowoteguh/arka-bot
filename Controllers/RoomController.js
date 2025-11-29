const TelegramBot = require('node-telegram-bot-api');

class RoomController {
    /**
     * @param {string} token Telegram Bot Token.
     * @param {GoogleCalendarService} calendarService Instance dari GoogleCalendarService.
     * @param {string[]} rooms Daftar nama ruangan.
     * @param {string[]} timeSlots Daftar slot waktu.
     */
    constructor(token, calendarService, rooms, timeSlots) {
        this.bot = new TelegramBot(token, { polling: true });
        this.calendarService = calendarService;
        this.rooms = rooms;
        this.timeSlots = timeSlots;
        this.userStates = {};

        this._setupListeners();
    }

    /**
     * Menyiapkan semua event listener untuk bot.
     */
    _setupListeners() {
        this.bot.onText(/\/start/, this._handleStart.bind(this));
        this.bot.on('callback_query', this._handleCallbackQuery.bind(this));
        this.bot.on('message', this._handleMessage.bind(this));
        console.log("Listeners bot Telegram telah disiapkan.");
    }

    // --- Handlers Utama ---
    _handleStart(msg) {
        const chatId = msg.chat.id;
        this.userStates[chatId] = { 
            step: 'start',
            name: msg.from.first_name || 'User',
            phoneNumber: msg.from.id.toString(), 
        };
        
        this.bot.sendMessage(chatId, 
            '🏢 *Selamat datang di Sistem Booking Ruangan Meeting*\n\n' +
            'Silakan pilih tanggal meeting Anda.',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '📅 Pilih Tanggal', callback_data: 'select_date' }
                    ]]
                }
            }
        );
    }

    async _handleCallbackQuery(query) {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (!this.userStates[chatId]) {
            this.bot.sendMessage(chatId, 'Sesi berakhir. Silakan ketik /start untuk memulai lagi.');
            this.bot.answerCallbackQuery(query.id);
            return;
        }

        try {
            if (data === 'select_date') {
                this._showDateSelection(chatId, query.message.message_id);
            } else if (data.startsWith('date_')) {
                this._handleDateSelection(chatId, query.message.message_id, data);
            } else if (data.startsWith('start_')) {
                this._handleStartTimeSelection(chatId, query.message.message_id, data);
            } else if (data.startsWith('end_')) {
                await this._handleEndTimeSelection(chatId, query.message.message_id, data);
            } else if (data.startsWith('book_')) {
                this._handleRoomBookingInit(chatId, data);
            }
        } catch (error) {
            console.error('Error in callback query:', error);
            this.bot.sendMessage(chatId, '❌ Terjadi kesalahan saat memproses permintaan Anda.');
        }

        this.bot.answerCallbackQuery(query.id);
    }

    async _handleMessage(msg) {
        const chatId = msg.chat.id;
        const text = msg.text;
        
        if (!this.userStates[chatId] || text.startsWith('/')) return;
        
        const state = this.userStates[chatId];
        
        if (state.step === 'enter_name') {
            state.name = text;
            state.step = 'enter_department';
            this.bot.sendMessage(chatId, '🏢 Silakan masukkan *Department/Fungsi* Anda:', 
                { parse_mode: 'Markdown' });
        }
        else if (state.step === 'enter_department') {
            state.department = text;
            state.step = 'enter_agenda';
            this.bot.sendMessage(chatId, '📋 Silakan masukkan *Agenda* meeting:', 
                { parse_mode: 'Markdown' });
        }
        else if (state.step === 'enter_agenda') {
            state.agenda = text;
            await this._createBooking(chatId, state);
        }
    }
    
    // --- Logika Navigasi UI (Private Methods) ---
    _showDateSelection(chatId, messageId) {
        this.userStates[chatId].step = 'select_date';
        
        const dateButtons = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            const dateDisplay = date.toLocaleDateString('id-ID', { 
                weekday: 'short', day: 'numeric', month: 'short' 
            });
            
            dateButtons.push([{
                text: dateDisplay,
                callback_data: `date_${dateStr}`
            }]);
        }
        
        this.bot.editMessageText('📅 *Pilih tanggal meeting:*',
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: dateButtons }
            }
        );
    }

    _handleDateSelection(chatId, messageId, data) {
        const selectedDate = data.replace('date_', '');
        this.userStates[chatId].selectedDate = selectedDate;
        this.userStates[chatId].step = 'select_start_time';
        
        const timeButtons = this.timeSlots.slice(0, -1).map((time, i) => ([{
            text: time,
            callback_data: `start_${i}`
        }]));
        
        this.bot.editMessageText(
            `📅 Tanggal: *${new Date(selectedDate).toLocaleDateString('id-ID')}*\n\n` +
            '⏰ *Pilih waktu mulai meeting:*',
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: timeButtons }
            }
        );
    }

    _handleStartTimeSelection(chatId, messageId, data) {
        const startIndex = parseInt(data.replace('start_', ''));
        const state = this.userStates[chatId];
        state.startTime = startIndex;
        state.step = 'select_end_time';
        
        const timeButtons = [];
        for (let i = startIndex + 1; i < this.timeSlots.length; i++) {
            const duration = i - startIndex;
            timeButtons.push([{
                text: `${this.timeSlots[i]} (Durasi: ${duration} jam)`,
                callback_data: `end_${i}`
            }]);
        }
        
        this.bot.editMessageText(
            `📅 Tanggal: *${new Date(state.selectedDate).toLocaleDateString('id-ID')}*\n` +
            `⏰ Mulai: *${this.timeSlots[startIndex]}*\n\n` +
            '⏰ *Pilih waktu selesai meeting:*',
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: timeButtons }
            }
        );
    }

    async _handleEndTimeSelection(chatId, messageId, data) {
        const endIndex = parseInt(data.replace('end_', ''));
        const state = this.userStates[chatId];
        state.endTime = endIndex;
        state.step = 'view_availability';
        
        await this._showAvailability(chatId, state, messageId);
    }

    _handleRoomBookingInit(chatId, data) {
        const roomIndex = parseInt(data.replace('book_', ''));
        const state = this.userStates[chatId];
        state.selectedRoom = roomIndex;
        state.step = 'enter_name';
        
        this.bot.sendMessage(chatId, 
            '✏️ Silakan masukkan *Nama* Anda:',
            { parse_mode: 'Markdown' }
        );
    }

    /**
     * Menampilkan ketersediaan ruangan (Memanggil Service).
     * Telah diubah untuk memanggil metode service baru yang lebih efisien.
     */
    async _showAvailability(chatId, state, messageId) {
        const { selectedDate, startTime, endTime } = state;
        const duration = endTime - startTime;
        
        let message = `📊 *Ketersediaan Ruangan*\n\n`;
        message += `📅 Tanggal: *${new Date(selectedDate).toLocaleDateString('id-ID')}*\n`;
        message += `⏰ Waktu: *${this.timeSlots[startTime]} - ${this.timeSlots[endTime]}*\n`;
        message += `⏱️ Durasi: *${duration} jam*\n\n`;
        
        const buttons = [];
        
        // Panggil Service untuk mendapatkan status semua ruangan dalam satu kali request
        const roomStatusMap = await this.calendarService.getRoomStatusForTimeSlot(
            selectedDate, 
            startTime, 
            endTime
        );
        
        // Loop melalui Map status ketersediaan
        for (const [room, isAvailable] of roomStatusMap.entries()) {
            const status = isAvailable ? '✅ Tersedia' : '❌ Terisi';
            message += `${status} - *${room}*\n`;
            
            if (isAvailable) {
                // Temukan index ruangan agar callback_data tetap valid
                const roomIndex = this.rooms.indexOf(room); 
                if (roomIndex !== -1) {
                    buttons.push([{
                        text: `📍 Book ${room}`,
                        callback_data: `book_${roomIndex}`
                    }]);
                }
            }
        }
        
        message += `\n💡 _Tap ruangan yang tersedia untuk booking_`;
        
        this.bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons }
        });
    }

    /**
     * Membuat booking (Memanggil Service dan memberikan feedback ke user).
     */
    async _createBooking(chatId, bookingData) {
        try {
            await this.calendarService.createBooking(bookingData); // Panggil Service

            const room = this.rooms[bookingData.selectedRoom];
            const duration = bookingData.endTime - bookingData.startTime;

            this.bot.sendMessage(chatId,
                '✅ *Booking Berhasil!*\n\n' +
                `📅 Tanggal: *${new Date(bookingData.selectedDate).toLocaleDateString('id-ID')}*\n` +
                `🏢 Ruangan: *${room}*\n` +
                `⏰ Waktu: *${this.timeSlots[bookingData.startTime]} - ${this.timeSlots[bookingData.endTime]}*\n` +
                `⏱️ Durasi: *${duration} jam*\n` +
                `👤 Nama: *${bookingData.name}*\n` +
                `🏢 Dept/Fungsi: *${bookingData.department}*\n` +
                `📋 Agenda: *${bookingData.agenda}*\n\n` +
                'Terima kasih! 🙏',
                { parse_mode: 'Markdown' }
            );
            
            delete this.userStates[chatId];

        } catch (error) {
            console.error('Error creating booking:', error);
            this.bot.sendMessage(chatId, `❌ Maaf, terjadi kesalahan saat membuat booking. Silakan coba lagi. Detail: ${error.message}`);
        }
    }
}

module.exports = RoomController;