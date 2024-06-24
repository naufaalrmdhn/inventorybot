const express = require('express');
const db = require('../database'); // Sesuaikan path jika diperlukan


function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/auth-login'); // Redirect ke halaman login jika belum login
    }
    next();
}

const router = express.Router();

// Route untuk menampilkan halaman profil
router.get('/contacts-profile', requireLogin, (req, res) => {
    const username = req.session.username;

    const sql = 'SELECT username, email FROM users WHERE username = ?';

    db.query(sql, [username], (err, results) => {
        if (err) {
            console.error('Error querying user profile:', err);
            return res.status(500).send('Error retrieving user profile');
        }

        if (results.length === 0) {
            return res.status(404).send('User not found');
        }

        const userprofile = results[0];
        res.render('contacts-profile', { title: 'Profile', userprofile, user:req.session.username });
    });
});

router.post('/profile', requireLogin, (req, res) => {
    const { username, email, password } = req.body;
    const currentUsername = req.session.username;

    let sql = 'UPDATE users SET username = ?, email = ?';
    const params = [username, email];

    if (password) {
        sql += ', password = ?';
        params.push(password);
    }

    sql += ' WHERE username = ?';
    params.push(currentUsername);

    db.query(sql, params, (err, results) => {
        if (err) {
            console.error('Error updating user profile:', err);
            return res.status(500).send('Error updating user profile');
        }

        // Update session with new username if it has changed
        if (username !== currentUsername) {
            req.session.username = username;
        }

        res.redirect('/contacts-profile');
    });
});

module.exports = router