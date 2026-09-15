// Runs independently before the SDK bundle so startup failures remain inspectable.
(() => {
  let stage = 'Extension loaded; starting Gmail integration';
  let changedAt = Date.now();
  globalThis.mailSignalStartup = {
    set(value) { stage = value; changedAt = Date.now(); console.info('[MailSignal]', value); }
  };
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id || message?.type !== 'mailsignal-status') return;
    reply({ stage, seconds: Math.floor((Date.now() - changedAt) / 1000), version: chrome.runtime.getManifest().version });
  });
  window.addEventListener('error', event => {
    if (event.filename?.startsWith(chrome.runtime.getURL(''))) {
      globalThis.mailSignalStartup.set('Extension error: ' + event.message);
    }
  });
  console.info('[MailSignal]', stage);
})();
