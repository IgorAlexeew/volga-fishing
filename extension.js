'use strict';

const vscode = require('vscode');
const fs = require('node:fs');
const path = require('node:path');

const { speciesList, baits } = require('./media/catalog');
const keepnetKey = 'volgaFishing.keepnet.v1';
const oldJournalKey = 'volgaFishing.journal.v1';

function activate(context) {
  const media = vscode.Uri.joinPath(context.extensionUri, 'media');
  const template = fs.readFileSync(path.join(context.extensionPath, 'media', 'index.html'), 'utf8');
  let saveQueue = Promise.resolve();

  function resolveWebviewView(view) {
    const webview = view.webview;
    webview.options = { enableScripts: true, localResourceRoots: [media] };
    let disposed = false;
    view.onDidDispose(() => { disposed = true; });
    webview.onDidReceiveMessage(message => {
      if (!message || !['ready', 'catch'].includes(message.type)) return;
      saveQueue = saveQueue.then(async () => {
        let catches = context.globalState.get(keepnetKey, []);
        if (message.type === 'catch') {
          const { catchId, species, grams, baitId } = message;
          const fish = speciesList.find(entry => entry.id === species);
          if (!fish || !Number.isInteger(grams) || grams < fish.minGrams || grams > fish.maxGrams
              || !Object.hasOwn(baits, baitId) || typeof catchId !== 'string'
              || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(catchId)) return;
          if (!catches.some(item => item.catchId === catchId)) {
            catches = [...catches, { catchId, species, grams, baitId, caughtAt: Date.now() }];
            await context.globalState.update(keepnetKey, catches);
          }
        }
        if (!disposed) await webview.postMessage({
          type: 'keepnet', catches, oldJournal: context.globalState.get(oldJournalKey, {})
        });
      }).catch(() => vscode.window.showErrorMessage('Не удалось прочитать или сохранить садок.'));
    });
    webview.html = template.replaceAll('{{media}}', webview.asWebviewUri(media).toString())
      .replaceAll('{{source}}', webview.cspSource);
  }

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('volgaFishing.river', { resolveWebviewView },
      { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('volgaFishing.open',
      () => vscode.commands.executeCommand('volgaFishing.river.focus'))
  );
}
module.exports = { activate };
