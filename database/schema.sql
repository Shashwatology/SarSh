CREATE TABLE IF NOT EXISTS Users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(100) UNIQUE,
    password_hash TEXT NOT NULL,
    profile_picture TEXT,
    status VARCHAR(100) DEFAULT 'Hey there! I am using ChatApp.',
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Chats (
    id SERIAL PRIMARY KEY,
    is_group BOOLEAN DEFAULT false,
    group_name VARCHAR(100),
    group_icon TEXT,
    theme VARCHAR(50) DEFAULT 'default',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ChatParticipants (
    chat_id INTEGER REFERENCES Chats(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES Users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS Messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER REFERENCES Chats(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES Users(id) ON DELETE CASCADE,
    content TEXT,
    media_url TEXT,
    media_type VARCHAR(20), -- image, audio, document
    status VARCHAR(20) DEFAULT 'sent', -- sent, delivered, read
    is_edited BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    reply_to_id INTEGER REFERENCES Messages(id) ON DELETE SET NULL,
    is_forwarded BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS StatusUpdates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES Users(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type VARCHAR(20) DEFAULT 'image',
    caption TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE -- Usually created_at + 24 hours
);

-- Index for faster message retrieval
CREATE INDEX idx_messages_chat_id ON Messages(chat_id);
CREATE INDEX idx_chat_participants_user_id ON ChatParticipants(user_id);
CREATE INDEX idx_status_updates_expires_at ON StatusUpdates(expires_at);
