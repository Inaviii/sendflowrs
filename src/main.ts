import './styles.css';
import { giftIdFromPath } from './gift/gift';
import { showComposer } from './ui/composer';
import { showRecipient } from './ui/recipient';

const root = document.getElementById('app') as HTMLElement;
const path = location.pathname.slice(1);

// Encryption and copying only work on a secure page. Localhost counts as secure, so development is unaffected.
if (!isSecureContext) location.replace(location.href.replace(/^http:/, 'https:'));
else if (path) void showRecipient(root, giftIdFromPath(path) ?? path, location.hash.slice(1));
else showComposer(root);
