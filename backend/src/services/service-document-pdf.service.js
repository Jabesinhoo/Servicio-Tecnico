'use strict';

const fs = require('fs');
const path = require('path');

let puppeteer = null;

const MAX_CONCURRENCY =
  Math.max(
    1,
    Number(
      process.env.SERVICE_DOCUMENT_PDF_CONCURRENCY ||
        1
    )
  );

const MAX_QUEUE =
  Math.max(
    1,
    Number(
      process.env.SERVICE_DOCUMENT_PDF_QUEUE ||
        10
    )
  );

let activeJobs = 0;
const waitQueue = [];

function loadPuppeteer() {
  if (puppeteer) {
    return puppeteer;
  }

  try {
    puppeteer =
      require('puppeteer-core');

    return puppeteer;
  } catch (error) {
    const wrapped =
      new Error(
        'Puppeteer Core no está instalado. Ejecuta INSTALAR-DEPENDENCIA-PDF-V16.ps1.'
      );

    wrapped.code =
      'PUPPETEER_NOT_INSTALLED';

    throw wrapped;
  }
}

function browserCandidates() {
  const candidates = [
    process.env.SERVICE_DOCUMENT_BROWSER_PATH,
    process.env.BROWSER_PATH,

    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/snap/bin/chromium',

    process.env.PROGRAMFILES
      ? path.join(
          process.env.PROGRAMFILES,
          'Google/Chrome/Application/chrome.exe'
        )
      : null,

    process.env['PROGRAMFILES(X86)']
      ? path.join(
          process.env['PROGRAMFILES(X86)'],
          'Google/Chrome/Application/chrome.exe'
        )
      : null,

    process.env.PROGRAMFILES
      ? path.join(
          process.env.PROGRAMFILES,
          'Microsoft/Edge/Application/msedge.exe'
        )
      : null,

    process.env['PROGRAMFILES(X86)']
      ? path.join(
          process.env['PROGRAMFILES(X86)'],
          'Microsoft/Edge/Application/msedge.exe'
        )
      : null,

    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);

  return [
    ...new Set(
      candidates
    ),
  ];
}

function getBrowserPath() {
  for (
    const candidate of
    browserCandidates()
  ) {
    try {
      if (
        fs.existsSync(
          candidate
        )
      ) {
        return candidate;
      }
    } catch (_) {}
  }

  const error =
    new Error(
      'No se encontró Chrome/Edge/Chromium. Define SERVICE_DOCUMENT_BROWSER_PATH o BROWSER_PATH en backend/.env.'
    );

  error.code =
    'BROWSER_NOT_FOUND';

  throw error;
}

function acquireSlot() {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      if (
        waitQueue.length >=
        MAX_QUEUE
      ) {
        const error =
          new Error(
            'La cola de generación PDF está llena. Intenta nuevamente.'
          );

        error.code =
          'PDF_QUEUE_FULL';

        reject(error);
        return;
      }

      const tryAcquire =
        () => {
          if (
            activeJobs <
            MAX_CONCURRENCY
          ) {
            activeJobs += 1;
            resolve();
            return;
          }

          waitQueue.push(
            tryAcquire
          );
        };

      tryAcquire();
    }
  );
}

function releaseSlot() {
  activeJobs =
    Math.max(
      0,
      activeJobs - 1
    );

  const next =
    waitQueue.shift();

  if (next) {
    next();
  }
}

async function generatePdfBuffer(
  html
) {
  await acquireSlot();

  let browser = null;

  try {
    const library =
      loadPuppeteer();

    const executablePath =
      getBrowserPath();

    browser =
      await library.launch({
        headless: true,
        executablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
        timeout:
          Number(
            process.env.SERVICE_DOCUMENT_BROWSER_TIMEOUT_MS ||
              120000
          ),
      });

    const page =
      await browser.newPage();

    await page.setContent(
      html,
      {
        waitUntil:
          'networkidle0',
        timeout:
          Number(
            process.env.SERVICE_DOCUMENT_PAGE_TIMEOUT_MS ||
              120000
          ),
      }
    );

    await page.emulateMediaType(
      'print'
    );

    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm',
      },
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }

    releaseSlot();
  }
}

module.exports = {
  generatePdfBuffer,
  getBrowserPath,
};
