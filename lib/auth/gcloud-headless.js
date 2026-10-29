'use strict';

// Same ADC token as gcloud-adc; login prints a URL usable on any device, then takes the pasted code.
const adc = require('./gcloud-adc');

const id = 'gcloud-headless';
const title = 'gcloud ADC login for machines without a browser (open URL on any device, paste code)';

async function resolve() {
  const cred = await adc.resolve();
  return cred && { ...cred, method: id };
}

async function login(args = []) {
  return adc.loginWith(['--no-launch-browser'], args);
}

async function status() {
  const s = await adc.status();
  return { configured: s.configured, detail: `headless: ${s.detail}` };
}

module.exports = { id, title, resolve, login, status };
