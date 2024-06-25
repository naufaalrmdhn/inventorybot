const express = require('express');
const app = express();
const path = require('path');
const route = require('./routes/route');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const upload = require('express-fileupload');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const bcrypt = require('bcrypt');
const salt = bcrypt.genSaltSync();
dotenv.config({ path: "./config.env" });


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'view'));
app.use(upload());

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//bot
const token = '6978756020:AAGONrVLw-dLeFTpwD2gckidA331s0UeUX4';
const bot = new TelegramBot(token, { polling: true });

app.use(express.json());
app.use(session({ resave: false, saveUninitialized: true, secret: 'nodedemo' }));
app.use(cookieParser());
app.use((req, res, next) => {
    res.locals.user = req.session.username || null;
    next();
});
app.set('layout', 'partials/layout-vertical');
app.use(expressLayouts);

app.use(express.static(__dirname + '/public'));

app.use('/', route);

const reportRouter = require('./routes/report');
app.use('/', reportRouter);


const pool = require('./database')// Sesuaikan path jika diperlukan
const db = require('./database')// Sesuaikan path jika diperlukan
// Konfigurasi session
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
}));



// Routes
const dashboardRoute = require('./routes/dashboard');
app.use('/', dashboardRoute);

const profileRoute = require('./routes/profile');
app.use('/', profileRoute);


app.post('/auth-register', (req, res) => {
    const { username, email, password } = req.body;

    console.log('Received data:', { username, email, password }); // Log data yang diterima

    // Periksa apakah username atau email sudah ada di database
    let sql = 'SELECT * FROM users WHERE username = ? OR email = ?';
    pool.query(sql, [username, email], (err, results) => {
        if (err) {
            console.error('Error querying user:', err);
            return res.status(500).send('Error registering user');
        }

        if (results.length) {
            // Username atau email sudah ada
            return res.status(400).json({ success: false, message: 'Username or email already exists' });
        } else {
            // Hash password menggunakan bcrypt.hashSync
            try {
                console.log('Hashing password:', password); // Log password sebelum hashing
                const hashedPassword = bcrypt.hashSync(password, 10);
                console.log('Hashed password:', hashedPassword); // Log password setelah hashing

                let insertSql = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
                pool.query(insertSql, [username, email, hashedPassword], (err, result) => {
                    if (err) {
                        console.error('Error inserting user:', err);
                        return res.status(500).send('Error registering user');
                    }
                    return res.redirect('/auth-login');
                });
            } catch (hashError) {
                console.error('Error hashing password:', hashError);
                return res.status(500).send('Error registering user');
            }
        }
    });
});
// Route untuk handle POST request dari form login
app.post('/auth-login', (req, res) => {
    const { username, password } = req.body;

    let sql = 'SELECT * FROM users WHERE username = ?';
    pool.query(sql, [username], (err, results) => {
        if (err) {
            console.error('Error querying user:', err);
            return res.status(500).json({ success: false, message: 'Error logging in' });
        }

        if (results.length && bcrypt.compareSync(password, results[0].password)) {
            req.session.userId = results[0].id;
            req.session.username = results[0].username;
            console.log("Password match, user authenticated");
            return res.json({ success: true, redirectUrl: '/' });
        } else {
            return res.status(400).json({ success: false, message: 'Username or password incorrect' });
        }
    });
});


// Handle polling errors
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
  });

route.get('/get-image/:fileId', (req, res) => {
    const fileId = req.params.fileId;
    axios.get(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`)
        .then(response => {
            const filePath = response.data.result.file_path;
            const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
            res.redirect(fileUrl);
        })
        .catch(error => {
            console.error('Error getting file path:', error);
            res.status(500).send('Error getting file path');
        });
});
 // Handle /start command
const users = {}; // Variabel untuk melacak sesi pengguna

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username;

    bot.sendMessage(chatId, "Hallo! Pilih Tipe Transaksi Barang:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Masuk(in)', callback_data: 'in' }],
                [{ text: 'Keluar(out)', callback_data: 'out' }]
            ]
        }
    });

    users[chatId] = { step: 'chooseType', username: username };
});

bot.on('callback_query', (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const type = callbackQuery.data;

    if (!users[chatId]) return;

    const user = users[chatId];

    if (user.step === 'chooseType') {
        user.type = type;
        user.step = 'chooseCategory';

        // Retrieve categories from database
        db.query('SELECT DISTINCT kategori FROM barang', (err, results) => {
            if (err) {
                console.error('Error executing query:', err);
                return;
            }

            let categories = results.map(row => ({ text: row.kategori, callback_data: `category_${row.kategori}` }));
            categories.push({ text: 'Tambah Kategori Baru', callback_data: 'add_new_category' });

            const options = {
                reply_markup: {
                    inline_keyboard: categories.map(category => [category])
                }
            };

            bot.sendMessage(chatId, "Silahkan pilih kategori barang:", options).then(sentMessage => {
                user.previousMessageId = sentMessage.message_id;
            });
        });
    } else if (user.step === 'chooseCategory') {
        if (callbackQuery.data === 'add_new_category') {
            user.step = 'addNewCategory';
            bot.sendMessage(chatId, "Masukkan nama kategori baru:");
        } else {
            const category = callbackQuery.data.split('_')[1];
            user.category = category;
            user.step = 'chooseItem';

            // Retrieve items based on category
            db.query('SELECT id_barang, deskripsi FROM barang WHERE kategori = ?', [category], (err, results) => {
                if (err) {
                    console.error('Error executing query:', err);
                    return;
                }

                let items = results.map(row => ({ text: row.deskripsi, callback_data: `item_${row.id_barang}` }));
                if (items.length === 0) {
                    items.push({ text: 'Tidak ada barang tersedia', callback_data: 'no_item' });
                }
                items.push({ text: 'Tambah Barang Baru', callback_data: 'add_new_item' });

                const options = {
                    reply_markup: {
                        inline_keyboard: items.map(item => [item])
                    }
                };

                bot.sendMessage(chatId, `Kamu memilih kategori ${category}. Silahkan pilih item yang tersedia atau tambahkan barang baru:`, options);
            });
        }
    } else if (user.step === 'chooseItem') {
        if (callbackQuery.data === 'add_new_item') {
            user.step = 'addNewItem';
            bot.sendMessage(chatId, "Masukkan deskripsi barang baru:");
        } else if (callbackQuery.data === 'no_item') {
            bot.sendMessage(chatId, "Kategori ini tidak memiliki barang. Silahkan tambahkan barang baru.");
        } else {
            const itemId = callbackQuery.data.split('_')[1];
            user.itemId = itemId;

            db.query('SELECT deskripsi, jumlah, merk FROM barang WHERE id_barang = ?', [itemId], (err, results) => {
                if (err) {
                    console.error('Error executing query:', err);
                    return;
                }

                const quantity = results[0].jumlah;
                const description = results[0].deskripsi;
                const merk = results[0].merk;

                user.description = description;
                user.merk = merk;
                user.availableQuantity = quantity;

                if (user.type === 'out' && quantity <= 0) {
                    bot.sendMessage(chatId, `Item yang dipilih tidak tersedia. Pilih item yang lain.`);
                    return;
                }

                user.step = 'enterInfoLain';
                bot.sendMessage(chatId, 'Masukkan info lain (contoh: serial number, jika tidak ada beri tanda -):');
            });
        }
    }
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;

    if (!users[chatId]) return;

    const user = users[chatId];

    if (user.step === 'addNewCategory') {
        const newCategory = msg.text.trim();
        user.newCategory = newCategory;
        user.step = 'addNewItem';
        bot.sendMessage(chatId, `Kategori baru "${newCategory}" telah ditambahkan. Masukkan deskripsi barang baru:`);
    } else if (user.step === 'addNewItem') {
        const newItemDescription = msg.text.trim();
        user.newItemDescription = newItemDescription;
        user.step = 'addNewItemBrand';
        bot.sendMessage(chatId, "Masukkan merk barang baru:");
    } else if (user.step === 'addNewItemBrand') {
        const newItemBrand = msg.text.trim();
        user.newItemBrand = newItemBrand;

        // Make sure both description and brand are not empty
        if (!user.newItemDescription || !user.newItemBrand) {
            bot.sendMessage(chatId, "Deskripsi dan merk tidak boleh kosong. Silahkan masukkan kembali deskripsi barang baru:");
            user.step = 'addNewItem';
        } else {
            user.step = 'enterInfoLain';
            bot.sendMessage(chatId, "Masukkan info lain (contoh: serial number, jika tidak ada beri tanda -):");
        }
    } else if (user.step === 'enterInfoLain') {
        const infoLain = msg.text.trim();
        user.infoLain = infoLain;

        if (user.itemId) {
            user.step = 'enterQuantity';
            bot.sendMessage(chatId, 'Silahkan masukkan jumlah dan keterangan lokasi & tujuan\nContoh: 10, faasri ke basecamp');
        } else {
            const category = user.newCategory;
            const newItemDescription = user.newItemDescription;
            const newItemBrand = user.newItemBrand;

            // Make sure both description and brand are not empty
            if (!newItemDescription || !newItemBrand) {
                bot.sendMessage(chatId, "Deskripsi dan merk tidak boleh kosong. Silahkan masukkan kembali deskripsi barang baru:");
                user.step = 'addNewItem';
                return;
            }

            db.query('INSERT INTO barang (deskripsi, kategori, merk, jumlah) VALUES (?, ?, ?, 0)', [newItemDescription, category, newItemBrand], (err, result) => {
                if (err) {
                    console.error('Error adding new item:', err);
                    return;
                }

                const newItemId = result.insertId;
                user.itemId = newItemId;
                user.description = newItemDescription;
                user.merk = newItemBrand;
                user.step = 'enterQuantity';

                bot.sendMessage(chatId, `Barang baru "${newItemDescription}" dengan merk "${newItemBrand}" telah ditambahkan. Silahkan masukkan jumlah dan keterangan lokasi & tujuan\nContoh: 10, faasri ke basecamp`);
            });
        }
    } else if (user.step === 'enterQuantity') {
        const [quantity, keterangan] = msg.text.split(',').map(s => s.trim());
        const type = user.type;

        const parsedQuantity = parseInt(quantity);

        if (parsedQuantity === 0 || isNaN(parsedQuantity)) {
            bot.sendMessage(chatId, 'Invalid quantity. Please enter a valid quantity.');
            return;
        }

        if (type === 'out' && parsedQuantity > user.availableQuantity) {
            bot.sendMessage(chatId, `Insufficient quantity available. You can only remove up to ${user.availableQuantity}.`);
            return;
        }

        user.quantity = parsedQuantity;
        user.keterangan = keterangan;

        db.query('SELECT deskripsi, merk FROM barang WHERE id_barang = ?', [user.itemId], (err, results) => {
            if (err) {
                console.error('Error executing query:', err);
                return;
            }

            const description = results[0].deskripsi;
            const merk = results[0].merk;

            const query = 'INSERT INTO transactions (type, jumlah, deskripsi_barang, keterangan, username, info_lain, id_barang) VALUES (?, ?, ?, ?, ?, ?, ?)';
            const values = [type, parsedQuantity, description, keterangan, user.username, user.infoLain, user.itemId];

            db.query(query, values, (err) => {
                if (err) {
                    console.error('Error inserting transaction:', err);
                    return;
                }

                const updateQuery = type === 'in' ? 'UPDATE barang SET jumlah = jumlah + ? WHERE id_barang = ?' : 'UPDATE barang SET jumlah = jumlah - ? WHERE id_barang = ?';

                db.query(updateQuery, [parsedQuantity, user.itemId], (err) => {
                    if (err) {
                        console.error('Error updating item quantity:', err);
                        return;
                    }

                    const typeEmoji = type === 'out' ? '🟥' : '🟩';
                    const formattedMessage = `Transaksi Tersimpan!\n\nType: ${typeEmoji} *${type}* ${typeEmoji}\nQuantity: *${parsedQuantity}*\nDescription: *${description}*\nMerk: *${merk}*\nInfo Lain: *${user.infoLain}*\nLokasi & Tujuan barang: *${keterangan}*\n\nDi input oleh: *${user.username}*`;
                    bot.sendMessage(chatId, formattedMessage, { parse_mode: 'Markdown' });
                    delete users[chatId];
                });
            });
        });
    }
});


  
//bot
app.use((err, req, res, next) => {
    let error = { ...err }
    if (error.name === 'JsonWebTokenError') {
        err.message = "please login again";
        err.statusCode = 401;
        return res.status(401).redirect('view/login');
    }
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'errors';

    res.status(err.statusCode).json({
        status: err.status,
        message: err.message,

    })
});

const http = require("http").createServer(app);
http.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));