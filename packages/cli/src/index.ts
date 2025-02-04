import { Container } from '@n8n/di';
import { CustomLicense } from './license.custom';
import { License } from './license';

// Override the default License class with our CustomLicense
Container.set(License, Container.get(CustomLicense));

// Re-export everything from the original license file
export * from './license';
export { CustomLicense } from './license.custom';
