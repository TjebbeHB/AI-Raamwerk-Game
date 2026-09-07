import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const sessions=sqliteTable('golem_sessions',{
 code:text('code').primaryKey(),
 data:text('data').notNull(),
 revision:integer('revision').notNull().default(0),
});
