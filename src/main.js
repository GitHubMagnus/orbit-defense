import { Game } from './game.js';

const game = new Game(document.getElementById('game-container'));
// für Debugging/Tests in der Konsole zugänglich
window.__game = game;
