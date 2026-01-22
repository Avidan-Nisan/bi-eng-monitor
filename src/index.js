import React from 'react';
import ReactDOM from 'react-dom';
import { ExtensionProvider } from '@looker/extension-sdk-react';
import App from './App';
import './styles.css';

const root = document.createElement('div');
root.id = 'extension-root';
root.style.height = '100%';
root.style.width = '100%';
document.body.style.margin = '0';
document.body.style.height = '100vh';
document.body.appendChild(root);

ReactDOM.render(
  <ExtensionProvider>
    <App />
  </ExtensionProvider>,
  root
);
