import query from './db_connect';
import startMessageListener from './pgListener';

const initDB = async () => {
    const statements = [
        `
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            first_name VARCHAR(50) NOT NULL,
            last_name VARCHAR(50) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            username VARCHAR(50) UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role VARCHAR(20) DEFAULT 'user',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            last_login TIMESTAMP,
            reset_token TEXT,
            reset_token_expiry TIMESTAMP,
            refresh_tokens TEXT[]
        );
        `,
        `
        CREATE TABLE IF NOT EXISTS posts (
            post_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            owner_id UUID REFERENCES users(id),
            content JSONB NOT NULL,
            email VARCHAR(75) NOT NULL,
            name VARCHAR(75) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            printed_at TIMESTAMP
        );
        `,
        `
        CREATE TABLE IF NOT EXISTS endpoints (
            endpoint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            owner_id UUID REFERENCES users(id),
            type VARCHAR(50) NOT NULL,
            status VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP
        );
        `,
        `
        CREATE INDEX IF NOT EXISTS idx_owner_id_printed_at ON posts (owner_id) WHERE printed_at IS NULL;
        `,
        `
        CREATE OR REPLACE FUNCTION notify_message_count()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
            target_user_id uuid;
            unread_count integer;
        BEGIN
            IF TG_OP = 'INSERT' THEN
                IF NEW.printed_at IS NOT NULL THEN
                    RETURN NEW;
                END IF;
                target_user_id := NEW.owner_id;   -- was NEW.user_id

            ELSIF TG_OP = 'UPDATE' THEN
                IF OLD.printed_at IS NOT DISTINCT FROM NEW.printed_at THEN
                    RETURN NEW;
                END IF;
                target_user_id := NEW.owner_id;   -- was NEW.user_id
            END IF;

            SELECT COUNT(*)
            INTO unread_count
            FROM posts
            WHERE owner_id = target_user_id      -- was user_id
            AND printed_at IS NULL;

            PERFORM pg_notify(
                'messages_available',
                json_build_object(
                    'userId', target_user_id,
                    'count', unread_count,
                    'hasMessages', unread_count > 0
                )::text
            );

            RETURN NEW;
        END;
        $$;
        `,
        `
        DROP TRIGGER IF EXISTS posts_message_count_trigger ON posts;
        CREATE TRIGGER posts_message_count_trigger
        AFTER INSERT OR UPDATE OF printed_at
        ON posts
        FOR EACH ROW
        EXECUTE FUNCTION notify_message_count();
        `
    ];

    try {
        for (const statement of statements) {
            await query(statement);
        }
        console.log('Database tables initialized successfully.---');
        await startMessageListener();
        console.log('Message listener started successfully.');
       
    } catch (err) {
        if (err instanceof Error) {
            console.error('Error creating tables:', err.message);
            throw err.message;
        } else {
            throw err;
        }
    }
};

export default initDB;

