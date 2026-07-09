import { Application } from './core/Application.js';

const container = document.getElementById('app');
const app = new Application(container);

// M2: Application.start() is now async (asset loading).
// We don't await it here — the render loop starts once assets are ready.
app.start();

console.log('[M2] Rose Window framework initializing...');
