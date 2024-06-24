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
    const username = msg.from.username; // Dapatkan nama pengguna

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

            const categories = results.map(row => ({ text: row.kategori, callback_data: `category_${row.kategori}` }));
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
        const category = callbackQuery.data.split('_')[1];
        user.category = category;
        user.step = 'chooseItem';


        // Retrieve items based on category
        db.query('SELECT id_barang, deskripsi FROM barang WHERE kategori = ?', [category], (err, results) => {
            if (err) {
                console.error('Error executing query:', err);
                return;
            }

            // Check if there are items available
            if (results.length === 0) {
                bot.sendMessage(chatId, `Tidak ada item yang tersedia pada kategori ini (${category}). Silahkan pilih kategori lain.`);
                return;
            }

            const items = results.map(row => ({ text: row.deskripsi, callback_data: `item_${row.id_barang}` }));
            const options = {
                reply_markup: {
                    inline_keyboard: items.map(item => [item])
                }
            };

            bot.sendMessage(chatId, `Kamu memilih kategori ${category}. Silahkan pilih item yang tersedia:`, options);
        });
    }
    else if (user.step === 'chooseItem') {
        const itemId = callbackQuery.data.split('_')[1];
        user.itemId = itemId;

        // If type is 'out', check if the selected item is available
        if (user.type === 'out') {
            db.query('SELECT deskripsi FROM barang WHERE id_barang = ?', [itemId], (err, results) => {
                if (err) {
                    console.error('Error executing query:', err);
                    return;
                }

                const quantity = results[0].jumlah;
                const description = results[0].deskripsi; 

                if (quantity <= 0) {
                    bot.sendMessage(chatId, `Item yang di pilih tidak tersedia. Pilih item yang lain.`);
                    return;
                }

                user.step = 'enterQuantity';
                user.availableQuantity = quantity; // Store available quantity
                const formattedMessage = `Kamu memilih item: *${description}*\n\nSilahakan pilih jumlah dan keterangan lokasi & tujuan\ncontoh:  10, faasri ke basecamp`;
                bot.sendMessage(chatId, formattedMessage, { parse_mode: 'Markdown' });
            });
        } else if(user.type === 'in') {
            
            db.query('SELECT deskripsi FROM barang WHERE id_barang = ?', [itemId], (err, results) => {
                if (err) {
                    console.error('Error executing query:', err);
                    return;
                }

                const quantity = results[0].jumlah;
                const description = results[0].deskripsi; 

                user.step = 'enterQuantity';
                user.availableQuantity = quantity; // Store available quantity
                const formattedMessage = `Kamu memilih item: *${description}*\n\nSilahakan pilih jumlah dan keterangan lokasi & tujuan\ncontoh:  10, faasri ke basecamp`;
                bot.sendMessage(chatId, formattedMessage, { parse_mode: 'Markdown' });
            });
        }
    }
});


bot.on('message', (msg) => {
    const chatId = msg.chat.id;

    if (!users[chatId]) return;

    const user = users[chatId];

    if (user.step === 'enterQuantity') {
        const [quantity, keterangan] = msg.text.split(',').map(s => s.trim());
        const type = user.type;
        
        const parsedQuantity = parseInt(quantity);

        // Check if quantity is valid (not 0 or empty)
        if (parsedQuantity === 0 || isNaN(parsedQuantity)) {
            bot.sendMessage(chatId, 'Invalid quantity. Please enter a valid quantity.');
            return;
        }

        // For 'out' transactions, check if the quantity is available
        if (type === 'out' && parsedQuantity > user.availableQuantity) {
            bot.sendMessage(chatId, `Insufficient quantity available. You can only remove up to ${user.availableQuantity}.`);
            return;
        }

        // Store the quantity and keterangan in user object for later use
        user.quantity = parsedQuantity;
        user.keterangan = keterangan;

        // Get item details including description from barang table
        db.query('SELECT deskripsi FROM barang WHERE id_barang = ?', [user.itemId], (err, results) => {
            if (err) {
                console.error('Error executing query:', err);
                return;
            }

            const description = results[0].deskripsi; // Get the description of the selected item
            user.description = description;

            user.step = 'uploadImages';
            bot.sendMessage(chatId, 'Please upload images for the item (send up to 3 images):');
        });
    } else if (user.step === 'uploadImages') {
        if (msg.photo) {
            if (!user.images) {
                user.images = [];
            }

            user.images.push(msg.photo[msg.photo.length - 1].file_id); // Save the file_id of the highest resolution photo

            if (user.images.length < 3) {
                bot.sendMessage(chatId, 'You can send more images, or type "done" to finish:');
            } else {
                bot.sendMessage(chatId, 'You have uploaded the maximum number of images. Type "done" to finish:');
            }
        } else if (msg.text.toLowerCase() === 'done') {
            const type = user.type;
            const quantity = user.quantity;
            const description = user.description;
            const keterangan = user.keterangan;
            const images = user.images;

            // Insert transaction into database with user information
            const query = 'INSERT INTO transactions (type, id_barang, jumlah, deskripsi, keterangan, username) VALUES (?, ?, ?, ?, ?, ?)';
            db.query(query, [type, user.itemId, quantity, description, keterangan, user.username], (err, result) => {
                if (err) {
                    console.error('Error executing query:', err);
                    return;
                }

                const transactionId = result.insertId; // Get the inserted transaction ID

                // Insert images into the images table
                if (images && images.length > 0) {
                    const imageQuery = 'INSERT INTO images (transaction_id, file_id) VALUES ?';
                    const imageValues = images.map(fileId => [transactionId, fileId]);
                    db.query(imageQuery, [imageValues], (imageErr) => {
                        if (imageErr) {
                            console.error('Error inserting images:', imageErr);
                            return;
                        }
                    });
                }

                // Update quantity in barang table
                const updateQuery = 'UPDATE barang SET jumlah = jumlah + ? WHERE id_barang = ?';
                const jumlahChange = type === 'in' ? quantity : -quantity;
                db.query(updateQuery, [jumlahChange, user.itemId], (updateErr) => {
                    if (updateErr) {
                        console.error('Error updating barang quantity:', updateErr);
                        return;
                    }

                    // Format the message nicely with bold text and include description
                    const typeEmoji = user.type === 'out' ? '🟥' : '🟩';
                    const formattedMessage = `Transaksi Tersimpan!\n\nType: ${typeEmoji} *${user.type}* ${typeEmoji}\nQuantity: *${quantity}*\nDescription: *${description}*\nLokasi & Tujuan barang: *${keterangan}*\n\nDi input oleh: *${user.username}*`;
                    bot.sendMessage(chatId, formattedMessage, { parse_mode: 'Markdown' });
                    delete users[chatId]; // Clear user data after transaction
                });
            });
        } else {
            bot.sendMessage(chatId, 'Please upload a valid image or type "done" to finish.');
        }
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