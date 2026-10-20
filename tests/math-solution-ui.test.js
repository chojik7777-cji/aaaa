'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_PATH || '/tmp/note-modal-browser/node_modules/playwright');
const root = path.resolve(__dirname, '..');
async function open(t, engine = chromium, width = 390) {
    const browser = await engine.launch({ headless: true });
    t.after(() => browser.close());
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const requests = [], errors = [];
    await context.route('**/*', route => {
        const u = new URL(route.request().url());
        requests.push({ path: u.pathname + u.search, method: route.request().method() });
        if (u.pathname === '/api/math-control' && u.search === '?action=status')
            return route.fulfill({ json: { ok: true, locked: false, version: 1, questionLimit: 0 } });
        const file = path.join(root, u.pathname);
        if (['/math-level.html', '/math-problems.js', '/game-transfer.js'].includes(u.pathname))
            return route.fulfill({ contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html', body: fs.readFileSync(file) });
        return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://fixture.local/math-level.html');
    await page.waitForFunction(() => lastControlVersion === 1);
    if (/manual advance/.test(t.name)) assert.equal(await page.locator('#nextProblemBtn').count(), 1, '수동 다음 문제 버튼이 필요합니다');
    await page.click('#startBtn');
    await page.evaluate(() => { current.solutionSteps = ['주어진 조건을 확인합니다.', '<img src=x onerror="window.xss=1">', 'x'.repeat(350)]; });
    t.after(() => { assert.deepEqual(errors, []); assert(requests.every(r => r.method === 'GET')); });
    return { page, context };
}
for (const [name, engine] of [['Chromium', chromium], ['WebKit', webkit]]) {
    test(name + ': answers require manual advance and cannot rescore after pause or poll', async t => {
        const { page } = await open(t, engine);
        for (const kind of ['correct', 'wrong', 'skip']) {
            assert.equal(await page.locator('#nextProblemBtn').count(), 1, '수동 다음 문제 버튼이 필요합니다');
            assert.equal(await page.locator('#nextProblemBtn').isVisible(), false);
            assert.equal(await page.locator('#nextProblemBtn').isDisabled(), true);
            const before = await page.evaluate(() => state.asked);
            if (kind === 'skip') await page.click('#skipBtn');
            else {
                const value = await page.evaluate(k => current.choices.find(c => c.correct === (k === 'correct')).value, kind);
                await page.locator(`[data-choice="${value}"]`).click();
            }
            assert.equal(await page.evaluate(() => state.asked), before + 1);
            assert.equal(await page.evaluate(() => state.history.at(-1).correct), kind === 'correct');
            const question = await page.locator('#questionText').textContent();
            await page.waitForTimeout(1700);
            assert.equal(await page.locator('#questionText').textContent(), question);
            await page.click('#solutionBtn'); await page.click('#solutionBtn');
            await page.evaluate(() => { togglePause(); togglePause(); applyMathControl({ ok: true, version: 1, locked: false, questionLimit: 0 }); submitChoice(current.answer); submitAnswer(true); });
            assert.equal(await page.evaluate(() => state.asked), before + 1);
            assert.equal(await page.locator('#choiceGrid button:enabled').count(), 0);
            assert.equal(await page.locator('#skipBtn').isDisabled(), true);
            await page.click('#nextProblemBtn');
            assert.equal(await page.locator('#solutionPanel').isVisible(), false);
            assert.equal(await page.locator('#solutionSteps').textContent(), '');
            assert.equal(await page.locator('#solutionBtn').getAttribute('aria-expanded'), 'false');
        }
    });
    test(name + ': reading pauses timer without changing counters and preserves manual pause', async t => {
        const { page } = await open(t, engine);
        await page.evaluate(() => { startedAt = Date.now() - 4000; render(); });
        await page.click('#solutionBtn');
        const seconds = await page.evaluate(() => elapsedSeconds());
        const before = await page.evaluate(() => ({ state: JSON.stringify(state), storage: JSON.stringify(localStorage) }));
        await page.waitForTimeout(2100);
        assert.equal(await page.evaluate(() => elapsedSeconds()), seconds, '풀이 읽는 시간은 제외');
        await page.evaluate(() => { submitChoice(current.answer); submitAnswer(true); });
        assert.deepEqual(await page.evaluate(() => ({ state: JSON.stringify(state), storage: JSON.stringify(localStorage) })), before);
        await page.click('#solutionBtn');
        assert.equal(await page.locator('#choiceGrid button:enabled').count(), 4);
        await page.click('#pauseBtn');
        await page.click('#solutionBtn'); await page.click('#solutionBtn');
        assert.equal(await page.evaluate(() => paused), true);
        assert.equal(await page.locator('#choiceGrid button:enabled').count(), 0);
        await page.click('#pauseBtn');
        await page.evaluate(() => submitChoice(current.answer));
        assert(await page.evaluate(() => state.history[0].seconds < 6));
    });
    test(name + ': central and quota locks block solution and next including direct calls', async t => {
        const { page } = await open(t, engine);
        await page.evaluate(() => submitAnswer(true));
        const question = await page.locator('#questionText').textContent();
        await page.evaluate(() => applyMathControl({ ok: true, locked: true, version: 2, questionLimit: 0 }));
        for (const id of ['solutionBtn', 'nextProblemBtn']) assert.equal(await page.locator('#' + id).isDisabled(), true);
        await page.evaluate(() => { toggleSolution(); nextProblem(); });
        assert.equal(await page.locator('#solutionPanel').isVisible(), false);
        assert.equal(await page.locator('#questionText').textContent(), question);
        await page.evaluate(() => applyMathControl({ ok: true, locked: false, version: 3, questionLimit: 1 }));
        await page.evaluate(() => { toggleSolution(); nextProblem(); });
        assert.equal(await page.locator('#questionText').textContent(), question);
        for (const id of ['solutionBtn', 'nextProblemBtn']) assert.equal(await page.locator('#' + id).isDisabled(), true);
        assert.equal(await page.locator('#choiceGrid button:enabled').count(), 0);
    });
    test(name + ': saved game waits through server lock then resumes when a status poll unlocks', async t => {
        const { page } = await open(t, engine);
        await page.evaluate(() => { submitAnswer(true); goMenu(); applyMathControl({ ok: true, locked: true, version: 2, questionLimit: 0 }); resumeGame(); });
        assert.equal(await page.evaluate(() => current), null);
        await page.evaluate(() => applyMathControl({ ok: true, locked: false, version: 3, questionLimit: 0 }));
        assert.equal(await page.locator('#choiceGrid button:enabled').count(), 4);
        assert.equal(await page.locator('#solutionBtn').isDisabled(), false);
    });
    test(name + ': menu, reset and real JSON import clear previous solution content', async t => {
        const { page } = await open(t, engine);
        page.on('dialog', dialog => dialog.accept());
        for (const action of ['menu', 'reset', 'import']) {
            await page.click('#solutionBtn');
            assert.equal(await page.locator('#solutionPanel').isVisible(), true);
            if (action === 'menu') await page.click('#menuBtn');
            if (action === 'reset') await page.click('#resetBtn');
            if (action === 'import') {
                const backup = await page.evaluate(() => ({ format: 'aaaa-game-backup', version: 1, game: 'math-level', data: validateMathTransfer({ progress: state, startLevel: Number($('startLevel').value) }) }));
                await page.locator('#game-import-file').setInputFiles({ name: 'math.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
                await page.waitForFunction(() => $('game-transfer-status').textContent === '게임 데이터를 불러왔습니다.');
            }
            assert.equal(await page.locator('#solutionPanel').isVisible(), false);
            assert.equal(await page.locator('#solutionSteps').textContent(), '');
            assert.equal(await page.locator('#solutionAnswer').textContent(), '');
            assert.equal(await page.locator('#solutionBtn').getAttribute('aria-expanded'), 'false');
            assert.equal(await page.locator('#nextProblemBtn').isDisabled(), true);
            if (action !== 'import') await page.click('#startBtn');
        }
    });
    test(name + ': solution opens inline before answer, safely, with responsive full-width vertical flow', async t => {
        const { page, context } = await open(t, engine);
        assert.equal(await page.locator('#solutionBtn').count(), 1, '풀이과정 버튼이 필요합니다');
        assert.equal(await page.locator('#solutionBtn').textContent(), '풀이과정');
        assert.equal(await page.locator('#solutionBtn').getAttribute('aria-controls'), 'solutionPanel');
        assert.equal(await page.locator('#solutionPanel').isVisible(), false);
        const before = await page.evaluate(() => ({ state: JSON.stringify(state), storage: JSON.stringify(localStorage) }));
        await page.click('#solutionBtn');
        assert.equal(await page.locator('#solutionBtn').getAttribute('aria-expanded'), 'true');
        assert.equal(await page.locator('#solutionPanel').isVisible(), true);
        assert.equal(await page.locator('#solutionPanel ol li').count(), 3);
        assert.match(await page.locator('#solutionPanel').textContent(), /정답:/);
        assert.equal(await page.locator('#solutionPanel img').count(), 0);
        assert.equal(await page.evaluate(() => window.xss), undefined);
        assert.equal(await page.locator('#solutionAnswer').textContent(), await page.evaluate(() => '정답: ' + fmt(current.answer)));
        assert.deepEqual(await page.evaluate(() => ({ state: JSON.stringify(state), storage: JSON.stringify(localStorage) })), before);
        for (const width of [320, 390, 768, 1280]) {
            await page.setViewportSize({ width, height: 844 });
            const geometry = await page.evaluate(() => {
                const b = $('solutionBtn').getBoundingClientRect(), p = $('solutionPanel').getBoundingClientRect(), tools = document.querySelector('.play-tools').getBoundingClientRect();
                return { overflow: document.documentElement.scrollWidth > innerWidth, below: b.top >= tools.bottom && p.top >= b.bottom, full: Math.abs(b.width - p.width) < 1, font: parseFloat(getComputedStyle($('solutionPanel')).fontSize), line: parseFloat(getComputedStyle($('solutionPanel')).lineHeight) };
            });
            assert.equal(geometry.overflow, false); assert(geometry.below); assert(geometry.full); assert(geometry.font >= 14 && geometry.font <= 16); assert(geometry.line >= geometry.font * 1.8 - 0.1);
        }
        await page.click('#solutionBtn');
        assert.equal(await page.locator('#solutionPanel').isVisible(), false);
        assert.equal(await page.locator('#solutionBtn').getAttribute('aria-expanded'), 'false');
        assert.equal(context.pages().length, 1);
    });
}
