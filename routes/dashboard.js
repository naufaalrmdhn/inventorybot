const express = require('express');
const db = require('../database'); // Sesuaikan path jika diperlukan


function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/auth-login'); // Redirect ke halaman login jika belum login
    }
    next();
}

const router = express.Router();

router.get('/', requireLogin, (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set waktu ke awal hari ini

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // Set waktu ke awal hari besok

    const sqlTransactionsToday = `
        SELECT 
            SUM(CASE WHEN type = 'in' THEN jumlah ELSE 0 END) AS totalTransactionsInToday,
            SUM(CASE WHEN type = 'out' THEN jumlah ELSE 0 END) AS totalTransactionsOutToday
        FROM transactions 
        WHERE created_at >= ? AND created_at < ?`;

    const sqlItems = `SELECT SUM(jumlah) AS totalItems FROM barang`;

    const sqlMostQuantityItem = `
        SELECT deskripsi, SUM(jumlah) AS totalQuantity 
        FROM barang 
        GROUP BY deskripsi 
        ORDER BY totalQuantity DESC 
        LIMIT 1`;

    const sqlLastTransactions = `
        SELECT type, deskripsi_barang, jumlah, keterangan, username, created_at
        FROM transactions
        ORDER BY created_at DESC
        LIMIT 5`;

    db.query(sqlTransactionsToday, [today, tomorrow], (errTransactionsToday, resultsTransactionsToday) => {
        if (errTransactionsToday) {
            console.error('Error querying total transactions today:', errTransactionsToday);
            return res.status(500).send('Error retrieving total transactions today');
        }

        const totalTransactionsIn = resultsTransactionsToday[0].totalTransactionsInToday || 0;
        const totalTransactionsOut = resultsTransactionsToday[0].totalTransactionsOutToday || 0;

        db.query(sqlItems, (errItems, resultsItems) => {
            if (errItems) {
                console.error('Error querying total items:', errItems);
                return res.status(500).send('Error retrieving total items');
            }

            const totalItems = resultsItems[0].totalItems || 0;

            db.query(sqlMostQuantityItem, (errMostQuantityItem, resultsMostQuantityItem) => {
                if (errMostQuantityItem) {
                    console.error('Error querying most quantity item:', errMostQuantityItem);
                    return res.status(500).send('Error retrieving most quantity item');
                }

                const mostQuantityItem = resultsMostQuantityItem[0] ? resultsMostQuantityItem[0].deskripsi: 'Tidak ada barang';
                const mostQuantityItemTotal = resultsMostQuantityItem[0] ? resultsMostQuantityItem[0].totalQuantity : 0;

                db.query(sqlLastTransactions, (errLastTransactions, resultsLastTransactions) => {
                    if (errLastTransactions) {
                        console.error('Error querying last transactions:', errLastTransactions);
                        return res.status(500).send('Error retrieving last transactions');
                    }

                    res.render('index', {
                        title: 'Dashboard',
                        page_title: 'Dashboard',
                        totalTransactionsIn,
                        totalTransactionsOut,
                        totalItems,
                        user: req.session.username,
                        mostQuantityItem,
                        mostQuantityItemTotal,
                        lastTransactions: resultsLastTransactions
                    });
                });
            });
        });
    });
});


module.exports = router;
