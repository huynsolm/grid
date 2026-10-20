import { createDocumentStore } from './document-store';

/** Single application document; importing it never mounts or resets the UI. */
export const store = createDocumentStore();
