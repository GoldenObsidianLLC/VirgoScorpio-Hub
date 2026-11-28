'use strict';

const path = require('node:path');

// Run the stateful, high-cardinality tenant isolation suite against the freshly
// migrated database before other integration files add fixture rows.
const PRIORITY_INTEGRATION_FILES = Object.freeze([
  'tenant-isolation.integration.test.js',
]);

function orderLiveIntegrationFiles(files) {
  const priority = new Map(PRIORITY_INTEGRATION_FILES.map((file, index) => [file, index]));
  return [...files].sort((left, right) => {
    const leftPriority = priority.get(path.basename(left)) ?? PRIORITY_INTEGRATION_FILES.length;
    const rightPriority = priority.get(path.basename(right)) ?? PRIORITY_INTEGRATION_FILES.length;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

module.exports = { orderLiveIntegrationFiles };
