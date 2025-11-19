import { render } from 'solid-js/web';
import './ui/styles/globals.css';
import App from './ui/App';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

render(() => <App />, root);
