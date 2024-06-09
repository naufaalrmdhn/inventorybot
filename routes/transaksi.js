const express = require('express');
const route = express.Router();
const db = require('../database'); // Sesuaikan path jika diperlukan
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });


// Tambahkan rute untuk halaman transaksi
route.get('/', (req, res) => {
    const itemsPerPage = parseInt(req.query.itemsPerPage) || 10; // Jumlah item per halaman, default 10
    const page = parseInt(req.query.page) || 1; // Halaman saat ini, default halaman 1
    const offset = (page - 1) * itemsPerPage;
    const filterType = req.query.filterType || ''; // Filter type (in/out), default empty string (no filter)
    const filterDate = req.query.filterDate || ''; // Filter date, default empty string (no filter)
    const filterMonth = req.query.filterMonth || ''; // Filter month, default empty string (no filter)

    let countQuery = 'SELECT COUNT(*) AS total FROM transactions';
    let dataQuery = `
        SELECT transactions.*, barang.kategori, barang.deskripsi 
        FROM transactions 
        JOIN barang ON transactions.id_barang = barang.id_barang
        ORDER BY transactions.created_at DESC
    `;

    let queryParams = [];
    let conditions = [];

    // Apply filter type if provided
    if (filterType) {
        conditions.push('transactions.type = ?');
        queryParams.push(filterType);
    }

    // Apply filter date if provided
    if (filterDate) {
        conditions.push('DATE(transactions.created_at) = ?');
        queryParams.push(filterDate);
    }

    // Apply filter month if provided
    if (filterMonth) {
        conditions.push('MONTH(transactions.created_at) = ?');
        queryParams.push(filterMonth);
    }

    // Combine conditions to the query
    if (conditions.length > 0) {
        const whereClause = ' WHERE ' + conditions.join(' AND ');
        countQuery += whereClause;
        dataQuery += whereClause;
    }

    dataQuery += ' LIMIT ? OFFSET ?';
    queryParams.push(itemsPerPage, offset);

    // Query untuk mendapatkan total transaksi
    db.query(countQuery, queryParams.slice(0, queryParams.length - 2), (err, countResult) => {
        if (err) {
            return res.status(500).send(err.message);
        }

        const totalItems = countResult[0].total;
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        // Query untuk mendapatkan transaksi dengan limit dan offset
        db.query(dataQuery, queryParams, (err, transactions) => {
            if (err) {
                return res.status(500).send(err.message);
            }

            // Mendapatkan gambar untuk setiap transaksi
            const transactionWithImages = transactions.map(transaction => {
                return new Promise((resolve, reject) => {
                    db.query(`SELECT file_id FROM images WHERE transaction_id = ?`, [transaction.id], (imageErr, imageResults) => {
                        if (imageErr) {
                            return reject(imageErr);
                        }
                        transaction.images = imageResults;
                        resolve(transaction);
                    });
                });
            });

            Promise.all(transactionWithImages).then(finalTransactions => {
                res.render('transaksi', { 
                    title: 'List Transaksi', 
                    page_title: 'transaksi', 
                    transactions: finalTransactions,
                    itemsPerPage: itemsPerPage,
                    currentPage: page,
                    totalPages: totalPages,
                    filterType: filterType,
                    filterDate: filterDate,
                    filterMonth: filterMonth
                });
            }).catch(error => {
                return res.status(500).send(error.message);
            });
        });
    });
});


// Create a new transaction
route.post('/create', (req, res) => {
    const { type, id_barang, jumlah, keterangan, username, deskripsi } = req.body;

    const query = 'INSERT INTO transactions (type, id_barang, jumlah, keterangan, username, deskripsi) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(query, [type, id_barang, parseInt(jumlah), keterangan, username, deskripsi], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

        // Update quantity in barang table
        const updateQuery = 'UPDATE barang SET jumlah = jumlah + ? WHERE id_barang = ?';
        const jumlahChange = type === 'in' ? parseInt(jumlah) : -parseInt(jumlah);
        db.query(updateQuery, [jumlahChange, id_barang], (updateErr) => {
            if (updateErr) {
                console.error('Error updating barang quantity:', updateErr);
                res.status(500).send('Internal Server Error');
                return;
            }

            res.redirect('/transaksi');
        });
    });
});


// Update transaksi
route.post('/:id', upload.array('images', 10), (req, res) => {
    const { id } = req.params;
    const { type, keterangan, username, delete_existing_images } = req.body;
    const files = req.files;

    // Update transaction details
    const query = 'UPDATE transactions SET type = ?, keterangan = ?, username = ? WHERE id = ?';
    db.query(query, [type, keterangan, username, id], (err) => {
        if (err) {
            console.error('Error updating transaction:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (delete_existing_images) {
            db.query('DELETE FROM images WHERE transaction_id = ?', [id], (deleteErr) => {
                if (deleteErr) {
                    console.error('Error deleting images:', deleteErr);
                    return res.status(500).send('Internal Server Error');
                }

                // Proceed with uploading new images if any
                handleImageUpload(id, files, res);
            });
        } else {
            // Proceed with uploading new images if any
            handleImageUpload(id, files, res);
        }
    });
});

function handleImageUpload(transactionId, files, res) {
    if (files.length > 0) {
        const insertImages = files.map(file => {
            return new Promise((resolve, reject) => {
                const query = 'INSERT INTO images (transaction_id, file_id) VALUES (?, ?)';
                db.query(query, [transactionId, file.filename], (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                });
            });
        });

        Promise.all(insertImages)
            .then(() => {
                res.redirect('/transaksi');
            })
            .catch(err => {
                console.error('Error uploading images:', err);
                res.status(500).send('Internal Server Error');
            });
    } else {
        res.redirect('/transaksi');
    }
}


// Delete a transaction
route.post('/delete/:id', (req, res) => {
    const { id } = req.params;

    // First, get the transaction details to adjust the stock quantity
    db.query('SELECT * FROM transactions WHERE id = ?', [id], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

        if (result.length === 0) {
            res.status(404).send('Transaction not found');
            return;
        }

        const transaction = result[0];
        const jumlahChange = transaction.type === 'in' ? -transaction.jumlah : transaction.jumlah;

        // Step 1: Delete related images first
        db.query('DELETE FROM images WHERE transaction_id = ?', [id], (deleteImagesErr) => {
            if (deleteImagesErr) {
                console.error('Error deleting images:', deleteImagesErr);
                res.status(500).send('Internal Server Error');
                return;
            }

            // Step 2: Delete the transaction
            db.query('DELETE FROM transactions WHERE id = ?', [id], (deleteTransactionErr) => {
                if (deleteTransactionErr) {
                    console.error('Error deleting transaction:', deleteTransactionErr);
                    res.status(500).send('Internal Server Error');
                    return;
                }

                // Step 3: Update the stock quantity
                db.query('UPDATE barang SET jumlah = jumlah + ? WHERE id_barang = ?', [jumlahChange, transaction.id_barang], (updateErr) => {
                    if (updateErr) {
                        console.error('Error updating barang quantity:', updateErr);
                        res.status(500).send('Internal Server Error');
                        return;
                    }

                    res.redirect('/transaksi');
                });
            });
        });
    });
});





module.exports = route;