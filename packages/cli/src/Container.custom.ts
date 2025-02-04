import { Container } from '@n8n/di';
import { CustomLicense } from './license.custom';
import { License } from './license';

// Register the custom license implementation
Container.set(License, Container.get(CustomLicense));

export { Container };
