import './styles.css';
import { showComposer } from './ui/composer';
import { showRecipient } from './ui/recipient';

const root = document.getElementById('app') as HTMLElement;
const path = location.pathname.slice(1);

if (path) void showRecipient(root, path, location.hash.slice(1));
else showComposer(root);
