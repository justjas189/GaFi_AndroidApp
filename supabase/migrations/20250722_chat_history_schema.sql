-- Chat History Schema for MoneyTrack AI Assistant
-- This migration adds tables for persistent chat history storage

-- Create chat_sessions table to group related conversations
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    session_metadata JSONB DEFAULT '{}',
    
    -- Add indexes for performance
    CONSTRAINT chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create chat_messages table for storing individual messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    is_bot_message BOOLEAN DEFAULT false,
    message_data JSONB DEFAULT '{}', -- For structured data like transaction info, charts, etc.
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    intent VARCHAR(100), -- NLP detected intent
    confidence_score DECIMAL(3,2), -- NLP confidence score
    response_time_ms INTEGER, -- Processing time for analytics
    message_metadata JSONB DEFAULT '{}', -- Additional metadata
    
    -- Add indexes for performance
    CONSTRAINT chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_active ON chat_sessions(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_session ON chat_messages(user_id, session_id, timestamp);

-- Create user_chat_preferences table for managing user chat history preferences
CREATE TABLE IF NOT EXISTS user_chat_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    enable_history BOOLEAN DEFAULT true,
    max_sessions INTEGER DEFAULT 50, -- Maximum number of sessions to keep
    max_messages_per_session INTEGER DEFAULT 500, -- Maximum messages per session
    auto_delete_after_days INTEGER DEFAULT 90, -- Auto-delete old sessions
    context_memory_enabled BOOLEAN DEFAULT true, -- Enable AI context memory
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT user_chat_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for auto-updating timestamps
CREATE TRIGGER update_chat_sessions_updated_at 
    BEFORE UPDATE ON chat_sessions 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_user_chat_preferences_updated_at 
    BEFORE UPDATE ON user_chat_preferences 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Create function for automatic session cleanup
CREATE OR REPLACE FUNCTION cleanup_old_chat_sessions()
RETURNS void AS $$
BEGIN
    -- Delete old sessions based on user preferences
    DELETE FROM chat_sessions cs
    USING user_chat_preferences ucp
    WHERE cs.user_id = ucp.user_id
    AND ucp.auto_delete_after_days > 0
    AND cs.created_at < (CURRENT_TIMESTAMP - INTERVAL '1 day' * ucp.auto_delete_after_days);
    
    -- Delete sessions exceeding max_sessions limit for each user
    WITH ranked_sessions AS (
        SELECT cs.id,
               ROW_NUMBER() OVER (PARTITION BY cs.user_id ORDER BY cs.updated_at DESC) as session_rank
        FROM chat_sessions cs
        JOIN user_chat_preferences ucp ON cs.user_id = ucp.user_id
        WHERE ucp.max_sessions > 0
    )
    DELETE FROM chat_sessions
    WHERE id IN (
        SELECT id FROM ranked_sessions 
        WHERE session_rank > (
            SELECT max_sessions 
            FROM user_chat_preferences 
            WHERE user_id = (SELECT user_id FROM chat_sessions WHERE id = ranked_sessions.id)
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) policies for data privacy
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_chat_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own chat sessions
CREATE POLICY "Users can view own chat sessions" ON chat_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat sessions" ON chat_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions" ON chat_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat sessions" ON chat_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Policy: Users can only access their own chat messages
CREATE POLICY "Users can view own chat messages" ON chat_messages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat messages" ON chat_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat messages" ON chat_messages
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat messages" ON chat_messages
    FOR DELETE USING (auth.uid() = user_id);

-- Policy: Users can only access their own chat preferences
CREATE POLICY "Users can view own chat preferences" ON user_chat_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat preferences" ON user_chat_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat preferences" ON user_chat_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat preferences" ON user_chat_preferences
    FOR DELETE USING (auth.uid() = user_id);

-- Create default chat preferences for existing users
INSERT INTO user_chat_preferences (user_id, enable_history, context_memory_enabled)
SELECT id, true, true
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
