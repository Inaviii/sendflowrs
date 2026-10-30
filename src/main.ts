import './styles.css';
import { giftIdFromPath } from './gift/gift';
import { showComposer } from './ui/composer';
import { showRecipient } from './ui/recipient';

const root = document.getElementById('app') as HTMLElement;
const path = location.pathname.slice(1);

if (path) void showRecipient(root, giftIdFromPath(path) ?? path, location.hash.slice(1));
else showComposer(root);
