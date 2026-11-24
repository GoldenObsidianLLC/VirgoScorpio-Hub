'use strict';

const EVENT_SCHEMA_VERSION = 1;
const MAX_EVENT_PAYLOAD_BYTES = 64 * 1024;
const { UUID_RE } = require('../../domain/src/identifiers');
const EVENT_TYPE_RE = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const AGGREGATE_TYPE_RE = /^[a-z][a-z0-9_-]{0,63}$/;
const CLASSIFICATIONS = new Set(['internal', 'site-private', 'public']);

// Domain event definitions are explicitly classified and bind duplicated
// top-level payload identity fields to the canonical outbox envelope.
const DOMAIN_EVENT_DEFINITIONS = Object.freeze({
  'content.upsert': Object.freeze({ classification: 'site-private', resourceType: 'content', resourceIdKey: 'id' }),
  'content.publish': Object.freeze({ classification: 'site-private', resourceType: 'content', resourceIdKey: 'id' }),
  'content.unpublish': Object.freeze({ classification: 'site-private', resourceType: 'content', resourceIdKey: 'id' }),
  'content.delete': Object.freeze({ classification: 'site-private', resourceType: 'content', resourceIdKey: 'id' }),
  'content.submitted_for_review': Object.freeze({ classification: 'site-private', resourceType: 'content', resourceIdKey: 'id' }),
  'content.approved': Object.freeze({ classification: 'site-private', resourceType: 'content', resourceIdKey: 'id' }),
  'content.rejected': Object.freeze({ classification: 'site-private', resourceType: 'content', resourceIdKey: 'id' }),
  'content.scheduled': Object.freeze({ classification: 'site-private', resourceType: 'content', resourceIdKey: 'id' }),
  'content.archived': Object.freeze({ classification: 'site-private', resourceType: 'content', resourceIdKey: 'id' }),
  'content.unpublished': Object.freeze({ classification: 'site-private', resourceType: 'content', resourceIdKey: 'id' }),
  'relationship.upsert': Object.freeze({ classification: 'site-private', resourceType: 'relationship', resourceIdKey: 'relationshipId' }),
  'relationship.delete': Object.freeze({ classification: 'site-private', resourceType: 'relationship', resourceIdKey: 'relationshipId' }),
  'taxonomy.upsert': Object.freeze({ classification: 'site-private', resourceType: 'taxonomy-term', resourceIdKey: 'id' }),
  'taxonomy.delete': Object.freeze({ classification: 'site-private', resourceType: 'taxonomy-term', resourceIdKey: 'id' })
});

const DOMAIN_EVENT_CLASSIFICATIONS = Object.freeze(Object.fromEntries(
  Object.entries(DOMAIN_EVENT_DEFINITIONS).map(([eventType, definition]) => [eventType, definition.classification])
));

const EVENT_PAYLOAD_IDENTITY_BINDINGS = Object.freeze(Object.fromEntries(
  Object.entries(DOMAIN_EVENT_DEFINITIONS).map(([eventType, definition]) => [
    eventType,
    Object.freeze({ resourceType: definition.resourceType, resourceIdKey: definition.resourceIdKey })
  ])
));

function eventError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function parseOccurredAt(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_TIMESTAMP_INVALID', 'occurredAt must be a valid timestamp.');
  }
  return date.toISOString();
}

function normalizeOptionalIdentifier(value, name, maxLength = 128) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > maxLength || !/^[A-Za-z0-9._:-]+$/.test(value)) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_IDENTIFIER_INVALID', name + ' must be a safe identifier.');
  }
  return value;
}

function validateEventEnvelope(input) {
  if (!isPlainObject(input)) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_INVALID', 'The event envelope must be a plain object.');
  }

  if (typeof input.eventId !== 'string' || !UUID_RE.test(input.eventId)) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_ID_INVALID', 'eventId must be a UUID.');
  }
  if (typeof input.eventType !== 'string' || input.eventType.length > 96 || !EVENT_TYPE_RE.test(input.eventType)) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_TYPE_INVALID', 'eventType must be a bounded dotted identifier.');
  }

  const schemaVersion = Number(input.schemaVersion);
  if (!Number.isInteger(schemaVersion) || schemaVersion !== EVENT_SCHEMA_VERSION) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_SCHEMA_UNSUPPORTED', 'The event schema version is not supported by this consumer.');
  }

  const occurredAt = parseOccurredAt(input.occurredAt);
  const classification = input.classification;
  if (!CLASSIFICATIONS.has(classification)) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_CLASSIFICATION_INVALID', 'classification must be internal, site-private or public.');
  }

  const siteId = input.siteId === undefined || input.siteId === null ? null : input.siteId;
  if (siteId !== null && (typeof siteId !== 'string' || !UUID_RE.test(siteId))) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_SITE_INVALID', 'siteId must be a UUID when provided.');
  }
  if (classification !== 'internal' && !siteId) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_SITE_REQUIRED', 'Site-scoped and public domain events require siteId.');
  }

  const expectedClassification = DOMAIN_EVENT_CLASSIFICATIONS[input.eventType];
  if (expectedClassification && expectedClassification !== classification) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_CLASSIFICATION_MISMATCH', 'The event type does not match its required classification.');
  }
  if (!expectedClassification && classification !== 'internal') {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_CLASSIFICATION_MISMATCH', 'Unregistered event types must remain internal until their classification is reviewed.');
  }
  if (expectedClassification && !siteId) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_SITE_REQUIRED', 'Domain events require siteId.');
  }

  if (!isPlainObject(input.actor)) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_ACTOR_INVALID', 'actor must be an object.');
  }
  const actorType = input.actor.type;
  const actorId = input.actor.id === undefined || input.actor.id === null ? null : input.actor.id;
  if (!['system', 'user'].includes(actorType)) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_ACTOR_INVALID', 'actor.type must be system or user.');
  }
  if ((actorType === 'user' && (typeof actorId !== 'string' || !UUID_RE.test(actorId))) ||
      (actorType === 'system' && actorId !== null)) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_ACTOR_INVALID', 'actor.id must be a UUID for users and null for system events.');
  }

  if (!isPlainObject(input.resource)) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_RESOURCE_INVALID', 'resource must be an object.');
  }
  if (typeof input.resource.type !== 'string' || !AGGREGATE_TYPE_RE.test(input.resource.type)) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_RESOURCE_INVALID', 'resource.type must be a bounded identifier.');
  }
  if (typeof input.resource.id !== 'string' || !UUID_RE.test(input.resource.id)) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_RESOURCE_INVALID', 'resource.id must be a UUID.');
  }
  const resourceVersion = Number(input.resource.version);
  if (!Number.isSafeInteger(resourceVersion) || resourceVersion < 1) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_RESOURCE_INVALID', 'resource.version must be a positive safe integer.');
  }

  const correlationId = normalizeOptionalIdentifier(input.correlationId, 'correlationId');
  const causationId = normalizeOptionalIdentifier(input.causationId, 'causationId');
  if (causationId !== null && !UUID_RE.test(causationId)) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_IDENTIFIER_INVALID', 'causationId must be a UUID.');
  }

  if (!isPlainObject(input.payload)) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_PAYLOAD_INVALID', 'payload must be a plain JSON object.');
  }

  let payloadJson;
  try {
    payloadJson = JSON.stringify(input.payload);
  } catch {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_PAYLOAD_INVALID', 'payload must be serializable JSON.');
  }
  if (typeof payloadJson !== 'string' || Buffer.byteLength(payloadJson) > MAX_EVENT_PAYLOAD_BYTES) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_PAYLOAD_TOO_LARGE', 'payload exceeds the 64 KiB event limit.');
  }

  const normalized = {
    eventId: input.eventId.toLowerCase(),
    eventType: input.eventType,
    schemaVersion,
    occurredAt,
    siteId: siteId ? siteId.toLowerCase() : null,
    actor: { type: actorType, id: actorId ? actorId.toLowerCase() : null },
    resource: {
      type: input.resource.type,
      id: input.resource.id.toLowerCase(),
      version: resourceVersion
    },
    correlationId,
    causationId: causationId ? causationId.toLowerCase() : null,
    classification,
    payload: JSON.parse(payloadJson)
  };

  normalized.idempotencyKey = [
    normalized.resource.type,
    normalized.resource.id,
    String(normalized.resource.version),
    normalized.eventType
  ].join(':');

  return Object.freeze(normalized);
}

/**
 * Bind duplicated, top-level domain identity fields to the validated v1
 * envelope. The returned payload is a shallow immutable copy; domain fields
 * and nested metadata remain opaque and are never recursively interpreted.
 *
 * Graph projection may pass a separate payload for defense-in-depth checks.
 * When that happens both the envelope payload and supplied payload must agree
 * with the canonical envelope identity.
 */
function bindEventPayloadIdentity(input, payloadInput = input?.payload, options = {}) {
  const envelope = validateEventEnvelope(input);
  const binding = EVENT_PAYLOAD_IDENTITY_BINDINGS[envelope.eventType];
  const suppliedPayloadIsSeparate = payloadInput !== input?.payload && payloadInput !== envelope.payload;
  const payloadSource = suppliedPayloadIsSeparate ? payloadInput : envelope.payload;

  if (!binding) {
    return { envelope, payload: payloadSource };
  }

  const errorCodes = options?.errorCodes || {};
  const code = (key, fallback) => errorCodes[key] || fallback;

  if (envelope.resource.type !== binding.resourceType) {
    throw eventError(
      code('resourceType', 'ERR_VIRGOSCORPIO_HUB_EVENT_IDENTITY_RESOURCE_TYPE_MISMATCH'),
      'The event resource type does not match its registered event family.'
    );
  }

  function normalizePayload(payload) {
    if (!isPlainObject(payload)) {
      throw eventError(
        code('payload', 'ERR_VIRGOSCORPIO_HUB_EVENT_IDENTITY_PAYLOAD_INVALID'),
        'A registered domain event requires a plain JSON payload object.'
      );
    }
    if (typeof payload.siteId !== 'string' || payload.siteId.toLowerCase() !== envelope.siteId) {
      throw eventError(
        code('scope', 'ERR_VIRGOSCORPIO_HUB_EVENT_IDENTITY_SCOPE_MISMATCH'),
        'The payload site identity does not match the canonical event envelope.'
      );
    }
    const payloadResourceId = payload[binding.resourceIdKey];
    if (typeof payloadResourceId !== 'string' || payloadResourceId.toLowerCase() !== envelope.resource.id) {
      throw eventError(
        code('resource', 'ERR_VIRGOSCORPIO_HUB_EVENT_IDENTITY_RESOURCE_MISMATCH'),
        'The payload aggregate identity does not match the canonical event envelope.'
      );
    }
    return Object.freeze({
      ...payload,
      siteId: envelope.siteId,
      [binding.resourceIdKey]: envelope.resource.id
    });
  }

  const envelopePayload = normalizePayload(envelope.payload);
  const payload = suppliedPayloadIsSeparate
    ? normalizePayload(payloadSource)
    : envelopePayload;
  const boundEnvelope = Object.freeze({ ...envelope, payload: envelopePayload });

  return { envelope: boundEnvelope, payload };
}

/**
 * Convert a claimed PostgreSQL outbox row to the v1 event contract.
 * outbox_events.id is the stable eventId; the aggregate uniqueness constraint
 * remains the producer idempotency key. Legacy/non-domain worker messages may
 * be internal and unscoped, but classified domain events must have site scope.
 */
function eventEnvelopeFromOutboxRow(row) {
  if (!isPlainObject(row)) {
    throw eventError('ERR_VIRGOSCORPIO_HUB_EVENT_INVALID', 'An outbox row is required.');
  }

  const envelope = {
    eventId: row.id,
    eventType: row.event_type,
    schemaVersion: row.schema_version === undefined ? EVENT_SCHEMA_VERSION : Number(row.schema_version),
    occurredAt: row.created_at,
    siteId: row.site_id || null,
    actor: row.actor_id
      ? { type: 'user', id: row.actor_id }
      : { type: 'system', id: null },
    resource: {
      type: row.aggregate_type,
      id: row.aggregate_id,
      version: Number(row.aggregate_version)
    },
    correlationId: row.correlation_id || null,
    causationId: row.causation_id || null,
    classification: row.classification || 'internal',
    payload: row.payload
  };

  return bindEventPayloadIdentity(envelope).envelope;
}

module.exports = {
  EVENT_SCHEMA_VERSION,
  MAX_EVENT_PAYLOAD_BYTES,
  DOMAIN_EVENT_DEFINITIONS,
  DOMAIN_EVENT_CLASSIFICATIONS,
  EVENT_PAYLOAD_IDENTITY_BINDINGS,
  bindEventPayloadIdentity,
  validateEventEnvelope,
  eventEnvelopeFromOutboxRow,
  eventError,
  isPlainObject
};
