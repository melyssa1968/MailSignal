import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const campaigns = sqliteTable('campaigns', {
 id: text('id').primaryKey(), owner: text('owner').notNull(), name: text('name').notNull(),
 subject: text('subject').notNull(), body: text('body').notNull(), status: text('status').notNull().default('active'),
 source:text('source').notNull().default('campaign'), createdAt: integer('created_at').notNull(), secretHash: text('secret_hash'),
}, t => [index('idx_campaigns_owner').on(t.owner)]);
export const messages = sqliteTable('messages', {
 id: text('id').primaryKey(), campaignId: text('campaign_id').notNull().references(()=>campaigns.id),
 email: text('email').notNull(), sentAt: integer('sent_at'), sendingAt: integer('sending_at'),
}, t => [index('idx_messages_campaign').on(t.campaignId)]);
export const events = sqliteTable('events', {
 id: text('id').primaryKey(), messageId: text('message_id').notNull().references(()=>messages.id),
 receivedAt: integer('received_at').notNull(), kind: text('kind').notNull(),
}, t => [index('idx_events_message_time').on(t.messageId,t.receivedAt)]);
export const preferences = sqliteTable('preferences', {
 owner: text('owner').primaryKey(), excludedDomains:text('excluded_domains').notNull().default('[]'),
 extensionKeyHash:text('extension_key_hash'), extensionSeenAt:integer('extension_seen_at'),
},t=>[index('idx_preferences_extension_key').on(t.extensionKeyHash)]);
