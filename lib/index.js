'use strict';

import { unified } from "unified";
import remarkParse from "remark-parse";

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import async from 'async';
import deepmerge from 'deepmerge';
import puppeteer from 'puppeteer';

export default (options) => {
  options = deepmerge({
    markdown: '**/*.md',
    html: '**/*.html',
    mermaid: {}
  }, options || {});

  return (files, metalsmith, done) => {
    const markdownFiles = metalsmith.match(options.markdown);
    async.each(markdownFiles, async (filename, complete) => {
      const file = files[filename];

      const tree = unified()
        .use(remarkParse)
        .parse(file.contents);
      let newVar = await processMarkdown(tree, options.mermaid);

      // TODO(cememr): replacing content

      complete();
    }, (err) => {
      done();
    });

    // TODO(cemmer): html files?
  };
};

// TODO(cemmer): turn this whole thing into a remark plugin? https://github.com/temando/remark-mermaid/blob/master/src/index.js
const processMarkdown = async (ast, mermaidOptions) => {
  // TODO(cemmer): move AST parsing here, so everything markdown is in one file?

  let ret = {};
  if (ast.type.toLowerCase() === 'code' && (ast.lang || '').toLowerCase() === 'mermaid') {
    // TODO(cemmer): ast.value doesn't have the ``` marks, need to reassemble that
    ret[ast.value] = await mermaidToHtml(ast.value, mermaidOptions);
  }
  if (ast.children) {
    for (const child of ast.children) {
      ret = {...ret, ...await processMarkdown(child, mermaidOptions)};
    }
  }
  return ret;
};

const mermaidToHtml = async (mermaid, mermaidOptions) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.setContent(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head><body><div id="container"></div></body></html>`);
  await page.addScriptTag({
    path: require.resolve('mermaid/dist/mermaid.min.js')
  });

  const html = await page.$eval('#container', (container, mermaidOptions) => {
    container.innerHTML = `<div class="mermaid">${mermaid}</div>`;
    window.mermaid.initialize(mermaidOptions);
    window.mermaid.init();
    return container.querySelector('svg').outerHTML;
  }, mermaidOptions);
  await browser.close();
  return html;
}
