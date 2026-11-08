'use strict';

(function installStudioCollaboration(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VSHStudioCollaboration = api;
})(typeof globalThis === 'object' ? globalThis : this, function createApi() {
  const CONTAINER_TYPES = new Set(['section', 'column', 'container']);
  const TYPE_PROPS = Object.freeze({
    section: new Set(['className', 'styles', 'responsiveStyles']),
    column: new Set(['className', 'styles', 'responsiveStyles']),
    container: new Set(['className', 'styles', 'responsiveStyles']),
    'widget.heading': new Set(['text', 'level', 'className', 'styles', 'responsiveStyles']),
    'widget.text': new Set(['text', 'className', 'styles', 'responsiveStyles']),
    'widget.button': new Set(['text', 'url', 'className', 'styles', 'responsiveStyles']),
    'widget.image': new Set(['assetId', 'alt', 'className', 'styles', 'responsiveStyles']),
    'widget.video': new Set(['assetId', 'posterAssetId', 'title', 'controls', 'className', 'styles', 'responsiveStyles']),
    'widget.icon': new Set(['iconName', 'size', 'title', 'className', 'styles', 'responsiveStyles']),
    'widget.math': new Set(['formula', 'displayMode', 'className', 'styles', 'responsiveStyles']),
    'widget.list': new Set(['items', 'ordered', 'className', 'styles', 'responsiveStyles']),
    'widget.quote': new Set(['text', 'cite', 'className', 'styles', 'responsiveStyles']),
    'widget.divider': new Set(['className', 'styles', 'responsiveStyles']),
    'widget.spacer': new Set(['height', 'className', 'styles', 'responsiveStyles']),
    'widget.query-loop': new Set(['source', 'contentType', 'limit', 'columns', 'emptyText', 'className', 'styles', 'responsiveStyles'])
  });
  const TEXT_NODE_TYPES = new Set(['widget.heading', 'widget.text', 'widget.button', 'widget.quote']);
  const NODE_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function clone(value) {
    return structuredClone(value);
  }

  function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  const ALLOWED_NODE_TYPES = new Set(Object.keys(TYPE_PROPS));
  const CONTAINER_TYPE_SET = CONTAINER_TYPES;
  const ALLOWED_OPERATION_TYPES = new Set([
    'document.set_title', 'node.insert', 'node.delete', 'node.move',
    'node.set_prop', 'text.insert', 'text.delete'
  ]);

  function isJsonValue(value, stack = new Set()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value !== 'object' || stack.has(value)) return false;
    if (!Array.isArray(value) && !isPlainObject(value)) return false;
    if (Object.getOwnPropertySymbols(value).length > 0) return false;
    stack.add(value);
    const valid = Array.isArray(value)
      ? value.every(item => isJsonValue(item, stack))
      : Object.keys(value).every(key => isJsonValue(value[key], stack));
    stack.delete(value);
    return valid;
  }

  function validatePageDocumentShape(document) {
    if (!isPlainObject(document) || document.schemaVersion !== 1 || document.type !== 'page' ||
        typeof document.documentId !== 'string' || !NODE_ID_PATTERN.test(document.documentId) ||
        typeof document.title !== 'string' || document.title.trim().length < 1 ||
        document.title.length > 180 || !Array.isArray(document.children)) {
      throw new Error('The collaboration message contains an invalid page document.');
    }

    const ids = new Set();
    let count = 0;
    function visit(node, depth) {
      count += 1;
      if (count > 250 || depth > 12 || !isPlainObject(node) ||
          typeof node.id !== 'string' || !NODE_ID_PATTERN.test(node.id) ||
          ids.has(node.id) || !ALLOWED_NODE_TYPES.has(node.type) ||
          !isPlainObject(node.props) || !Array.isArray(node.children)) {
        throw new Error('The collaboration message contains an invalid page node tree.');
      }
      ids.add(node.id);
      if (!isJsonValue(node.props)) throw new Error('The collaboration message contains a non-JSON component property.');
      for (const key of Object.keys(node.props)) {
        if (!TYPE_PROPS[node.type]?.has(key)) throw new Error('The collaboration message contains an unsupported component property.');
      }
      if (!CONTAINER_TYPE_SET.has(node.type) && node.children.length > 0) {
        throw new Error('The collaboration message gives child nodes to a non-container component.');
      }
      for (const child of node.children) visit(child, depth + 1);
    }
    for (const child of document.children) visit(child, 1);
    return true;
  }

  function assertOperationEnvelope(operation) {
    const keys = ['schemaVersion', 'opId', 'clientId', 'baseSequence', 'type', 'payload'];
    if (!isPlainObject(operation) ||
        Object.keys(operation).length !== keys.length ||
        Object.keys(operation).some(key => !keys.includes(key)) ||
        operation.schemaVersion !== 1 ||
        typeof operation.opId !== 'string' || !UUID_PATTERN.test(operation.opId) ||
        typeof operation.clientId !== 'string' || !NODE_ID_PATTERN.test(operation.clientId) ||
        !Number.isSafeInteger(operation.baseSequence) || operation.baseSequence < 0 ||
        !ALLOWED_OPERATION_TYPES.has(operation.type) || !isPlainObject(operation.payload) ||
        !isJsonValue(operation)) {
      throw new Error('The collaboration server sent an invalid operation envelope.');
    }

    const payload = operation.payload;
    const exactKeys = expected => Object.keys(payload).length === expected.length &&
      Object.keys(payload).every(key => expected.includes(key));
    const validNodeId = value => typeof value === 'string' && NODE_ID_PATTERN.test(value);
    switch (operation.type) {
      case 'document.set_title':
        if (!exactKeys(['title']) || typeof payload.title !== 'string' ||
            payload.title.trim().length < 1 || payload.title.length > 180) throw new Error('The collaboration title operation is invalid.');
        break;
      case 'node.insert':
        if (!exactKeys(['node', 'parentId', 'afterNodeId']) || !isPlainObject(payload.node) ||
            (payload.parentId !== null && !validNodeId(payload.parentId)) ||
            (payload.afterNodeId !== null && !validNodeId(payload.afterNodeId))) throw new Error('The collaboration insert operation is invalid.');
        break;
      case 'node.delete':
        if (!exactKeys(['nodeId']) || !validNodeId(payload.nodeId)) throw new Error('The collaboration delete operation is invalid.');
        break;
      case 'node.move':
        if (!exactKeys(['nodeId', 'parentId', 'afterNodeId']) || !validNodeId(payload.nodeId) ||
            (payload.parentId !== null && !validNodeId(payload.parentId)) ||
            (payload.afterNodeId !== null && !validNodeId(payload.afterNodeId))) throw new Error('The collaboration move operation is invalid.');
        break;
      case 'node.set_prop':
        if (!exactKeys(['nodeId', 'key', 'value']) || !validNodeId(payload.nodeId) ||
            typeof payload.key !== 'string' || !/^[A-Za-z][A-Za-z0-9]{0,49}$/.test(payload.key) ||
            !Object.hasOwn(payload, 'value')) throw new Error('The collaboration property operation is invalid.');
        break;
      case 'text.insert':
        if (!exactKeys(['nodeId', 'key', 'offset', 'text']) || !validNodeId(payload.nodeId) ||
            !['text', 'cite'].includes(payload.key) || !Number.isSafeInteger(payload.offset) ||
            payload.offset < 0 || typeof payload.text !== 'string' ||
            payload.text.length < 1 || payload.text.length > 10_000) throw new Error('The collaboration text insertion is invalid.');
        break;
      case 'text.delete':
        if (!exactKeys(['nodeId', 'key', 'offset', 'length']) || !validNodeId(payload.nodeId) ||
            !['text', 'cite'].includes(payload.key) || !Number.isSafeInteger(payload.offset) ||
            payload.offset < 0 || !Number.isSafeInteger(payload.length) || payload.length < 1) {
          throw new Error('The collaboration text deletion is invalid.');
        }
        break;
      default:
        throw new Error('The collaboration operation type is not supported.');
    }
  }

  function findNode(document, nodeId, parent = null, siblings = document?.children) {
    if (!Array.isArray(siblings)) return null;
    for (let index = 0; index < siblings.length; index += 1) {
      const node = siblings[index];
      if (node && node.id === nodeId) return { node, parent, siblings, index };
      const nested = findNode(document, nodeId, node, node?.children);
      if (nested) return nested;
    }
    return null;
  }

  function getContainer(document, parentId) {
    if (parentId === null) return { node: null, children: document.children };
    const found = findNode(document, parentId);
    if (!found) throw new Error('The collaboration destination no longer exists.');
    if (!CONTAINER_TYPES.has(found.node.type)) throw new Error('The collaboration destination cannot contain child nodes.');
    return { node: found.node, children: found.node.children };
  }

  function insertIndex(siblings, afterNodeId) {
    if (afterNodeId === null) return 0;
    const index = siblings.findIndex(node => node.id === afterNodeId);
    if (index < 0) throw new Error('The collaboration sibling anchor no longer exists.');
    return index + 1;
  }

  function containsNode(node, nodeId) {
    if (!node || typeof node !== 'object') return false;
    if (node.id === nodeId) return true;
    return Array.isArray(node.children) && node.children.some(child => containsNode(child, nodeId));
  }

  function applyCollaborationOperation(document, operation) {
    validatePageDocumentShape(document);
    assertOperationEnvelope(operation);
    const next = clone(document);
    const payload = operation.payload;

    switch (operation.type) {
      case 'document.set_title':
        if (typeof payload.title !== 'string' || payload.title.length < 1 || payload.title.length > 180) {
          throw new Error('The collaborative page title is invalid.');
        }
        next.title = payload.title;
        break;
      case 'node.insert': {
        if (!isPlainObject(payload.node) || !NODE_ID_PATTERN.test(String(payload.node.id || ''))) throw new Error('The inserted node is invalid.');
        if (findNode(next, payload.node.id)) throw new Error('The inserted node already exists in this document.');
        const destination = getContainer(next, payload.parentId);
        destination.children.splice(insertIndex(destination.children, payload.afterNodeId), 0, clone(payload.node));
        break;
      }
      case 'node.delete': {
        const target = findNode(next, payload.nodeId);
        if (!target) throw new Error('The collaboration delete target no longer exists.');
        target.siblings.splice(target.index, 1);
        break;
      }
      case 'node.move': {
        const target = findNode(next, payload.nodeId);
        if (!target) throw new Error('The collaboration move target no longer exists.');
        const destination = getContainer(next, payload.parentId);
        if (destination.node && containsNode(target.node, destination.node.id)) throw new Error('A node cannot be moved into itself or a descendant.');
        if (payload.afterNodeId === payload.nodeId) throw new Error('A node cannot be positioned after itself.');
        target.siblings.splice(target.index, 1);
        destination.children.splice(insertIndex(destination.children, payload.afterNodeId), 0, target.node);
        break;
      }
      case 'node.set_prop': {
        const target = findNode(next, payload.nodeId);
        if (!target) throw new Error('The collaboration property target no longer exists.');
        if (!Object.hasOwn(payload, 'key') || !TYPE_PROPS[target.node.type]?.has(payload.key) || !isPlainObject(target.node.props)) {
          throw new Error('The collaborative property is not approved for this component.');
        }
        target.node.props[payload.key] = clone(payload.value);
        break;
      }
      case 'text.insert':
      case 'text.delete': {
        const target = findNode(next, payload.nodeId);
        if (!target) throw new Error('The collaboration text target no longer exists.');
        if (!TEXT_NODE_TYPES.has(target.node.type) || !['text', 'cite'].includes(payload.key) ||
            (payload.key === 'cite' && target.node.type !== 'widget.quote')) {
          throw new Error('The collaborative text property is not approved.');
        }
        const current = target.node.props?.[payload.key];
        if (typeof current !== 'string') throw new Error('The collaborative text property is no longer a string.');
        const points = Array.from(current);
        if (!Number.isSafeInteger(payload.offset) || payload.offset < 0 || payload.offset > points.length) {
          throw new Error('The collaborative text offset is invalid.');
        }
        if (operation.type === 'text.insert') {
          if (typeof payload.text !== 'string' || payload.text.length < 1 || payload.text.length > 10_000) throw new Error('The collaborative text insertion is invalid.');
          points.splice(payload.offset, 0, ...Array.from(payload.text));
        } else {
          if (!Number.isSafeInteger(payload.length) || payload.length < 1 || payload.offset + payload.length > points.length) {
            throw new Error('The collaborative text deletion range is invalid.');
          }
          points.splice(payload.offset, payload.length);
        }
        target.node.props[payload.key] = points.join('');
        break;
      }
      default:
        throw new Error('The collaboration operation type is not supported by Studio.');
    }
    validatePageDocumentShape(next);
    return next;
  }

  function createClientId(cryptoRef) {
    if (cryptoRef && typeof cryptoRef.randomUUID === 'function') return cryptoRef.randomUUID();
    if (!cryptoRef || typeof cryptoRef.getRandomValues !== 'function') {
      throw new Error('Secure browser randomness is required for collaboration.');
    }
    const bytes = new Uint8Array(16);
    cryptoRef.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
  }

  function createStudioCollaborationClient(options = {}) {
    const siteId = String(options.siteId || '');
    const contentId = String(options.contentId || '');
    const clientId = String(options.clientId || createClientId(options.cryptoRef || globalThis.crypto));
    const WebSocketClass = options.WebSocketClass || globalThis.WebSocket;
    const fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
    const locationRef = options.locationRef || globalThis.location;
    const timers = options.timers || globalThis;
    const onOperation = typeof options.onOperation === 'function' ? options.onOperation : () => {};
    const onReload = typeof options.onReload === 'function' ? options.onReload : () => {};
    const onStatus = typeof options.onStatus === 'function' ? options.onStatus : () => {};
    const onError = typeof options.onError === 'function' ? options.onError : () => {};

    if (!UUID_PATTERN.test(siteId) || !UUID_PATTERN.test(contentId) || !/^[A-Za-z0-9_-]{1,80}$/.test(clientId)) {
      throw new TypeError('Studio collaboration requires valid site, page and client identifiers.');
    }
    if (typeof WebSocketClass !== 'function') throw new TypeError('WebSocket is not available in this browser.');

    let socket = null;
    let sequence = Number.isSafeInteger(options.initialSequence) && options.initialSequence >= 0 ? options.initialSequence : 0;
    let expectedSequence = sequence;
    let joined = false;
    let synced = false;
    let stopped = false;
    let fatal = false;
    let connectionNumber = 0;
    let reconnectAttempts = 0;
    let reconnectTimer = null;
    let gapTimer = null;
    let syncPromise = null;
    let startTimer = null;
    let startResolve = null;
    let startReject = null;
    let startPromise = null;
    let pending = null;
    const buffered = new Map();

    function collaborationUrl() {
      if (options.url) return options.url;
      if (!locationRef?.href) throw new Error('The current page URL is unavailable.');
      const url = new URL('/api/v1/sites/' + encodeURIComponent(siteId) + '/realtime/ws', locationRef.href);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return url.toString();
    }

    function setStatus(status, detail = null) {
      onStatus(status, { sequence, detail });
    }

    function send(command) {
      if (!socket || socket.readyState !== WebSocketClass.OPEN) return false;
      socket.send(JSON.stringify(command));
      return true;
    }

    function settleStart(error) {
      if (startTimer !== null) timers.clearTimeout(startTimer);
      startTimer = null;
      const resolve = startResolve;
      const reject = startReject;
      startResolve = null;
      startReject = null;
      if (error) reject?.(error);
      else resolve?.();
    }

    function settlePending(error, result) {
      if (!pending) return;
      const current = pending;
      pending = null;
      if (error) current.reject(error);
      else current.resolve(result);
    }

    function rejectWithCode(code, fallback = 'Studio collaboration was rejected.') {
      const error = new Error(fallback);
      error.code = String(code || 'ERR_VIRGOSCORPIO_HUB_COLLABORATION_UNAVAILABLE').slice(0, 120);
      return error;
    }

    function isFatalCode(code) {
      return /FORBIDDEN|NOT_DRAFT|COLLABORATION_DISABLED|NOT_FOUND/i.test(String(code || ''));
    }

    function applyReload(message) {
      const document = message.document;
      const nextSequence = Number(message.sequence);
      if (!document || !Number.isSafeInteger(nextSequence) || nextSequence < 0) {
        const error = rejectWithCode('ERR_VIRGOSCORPIO_HUB_COLLABORATION_RELOAD_INVALID', 'The collaboration reload response was incomplete.');
        onError(error);
        failFatal(error);
        return;
      }
      try {
        validatePageDocumentShape(document);
      } catch {
        const error = rejectWithCode('ERR_VIRGOSCORPIO_HUB_COLLABORATION_RELOAD_INVALID', 'The collaboration server returned an invalid page document.');
        onError(error);
        failFatal(error);
        return;
      }
      sequence = nextSequence;
      expectedSequence = nextSequence;
      buffered.clear();
      if (gapTimer !== null) timers.clearTimeout(gapTimer);
      gapTimer = null;
      try {
        onReload(clone(document), {
          sequence,
          version: Number.isSafeInteger(Number(message.version)) ? Number(message.version) : null,
          title: typeof message.title === 'string' ? message.title : document.title
        });
      } catch (error) {
        onError(error);
      }
      if (pending) settlePending(rejectWithCode('ERR_VIRGOSCORPIO_HUB_COLLABORATION_RELOAD_REQUIRED', 'The document changed beyond the retained collaboration history. The canonical draft was reloaded; retry your edit.'));
      updateSyncState();
    }

    function resolvePendingFromMessage(message) {
      if (!pending) return;
      const operationId = message.operationId || message.operation?.opId || message.appliedOperation?.opId;
      if (operationId !== pending.envelope.opId) return;
      settlePending(null, {
        sequence: Number(message.sequence) || sequence,
        version: Number.isSafeInteger(Number(message.version)) ? Number(message.version) : null,
        duplicate: message.duplicate === true
      });
    }

    function drainBuffered() {
      while (buffered.has(sequence + 1)) {
        const message = buffered.get(sequence + 1);
        buffered.delete(sequence + 1);
        const operation = message.appliedOperation || message.operation;
        if (!operation) {
          onError(new Error('A collaboration sequence message did not include an operation.'));
          void requestSync(false);
          return;
        }
        try {
          onOperation(clone(operation), {
            sequence: Number(message.sequence),
            version: Number.isSafeInteger(Number(message.version)) ? Number(message.version) : null,
            local: Boolean(pending && operation.opId === pending.envelope.opId)
          });
          sequence = Number(message.sequence);
          resolvePendingFromMessage(message);
        } catch (error) {
          onError(error);
          void requestSync(false);
          return;
        }
      }
      updateSyncState();
    }

    function acceptSequencedMessage(message) {
      const messageSequence = Number(message.sequence);
      if (!Number.isSafeInteger(messageSequence) || messageSequence < 1) return;
      if (messageSequence <= sequence) {
        resolvePendingFromMessage(message);
        if (pending && messageSequence === pending.envelope.baseSequence + 1 && message.duplicate) resolvePendingFromMessage(message);
        return;
      }
      const existing = buffered.get(messageSequence);
      if (!existing || message.type === 'document.operation.ack') buffered.set(messageSequence, message);
      drainBuffered();
      if (buffered.size && !buffered.has(sequence + 1)) scheduleGapSync();
    }

    function updateSyncState() {
      if (!joined) return;
      synced = sequence >= expectedSequence;
      if (synced) {
        reconnectAttempts = 0;
        setStatus('connected');
        settleStart();
        sendPending();
      } else {
        setStatus('syncing', { expectedSequence });
      }
    }

    function sendPending() {
      if (!pending || !joined || !synced || !socket || socket.readyState !== WebSocketClass.OPEN) return;
      if (pending.sentConnection === connectionNumber) return;
      if (send({ type: 'document.operation', contentId, operation: pending.envelope })) {
        pending.sentConnection = connectionNumber;
      }
    }

    function scheduleGapSync() {
      if (gapTimer !== null || stopped) return;
      gapTimer = timers.setTimeout(() => {
        gapTimer = null;
        void requestSync(false);
      }, 250);
    }

    async function requestSync(rejoinAfter) {
      if (syncPromise || stopped || typeof fetchImpl !== 'function') return syncPromise;
      syncPromise = (async () => {
        const url = '/api/v1/pages/' + encodeURIComponent(contentId) + '/collaboration/sync?afterSequence=' + encodeURIComponent(sequence);
        const response = await fetchImpl(url, {
          method: 'GET',
          credentials: 'same-origin',
          headers: { 'x-virgoscorpio-hub-site-id': siteId }
        });
        const value = await response.json().catch(() => ({}));
        if (!response.ok) throw rejectWithCode(value.code || 'ERR_VIRGOSCORPIO_HUB_COLLABORATION_SYNC_FAILED', value.error || 'The collaboration session could not synchronize.');
        if (value.reloadRequired === true) {
          applyReload(value);
        } else if (Array.isArray(value.operations)) {
          expectedSequence = Number(value.sequence) || expectedSequence;
          for (const item of value.operations) {
            acceptSequencedMessage({
              type: 'document.sync.operation',
              sequence: Number(item.sequence),
              operation: item.operation,
              appliedOperation: item.appliedOperation
            });
          }
          updateSyncState();
        }
        if (rejoinAfter && socket?.readyState === WebSocketClass.OPEN) {
          joined = false;
          synced = false;
          send({ type: 'document.join', contentId, afterSequence: sequence });
        }
      })().catch(error => {
        onError(error);
        if (isFatalCode(error.code)) {
          failFatal(error);
        } else if (socket && socket.readyState === WebSocketClass.OPEN) {
          setStatus('reconnecting', { reason: 'sync-failed' });
          socket.close(1011, 'collaboration-sync-retry');
        }
      }).finally(() => {
        syncPromise = null;
      });
      return syncPromise;
    }

    function failFatal(error) {
      fatal = true;
      stopped = true;
      if (reconnectTimer !== null) timers.clearTimeout(reconnectTimer);
      reconnectTimer = null;
      settleStart(error);
      settlePending(error);
      setStatus('error', error.message);
      if (socket && socket.readyState < WebSocketClass.CLOSING) socket.close(1008, 'collaboration-not-authorized');
    }

    function handleMessage(event) {
      let message;
      try {
        message = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data));
      } catch {
        onError(new Error('The collaboration server sent an invalid message.'));
        return;
      }
      if (!message || typeof message !== 'object' || Array.isArray(message)) return;

      if (message.type === 'connection.ready') {
        if (!send({ type: 'document.join', contentId, afterSequence: sequence })) {
          setStatus('reconnecting');
        }
        return;
      }
      if (message.type === 'document.joined') {
        joined = true;
        expectedSequence = Number.isSafeInteger(Number(message.sequence)) ? Number(message.sequence) : sequence;
        synced = false;
        setStatus('syncing', { expectedSequence });
        updateSyncState();
        return;
      }
      if (message.type === 'document.operation' || message.type === 'document.sync.operation' ||
          message.type === 'document.operation.ack') {
        acceptSequencedMessage(message);
        return;
      }
      if (message.type === 'document.reload') {
        applyReload(message);
        return;
      }
      if (message.type === 'document.reload.required') {
        joined = false;
        synced = false;
        setStatus('syncing', { reason: 'reload-required' });
        void requestSync(true);
        return;
      }
      if (message.type === 'document.sync.degraded') {
        setStatus('syncing', { reason: 'server-sync-degraded' });
        void requestSync(false);
        return;
      }
      if (message.type === 'document.error') {
        const error = rejectWithCode(message.code);
        onError(error);
        if (pending) settlePending(error);
        if (!joined) settleStart(error);
        if (isFatalCode(error.code)) failFatal(error);
      }
    }

    function scheduleReconnect() {
      if (stopped || fatal || reconnectTimer !== null) return;
      reconnectAttempts += 1;
      const delay = Math.min(15_000, 500 * (2 ** Math.min(reconnectAttempts, 5)));
      setStatus('reconnecting', { attempt: reconnectAttempts, retryInMs: delay });
      reconnectTimer = timers.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    }

    function connect() {
      if (stopped || fatal) return;
      connectionNumber += 1;
      joined = false;
      synced = false;
      setStatus('connecting');
      try {
        socket = new WebSocketClass(collaborationUrl());
      } catch (error) {
        onError(error);
        scheduleReconnect();
        return;
      }
      socket.addEventListener('message', handleMessage);
      socket.addEventListener('open', () => setStatus('connecting'));
      socket.addEventListener('close', () => {
        if (socket?.readyState === WebSocketClass.CLOSED) socket = null;
        joined = false;
        synced = false;
        if (!stopped && !fatal) scheduleReconnect();
      });
      socket.addEventListener('error', () => setStatus('reconnecting'));
    }

    function start() {
      if (startPromise) return startPromise;
      if (stopped) return Promise.reject(new Error('The collaboration client is closed.'));
      startPromise = new Promise((resolve, reject) => {
        startResolve = resolve;
        startReject = reject;
        startTimer = timers.setTimeout(() => {
          const error = new Error('The collaboration server did not finish joining this draft.');
          error.code = 'ERR_VIRGOSCORPIO_HUB_COLLABORATION_JOIN_TIMEOUT';
          settleStart(error);
          onError(error);
        }, Number.isSafeInteger(options.joinTimeoutMs) ? options.joinTimeoutMs : 20_000);
      });
      connect();
      return startPromise;
    }

    function submit(descriptor) {
      if (!joined || !synced) return Promise.reject(new Error('Wait until the collaboration session is synchronized before editing.'));
      if (pending) return Promise.reject(new Error('A collaborative edit is already being committed.'));
      if (!isPlainObject(descriptor) || typeof descriptor.type !== 'string' || !isPlainObject(descriptor.payload)) {
        return Promise.reject(new TypeError('A typed collaboration operation is required.'));
      }
      const cryptoRef = options.cryptoRef || globalThis.crypto;
      const envelope = {
        schemaVersion: 1,
        opId: createClientId(cryptoRef),
        clientId,
        baseSequence: sequence,
        type: descriptor.type,
        payload: clone(descriptor.payload)
      };
      return new Promise((resolve, reject) => {
        pending = { envelope, resolve, reject, sentConnection: 0 };
        sendPending();
      });
    }

    function close() {
      if (pending) return false;
      settleStart(rejectWithCode('ERR_VIRGOSCORPIO_HUB_COLLABORATION_CLIENT_CLOSED', 'The collaboration session was closed before joining completed.'));
      stopped = true;
      if (reconnectTimer !== null) timers.clearTimeout(reconnectTimer);
      if (gapTimer !== null) timers.clearTimeout(gapTimer);
      if (startTimer !== null) timers.clearTimeout(startTimer);
      reconnectTimer = null;
      gapTimer = null;
      startTimer = null;
      if (socket && socket.readyState === WebSocketClass.OPEN) {
        send({ type: 'document.leave', contentId });
        socket.close(1000, 'editor-left-collaboration');
      } else if (socket && socket.readyState < WebSocketClass.CLOSING) {
        socket.close();
      }
      joined = false;
      synced = false;
      setStatus('closed');
      return true;
    }

    return {
      start,
      submit,
      close,
      get sequence() { return sequence; },
      get connected() { return joined && synced && Boolean(socket && socket.readyState === WebSocketClass.OPEN); },
      get busy() { return Boolean(pending); }
    };
  }

  return { applyCollaborationOperation, createStudioCollaborationClient };
});
