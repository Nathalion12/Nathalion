-- init_db.sql
-- Script to initialize the database for the Beachouse application.

-- Optional: Drop the table if it already exists.
-- This is useful for development to easily reset the table.
-- For production, you might want to handle migrations more carefully.
DROP TABLE IF EXISTS users;

-- Create the "users" table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optional: Indexes are often automatically created for UNIQUE constraints by PostgreSQL.
-- However, explicitly creating them can be done if needed or for clarity.
-- CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
-- CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Confirmation message (will be displayed if script is run via psql)
\echo 'Table "users" created successfully.'
\echo 'Please ensure you have configured your .env file or environment variables for DB_USER, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT.'
\echo 'Example psql command to run this script:'
\echo 'psql -U your_db_user -d your_db_name -f init_db.sql'
