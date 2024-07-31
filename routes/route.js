const express = require('express');
const route = express.Router();
const db = require('../database'); // Sesuaikan path jika diperlukan

//report rute
const report = require('./report');
route.use('/report', report);
    

// Route untuk menampilkan halaman barang
route.get('/barang', (req, res, next) => {
    db.query(`SELECT * FROM barang ORDER BY id_barang DESC`, (err, results) => {
        if (err) {
            return res.status(500).send(err.message);
        }
        db.query(`SELECT DISTINCT kategori FROM barang`, (err, categories) => {
            if (err) {
                return res.status(500).send(err.message);
            }
            
            // Get images for each barang
            const barangWithImages = results.map(item => {
                return new Promise((resolve, reject) => {
                    db.query(`SELECT file_id FROM images WHERE transaction_id = ?`, [item.id_barang], (imageErr, imageResults) => {
                        if (imageErr) {
                            return reject(imageErr);
                        }
                        item.images = imageResults;
                        resolve(item);
                    });
                });
            });

            Promise.all(barangWithImages).then(finalResults => {
                res.render('barang', {
                    title: 'List Barang',
                    page_title: 'barang',
                    barang: finalResults,
                    categories: categories.map(category => category.kategori),
                    selectedKategori: ''
                });
            }).catch(error => {
                return res.status(500).send(error.message);
            });
        });
    });
});



//transaksi rute
const transaksi = require('./transaksi');
//transaksi route
route.use('/transaksi', transaksi);

const moment = require('moment');

route.get('/barang', (req, res) => {
    
  });

// Create (POST)
route.post('/barang', (req, res) => {
    const { id_barang, merk, kategori, deskripsi, jumlah, sn } = req.body;
  
    const query = `INSERT INTO barang (id_barang, merk, kategori, deskripsi, jumlah, sn) VALUES (?, ?, ?, ?, ?, ?)`;
  
    db.query(query, [id_barang, merk, kategori, deskripsi, jumlah, sn], (err, results) => {
      if (err) {
        return res.status(500).send(err.message);
      }
      res.redirect('/barang');
    });
  });

// Update (POST)
route.post('/barang/:id', (req, res) => {
  const { id } = req.params;
  const { merk, kategori, deskripsi,jumlah } = req.body;
  db.query(`UPDATE barang SET merk = ?, kategori = ?, deskripsi = ? , jumlah = ? WHERE id_barang = ?`,
    [merk, kategori, deskripsi,jumlah, id], (err, results) => {
      if (err) {
        return res.status(500).send(err.message);
      }
      res.redirect('/barang');
    });
});

// Delete (POST)
route.post('/barang/delete/:id', (req, res) => {
  const { id } = req.params;
  db.query(`DELETE FROM barang WHERE id_barang = ?`, [id], (err, results) => {
    if (err) {
      return res.status(500).send(err.message);
    }
    res.redirect('/barang');
  });
});

// Route untuk filter barang berdasarkan kategori
route.get('/barang/filter', (req, res, next) => {
    const kategori = req.query.kategori;
    let query = `SELECT * FROM barang`;
    let params = [];

    if (kategori && kategori !== '') {
        query += ` WHERE kategori = ?`;
        params.push(kategori);
    }

    db.query(query, params, (err, results) => {
        if (err) {
            return res.status(500).send(err.message);
        }
        db.query(`SELECT DISTINCT kategori FROM barang`, (err, categories) => {
            if (err) {
                return res.status(500).send(err.message);
            }
            res.render('barang', { 
                title: 'List Barang', 
                page_title: 'barang', 
                barang: results, 
                categories: categories.map(category => category.kategori),
                selectedKategori: kategori 
            });
        });
    });
});

// Dashboard

route.get('/index', (req, res, next) => {
    res.render('index', { title: 'Dashboard',page_title:'Dashboard' });
})



// Apps 
route.get('/apps-calendar', (req, res, next) => {
    res.render('apps-calendar', { title: 'Calendar'});
})
route.get('/apps-chat', (req, res, next) => {
    res.render('apps-chat', { title: 'Chat'});
})
route.get('/apps-projects', (req, res, next) => {
    res.render('apps-projects', { title: 'Project'});
})
route.get('/task-kanban-board', (req, res, next) => {
    res.render('task-kanban-board', { title: 'Kanban Board'});
})
route.get('/task-details', (req, res, next) => {
    res.render('task-details', { title: 'Task Details'});
})
route.get('/email-inbox', (req, res, next) => {
    res.render('email-inbox', { title: 'Inbox'});
})
route.get('/email-templates', (req, res, next) => {
    res.render('email-templates', { title: 'Templates'});
})
route.get('/email-templates-action', (req, res, next) => {
    res.render('email-templates-action', { layout: false } );
})
route.get('/email-templates-alert', (req, res, next) => {
    res.render('email-templates-alert', { layout: false } );
})
route.get('/email-templates-billing', (req, res, next) => {
    res.render('email-templates-billing', { layout: false } );
})

// Contacts
route.get('/contacts-list', (req, res, next) => {
    res.render('contacts-list', { title: 'Contacts'});
})




// Auth Pages
route.get('/auth-login', (req, res, next) => {
    res.render('auth/auth-login', { title: 'Log In', layout: false })
})
route.get('/auth-register', (req, res, next) => {
    res.render('auth/auth-register', { title: 'Register', layout: false })
})
route.get('/auth-logout', (req, res, next) => {
    res.render('auth/auth-logout', { title: 'Logout', layout: false })
})
route.get('/auth-recoverpw', (req, res, next) => {
    res.render('auth/auth-recoverpw', { title: 'Recover Password', layout: false })
})
route.get('/auth-lock-screen', (req, res, next) => {
    res.render('auth-lock-screen', { title: 'Lock Screen', layout: false })
})
route.get('/auth-lock-screen', (req, res, next) => {
    res.render('auth-lock-screen', { title: 'Lock Screen', layout: false })
})
route.get('/auth-confirm-mail', (req, res, next) => {
    res.render('auth-confirm-mail', { title: 'Confirm Email', layout: false })
})

// Pages
route.get('/pages-starter', (req, res, next) => {
    res.render('pages-starter', { title: 'Starter'});
})
route.get('/pages-pricing', (req, res, next) => {
    res.render('pages-pricing', { title: 'Pricing'});
})
route.get('/pages-timeline', (req, res, next) => {
    res.render('pages-timeline', { title: 'timeline'});
})
route.get('/pages-invoice', (req, res, next) => {
    res.render('pages-invoice', { title: 'Invoice'});
})
route.get('/pages-faqs', (req, res, next) => {
    res.render('pages-faqs', { title: 'FAQs'});
})
route.get('/pages-gallery', (req, res, next) => {
    res.render('pages-gallery', { title: 'Gallery'});
})
route.get('/pages-404', (req, res, next) => {
    res.render('pages-404', { title: 'Error Page | 404', layout: false })
})
route.get('/pages-500', (req, res, next) => {
    res.render('pages-500', { title: 'Error Page | 500', layout: false })
})
route.get('/pages-maintenance', (req, res, next) => {
    res.render('pages-maintenance', { title: 'Maintenance', layout: false })
})
route.get('/pages-coming-soon', (req, res, next) => {
    res.render('pages-coming-soon', { title: 'Coming Soon', layout: false })
})

// Layouts
route.get('/layouts-horizontal', (req, res, next) => {
    res.render('layouts-horizontal', { title: 'Horizontal Layout', layout: 'partials/layout-horizontal' })
})
route.get('/layouts-preloader', (req, res, next) => {
    res.render('layouts-preloader', { title: 'Preloader Layout',page_title:'Preloader', layout: 'partials/layout-preloader' })
})

// Base UI
route.get('/ui-buttons', (req, res, next) => {
    res.render('ui-buttons', { title: 'Buttons'})
})
route.get('/ui-cards', (req, res, next) => {
    res.render('ui-cards', { title: 'Cards'})
})
route.get('/ui-avatars', (req, res, next) => {
    res.render('ui-avatars', { title: 'Avatars'})
})
route.get('/ui-tabs-accordions', (req, res, next) => {
    res.render('ui-tabs-accordions', { title: 'Tab & Accordions'})
})
route.get('/ui-modals', (req, res, next) => {
    res.render('ui-modals', { title: 'Modals'})
})
route.get('/ui-progress', (req, res, next) => {
    res.render('ui-progress', { title: 'Progress'})
})
route.get('/ui-notifications', (req, res, next) => {
    res.render('ui-notifications', { title: 'Notifications'})
})
route.get('/ui-offcanvas', (req, res, next) => {
    res.render('ui-offcanvas', { title: 'Offcanvas'})
})
route.get('/ui-placeholders', (req, res, next) => {
    res.render('ui-placeholders', { title: 'Placeholders'})
})
route.get('/ui-spinners', (req, res, next) => {
    res.render('ui-spinners', { title: 'Spinners'})
})
route.get('/ui-images', (req, res, next) => {
    res.render('ui-images', { title: 'Images'})
})
route.get('/ui-carousel', (req, res, next) => {
    res.render('ui-carousel', { title: 'Carousel'})
})
route.get('/ui-video', (req, res, next) => {
    res.render('ui-video', { title: 'Embed Video'})
})
route.get('/ui-dropdowns', (req, res, next) => {
    res.render('ui-dropdowns', { title: 'Dropdown'})
})
route.get('/ui-tooltips-popovers', (req, res, next) => {
    res.render('ui-tooltips-popovers', { title: 'Popovers'})
})
route.get('/ui-typography', (req, res, next) => {
    res.render('ui-typography', { title: 'Typography'})
})
route.get('/ui-general', (req, res, next) => {
    res.render('ui-general', { title: 'General UI'})
})
route.get('/ui-grid', (req, res, next) => {
    res.render('ui-grid', { title: 'Grid System'})
})
route.get('/ui-grid', (req, res, next) => {
    res.render('ui-grid', { title: ''})
})

// Widgets
route.get('/widgets', (req, res, next) => {
    res.render('widgets', { title: 'Widgets'})
})

// Extended UI
route.get('/extended-range-slider', (req, res, next) => {
    res.render('extended-range-slider', { title: 'Range Slider'})
})
route.get('/extended-sweet-alert', (req, res, next) => {
    res.render('extended-sweet-alert', { title: 'Sweet Alerts'})
})
route.get('/extended-draggable-cards', (req, res, next) => {
    res.render('extended-draggable-cards', { title: 'Draggable Cards'})
})
route.get('/extended-tour', (req, res, next) => {
    res.render('extended-tour', { title: 'Tour'})
})
route.get('/extended-notification', (req, res, next) => {
    res.render('extended-notification', { title: 'Notification'})
})
route.get('/extended-treeview', (req, res, next) => {
    res.render('extended-treeview', { title: 'Tree View'})
})

// Icons
route.get('/icons-feather', (req, res, next) => {
    res.render('icons-feather', { title: 'Feather Icons'})
})
route.get('/icons-mdi', (req, res, next) => {
    res.render('icons-mdi', { title: 'Material Design Icons'})
})
route.get('/icons-dripicons', (req, res, next) => {
    res.render('icons-dripicons', { title: 'Dripicons'})
})
route.get('/icons-font-awesome', (req, res, next) => {
    res.render('icons-font-awesome', { title: 'Font Awesome Icons'})
})
route.get('/icons-themify', (req, res, next) => {
    res.render('icons-themify', { title: 'Themify Icons'})
})

// Forms
route.get('/forms-elements', (req, res, next) => {
    res.render('forms-elements', { title: 'Form Elements'})
})
route.get('/forms-advanced', (req, res, next) => {
    res.render('forms-advanced', { title: 'Form Advanced'})
})
route.get('/forms-validation', (req, res, next) => {
    res.render('forms-validation', { title: 'Form Validation'})
})
route.get('/forms-wizard', (req, res, next) => {
    res.render('forms-wizard', { title: 'Form Wizard'})
})
route.get('/forms-quilljs', (req, res, next) => {
    res.render('forms-quilljs', { title: 'Editors'})
})
route.get('/forms-pickers', (req, res, next) => {
    res.render('forms-pickers', { title: 'Editors'})
})
route.get('/forms-file-uploads', (req, res, next) => {
    res.render('forms-file-uploads', { title: 'File Uploads'})
})
route.get('/forms-x-editable', (req, res, next) => {
    res.render('forms-x-editable', { title: 'X Editable'})
})

// Tables
route.get('/tables-basic', (req, res, next) => {
    res.render('tables-basic', { title: 'Bootstrap Basic Tables'})
})
route.get('/tables-datatables', (req, res, next) => {
    res.render('tables-datatables', { title: 'Data Tables'})
})
route.get('/tables-editable', (req, res, next) => {
    res.render('tables-editable', { title: 'Table Editable'})
})
route.get('/tables-responsive', (req, res, next) => {
    res.render('tables-responsive', { title: 'Responsive Table'})
})
route.get('/tables-responsive', (req, res, next) => {
    res.render('tables-responsive', { title: 'Responsive Table'})
})
route.get('/tables-tablesaw', (req, res, next) => {
    res.render('tables-tablesaw', { title: 'Tablesaw Table'})
})

// Charts
route.get('/charts-flot', (req, res, next) => {
    res.render('charts-flot', { title: 'Flot Charts'})
})
route.get('/charts-morris', (req, res, next) => {
    res.render('charts-morris', { title: 'Morris Charts'})
})
route.get('/charts-chartjs', (req, res, next) => {
    res.render('charts-chartjs', { title: 'Chartjs Charts'})
})
route.get('/charts-chartist', (req, res, next) => {
    res.render('charts-chartist', { title: 'Chartist Charts'})
})
route.get('/charts-sparklines', (req, res, next) => {
    res.render('charts-sparklines', { title: 'Sparklines Charts'})
})

// Maps
route.get('/maps-google', (req, res, next) => {
    res.render('maps-google', { title: 'Google Maps'})
})
route.get('/maps-vector', (req, res, next) => {
    res.render('maps-vector', { title: 'Vector Maps'})
})

module.exports = route;