import { pgTable, text, timestamp, integer, boolean, jsonb, uuid } from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  authProviderUserId: text('auth_provider_user_id').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  actorUserId: uuid('actor_user_id'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  beforeHash: text('before_hash'),
  afterHash: text('after_hash'),
  requestId: text('request_id'),
  ip: text('ip'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const evidenceRecords = pgTable('evidence_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  tier: text('tier').notNull(),
  sourceType: text('source_type').notNull(),
  sourceSnapshotJson: jsonb('source_snapshot_json').default({}).notNull(),
  sourceUri: text('source_uri'),
  capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow().notNull(),
  capturedByUserId: uuid('captured_by_user_id'),
  verificationStatus: text('verification_status').notNull().default('draft'),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  version: integer('version').notNull().default(1),
  supersedesId: uuid('supersedes_id'),
  title: text('title').notNull(),
  statement: text('statement'),
});

export const contributions = pgTable('contributions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  userId: uuid('user_id').notNull(),
  roleAtTime: text('role_at_time').notNull(),
  workItemKey: text('work_item_key'),
  teamStatement: text('team_statement'),
  individualActionStatement: text('individual_action_statement'),
  impactStatement: text('impact_statement'),
  validationStatus: text('validation_status').notNull().default('draft'),
  impactVerificationStatus: text('impact_verification_status').notNull().default('unverified'),
  auditVersion: integer('audit_version').notNull().default(1),
  dedupeKey: text('dedupe_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  userId: uuid('user_id').notNull(),
  title: text('title').notNull(),
  baseline: text('baseline'),
  target: text('target'),
  measurementMethod: text('measurement_method'),
  evidenceSource: text('evidence_source'),
  effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
  deadline: timestamp('deadline', { withTimezone: true }),
  managerId: uuid('manager_id'),
  validatorId: uuid('validator_id'),
  status: text('status').notNull().default('active'),
});

export const goalAmendments = pgTable('goal_amendments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  goalId: uuid('goal_id').notNull(),
  previousTarget: text('previous_target'),
  newTarget: text('new_target'),
  reason: text('reason'),
  communicatedAt: timestamp('communicated_at', { withTimezone: true }).notNull(),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  managerAcknowledgedAt: timestamp('manager_acknowledged_at', { withTimezone: true }),
  effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
  measurementStart: timestamp('measurement_start', { withTimezone: true }).notNull(),
  retrospectiveFlag: boolean('retrospective_flag').notNull().default(false),
});

