const { Client } = require('pg');
const config = require('../../config/config.json');

async function createMessagesTable() {
    const dbConfig = config.development;
    const client = new Client({
        user: dbConfig.username,
        host: dbConfig.host,
        database: dbConfig.database,
        password: dbConfig.password,
        port: dbConfig.port,
    });

    try {
        await client.connect();
        console.log('Connected to PostgreSQL');

        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS messages (
                id VARCHAR(24) PRIMARY KEY,
                sender_id VARCHAR(24) REFERENCES users(id),
                recipient_id VARCHAR(24) REFERENCES users(id),
                center_id VARCHAR(24) REFERENCES centers(id),
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                is_broadcast BOOLEAN DEFAULT FALSE,
                priority VARCHAR(20) CHECK (priority IN ('info', 'normal', 'urgent')),
                type VARCHAR(20) CHECK (type IN ('general', 'announcement', 'reminder', 'alert')),
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- Create indexes for better query performance
            CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
            CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
            CREATE INDEX IF NOT EXISTS idx_messages_center_id ON messages(center_id);
            CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
            CREATE INDEX IF NOT EXISTS idx_messages_is_broadcast ON messages(is_broadcast);
        `;

        await client.query(createTableQuery);
        console.log('Messages table created successfully');
    } catch (error) {
        console.error('Error creating messages table:', error);
    } finally {
        await client.end();
    }
}

createMessagesTable();