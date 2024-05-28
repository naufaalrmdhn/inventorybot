const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'inventarisdb'
});

connection.connect(err => {
  if (err) {
    console.error('Error connecting to MySQL:', err.message);
    return;
  }
  console.log('Connected to MySQL database.');

  // Buat tabel barang jika belum ada
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS barang (
      id_barang INT AUTO_INCREMENT PRIMARY KEY,
      merk VARCHAR(255),
      kategori VARCHAR(255),
      deskripsi TEXT
    )
  `;
  connection.query(createTableQuery, (err, results) => {
    if (err) {
      console.error('Error creating table:', err.message);
    }
  });
});

module.exports = connection;
