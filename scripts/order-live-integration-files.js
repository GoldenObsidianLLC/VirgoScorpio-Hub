'use strict';

const path = require('node:path');

// Run the focused cloud-connection authorization race first, then the broader
// stateful tenant-isolation suite, immediately after fresh migrations and before
// other integration files add fixture rows.
const PRIORITY_INTEGRATION_FILES = Object.freeze([
  'tenant-cloud-connection-isolation.integration.test.js',
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
