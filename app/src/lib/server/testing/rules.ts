/**
 * The invented rules folders the service, API and e2e tests load: core-1.0.1 and core-1.0.2 (the hook rifle's range
 * changes, the bell goes, a pike comes), the mire-front-1.0 expansion on core-1.0.2 (a Bog Runner with three loadouts), and broken-0.1, whose item
 * names a keyword that does not exist. No book content.
 */
import { fileURLToPath } from 'node:url';

export const RULES_FIXTURE = fileURLToPath(new URL('./rules-fixture', import.meta.url));
