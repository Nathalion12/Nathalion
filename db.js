// db.js - Database configuration and query module

const { Pool } = require('pg');

// Database connection details
// It's recommended to use environment variables for production.
// Defaults are provided for local development.
//
// ASSUMPTIONS for PostgreSQL server setup:
// 1. A PostgreSQL server is running and accessible.
// 2. A database (e.g., 'beachouse_db') has been created.
// 3. A user (e.g., 'beachouse_user') has been created with a password and granted
//    permissions to the 'beachouse_db' database.
//
// Example PSQL commands to set up the database and user:
// (Run these in your psql terminal or a SQL client)
//
// -- Create the user (replace 'your_very_secure_password' with a strong password)
// -- CREATE USER beachouse_user WITH PASSWORD 'your_very_secure_password';
//
// -- Create the database and set the owner
// -- CREATE DATABASE beachouse_db OWNER beachouse_user;
//
// -- Grant all privileges on the database to the user (optional, for simplicity in dev)
// -- GRANT ALL PRIVILEGES ON DATABASE beachouse_db TO beachouse_user;
//
// Remember to set the following environment variables in your deployment environment:
// DB_USER, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT

const pool = new Pool({
    user: process.env.DB_USER || 'beachouse_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'beachouse_db',
    password: process.env.DB_PASSWORD || 'your_password', // PLEASE CHANGE THIS DEFAULT PASSWORD
    port: parseInt(process.env.DB_PORT || '5432', 10), // Ensure port is an integer
});

// Test connection on pool initialization (optional, but good for immediate feedback)
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error on initial test query:', err.stack);
        // Depending on the application, you might want to handle this more gracefully,
        // e.g., by setting a flag that the DB is not available or even exiting the process.
    } else {
        console.log('Database connected successfully. Server time:', res.rows[0].now);
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    // Exporting the pool itself can be useful for transactions or more complex scenarios
    // pool: pool, 
};
