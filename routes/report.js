const express = require('express');
const router = express.Router();
const db = require('../database'); // Pastikan db.js ada di folder yang benar dan berisi koneksi ke database

router.get('/report', (req, res, next) => {
    res.render('report', {
        title: 'Transaction Report',
        page_title: 'Transaction Report',
        monthlyResults: [],
        threeMonthsResults: [],
        showMonthly: false,
        showThreeMonths: false
    });
});

router.post('/report', (req, res, next) => {
    const reportType = req.body.reportType;

    if (reportType === 'monthly') {
        db.query(`
            SELECT 
                DATE_FORMAT(t.created_at, '%Y-%m') AS month, 
                t.type, 
                COUNT(*) AS transaction_count, 
                SUM(t.jumlah) AS total_quantity,
                b.kategori AS category
            FROM 
                transactions t
            JOIN
                barang b ON t.id_barang = b.id_barang
            GROUP BY 
                DATE_FORMAT(t.created_at, '%Y-%m'), 
                t.type, 
                b.kategori
        `, (err, results) => {
            if (err) throw err;
            res.render('report', {
                title: 'Transaction Report',
                page_title: 'Transaction Report',
                monthlyResults: results,
                threeMonthsResults: [],
                showMonthly: true,
                showThreeMonths: false
            });
        });
    } else if (reportType === 'threeMonths') {
        db.query(`
            SELECT 
                DATE_FORMAT(t.created_at, '%Y-%m') AS month, 
                t.type, 
                COUNT(*) AS transaction_count, 
                SUM(t.jumlah) AS total_quantity,
                b.kategori AS category
            FROM 
                transactions t
            JOIN
                barang b ON t.id_barang = b.id_barang
            WHERE 
                t.created_at >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
            GROUP BY 
                DATE_FORMAT(t.created_at, '%Y-%m'), 
                t.type, 
                b.kategori
        `, (err, results) => {
            if (err) throw err;
            res.render('report', {
                title: 'Transaction Report',
                page_title: 'Transaction Report',
                monthlyResults: [],
                threeMonthsResults: results,
                showMonthly: false,
                showThreeMonths: true
            });
        });
    } else {
        res.redirect('/report');
    }
});


module.exports = router;