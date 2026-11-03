-- Canal de chat: client (gestor↔cliente) | staff (gestor ↔ perito)
ALTER TABLE chat_messages
  ADD COLUMN channel VARCHAR(20) NOT NULL DEFAULT 'client';

CREATE INDEX idx_chat_messages_deal_channel ON chat_messages (deal_id, channel);
