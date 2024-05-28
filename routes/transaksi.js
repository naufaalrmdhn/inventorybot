const express = require('express');
const route = express.Router();
const db = require('../database'); // Sesuaikan path jika diperlukan
const axios = require('axios');


// Tambahkan rute untuk halaman transaksi
route.get('/', (req, res) => {
    const query = `
        SELECT transactions.*, barang.kategori, barang.deskripsi 
        FROM transactions 
        JOIN barang ON transactions.id_barang = barang.id_barang
    `;
    
    db.query(query, (err, transactions) => {
        if (err) {
            return res.status(500).send(err.message);
        }

        // Get images for each transaction
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
                transactions: finalTransactions 
            });
        }).catch(error => {
            return res.status(500).send(error.message);
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
route.post('/:id', (req, res) => {
    const { id } = req.params;
    const { type, id_barang, jumlah, keterangan, username } = req.body;
    const query = 'UPDATE transactions SET type = ?, id_barang = ?, jumlah = ?, keterangan = ?, username = ? WHERE id = ?';

    db.query(query, [type, id_barang, jumlah, keterangan, username, id], (err) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

        // Adjust barang quantity based on transaction type
        const jumlahChange = type === 'in' ? parseInt(jumlah) : -parseInt(jumlah);
        const updateQuery = 'UPDATE barang SET jumlah = jumlah + ? WHERE id_barang = ?';

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

        // Delete the transaction
        db.query('DELETE FROM transactions WHERE id = ?', [id], (deleteErr) => {
            if (deleteErr) {
                console.error('Error executing query:', deleteErr);
                res.status(500).send('Internal Server Error');
                return;
            }

            // Update the stock quantity
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


module.exports = route;