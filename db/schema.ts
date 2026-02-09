import { pgTable, text, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

// 🟢 1. USERS TABLE (Merged with your SaaS fields)
export const users = pgTable("user", {
  id: text("id").notNull().primaryKey(), // Auth.js prefers text IDs for flexibility
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  
  // --- YOUR SAAS FIELDS (Kept exactly as before) ---
  plan: text("plan").default("free"), 
  razorpayCustomerId: text("razorpay_customer_id"),
  razorpaySubscriptionId: text("razorpay_subscription_id"), 
  premiumExpiresAt: timestamp("premium_expires_at"),        
  lastUsageDate: text("last_usage_date"), 
  secondsUsedToday: integer("seconds_used_today").default(0),
  lastHeartbeatAt: timestamp("last_heartbeat_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 🟢 2. ACCOUNTS TABLE (Missing in your previous run - fixes Error 42P01)
export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

// 🟢 3. SESSIONS TABLE (Required for persistent login)
export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").notNull().primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});