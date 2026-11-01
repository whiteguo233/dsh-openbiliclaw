/**
 * Layout regression tests for the panel strip (issue #15).
 *
 * The panel used to take over the frame's `grid-template-columns` (append a
 * 4th track, restate the center track). That broke hosts/plugins that assume
 * DSH's 3-track frame — ds-bot's team view collapsed `_centerCol` to 0px. These
 * tests pin the new contract with a fake DOM:
 *
 *  - the host's `grid-template-columns` is never written;
 *  - the panel is reserved with `padding-right` and placed absolutely in it;
 *  - the width honours the host's own center floor and the right bar's max;
 *  - a re-rendered (replaced) frame is re-attached, and the old frame's inline
 *    style is restored instead of lingering with a stale strip.
 *
 * @module @openbiliclaw/dsh-plugin/test/layout
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  PanelLayoutController,
  clampPanelWidth,
  findFrame,
  parseGridTracks,
  readShellMetrics,
  reservedPadding,
  trackMax,
  trackMin,
  trackPx,
} from '../src/client/layout.ts'
import { createState } from '../src/client/store.ts'

const HOST_GRID = '280px minmax(400px, 1fr) minmax(0px, 480px)'

/** Minimal element good enough for class/attr lookups and inline styles. */
class FakeElement {
  constructor(tagName) {
    this.tagName = tagName
    this.className = ''
    this.children = []
    this.parentElement = null
    this.style = {}
    this.dataset = {}
    this.width = 0
    this.height = 0
  }

  appendChild(child) {
    child.remove()
    child.parentElement = this
    this.children.push(child)
    return child
  }

  remove() {
    const parent = this.parentElement
    if (parent === null) return
    parent.children = parent.children.filter((candidate) => candidate !== this)
    this.parentElement = null
  }

  addEventListener() {}

  getBoundingClientRect() {
    return { width: this.width, height: this.height, top: 0, left: 0, right: this.width, bottom: this.height }
  }

  querySelector(selector) {
    return queryAll(this, selector)[0] ?? null
  }

  querySelectorAll(selector) {
    return queryAll(this, selector)
  }
}

/** Match the selector shapes layout.ts uses (class-substring / data attrs). */
function matches(element, selector) {
  const classMatch = /\[class\*="([^"]+)"\]/.exec(selector)
  if (classMatch !== null) return String(element.className).includes(classMatch[1])
  const attrMatch = /\[(data-[\w-]+)\]/.exec(selector)
  if (attrMatch !== null) {
    const key = attrMatch[1].replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    return Object.prototype.hasOwnProperty.call(element.dataset, key)
  }
  return false
}

function queryAll(root, selector) {
  const direct = /^\s*:scope\s*>/.test(selector)
  const out = []
  if (direct) {
    for (const child of root.children) if (matches(child, selector)) out.push(child)
    return out
  }
  const visit = (element) => {
    for (const child of element.children) {
      if (matches(child, selector)) out.push(child)
      visit(child)
    }
  }
  visit(root)
  return out
}

/** Fake document: body root, class-attribute queries, containment walk. */
function createDocument() {
  const html = new FakeElement('html')
  const body = new FakeElement('body')
  html.appendChild(body)
  const doc = {
    body,
    documentElement: html,
    createElement: (tagName) => new FakeElement(tagName),
    querySelector: (selector) => queryAll(body, selector)[0] ?? null,
    querySelectorAll: (selector) => queryAll(body, selector),
    contains: (node) => {
      let current = node
      while (current !== null) {
        if (current === body || current === html) return true
        current = current.parentElement
      }
      return false
    },
  }
  return doc
}

/** Observer stubs: instances are recorded so a test can fire them by hand. */
const observers = { mutation: [], resize: [] }

class FakeMutationObserver {
  constructor(callback) {
    this.callback = callback
    this.target = null
    observers.mutation.push(this)
  }

  observe(target) {
    this.target = target
  }

  disconnect() {
    this.target = null
  }

  trigger() {
    if (this.target !== null) this.callback([], this)
  }
}

class FakeResizeObserver {
  constructor(callback) {
    this.callback = callback
    this.target = null
    observers.resize.push(this)
  }

  observe(target) {
    this.target = target
  }

  disconnect() {
    this.target = null
  }

  trigger() {
    if (this.target !== null) this.callback([], this)
  }
}

/** Build the host frame: `_sidebarCol | _centerCol | _rightbarCol`. */
function makeFrame({ width = 1478, grid = HOST_GRID, center = true, details = true } = {}) {
  const frame = new FakeElement('div')
  frame.className = '_frame'
  frame.width = width
  if (grid !== null) frame.style.gridTemplateColumns = grid
  const sidebar = new FakeElement('div')
  sidebar.className = '_sidebarCol'
  frame.appendChild(sidebar)
  if (center) {
    const centerCol = new FakeElement('div')
    centerCol.className = '_centerCol'
    frame.appendChild(centerCol)
  }
  if (details) {
    const rightbar = new FakeElement('div')
    rightbar.className = '_rightbarCol'
    rightbar.width = 480
    frame.appendChild(rightbar)
  }
  return frame
}

/** Install the fake globals and return a mounted controller over `frame`. */
function setup({ frame = makeFrame(), open = true, width = 380, position = 'relative' } = {}) {
  observers.mutation.length = 0
  observers.resize.length = 0
  const doc = createDocument()
  doc.body.appendChild(frame)
  globalThis.document = doc
  globalThis.MutationObserver = FakeMutationObserver
  globalThis.ResizeObserver = FakeResizeObserver
  globalThis.getComputedStyle = (el) => ({
    position: el.computedPosition ?? position,
    paddingTop: el.computedPaddingTop ?? '0px',
    paddingBottom: el.computedPaddingBottom ?? '0px',
  })
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const store = createState({ open, width })
  const controller = new PanelLayoutController(store)
  controller.mount()
  return { doc, frame, store, controller }
}

test('parseGridTracks keeps a minmax() track whole', () => {
  assert.deepEqual(parseGridTracks(HOST_GRID), ['280px', 'minmax(400px, 1fr)', 'minmax(0px, 480px)'])
  assert.deepEqual(parseGridTracks(''), [])
})

test('track helpers read plain px tracks and minmax() bounds', () => {
  assert.equal(trackPx('280px'), 280)
  assert.equal(trackPx('minmax(0px, 480px)'), 0)
  assert.equal(trackMin('minmax(400px, 1fr)'), 400)
  assert.equal(trackMax('minmax(0px, 480px)'), 480)
  assert.equal(trackMin('1fr'), 0)
})

test('readShellMetrics mirrors the host tracks instead of substituting them', () => {
  assert.deepEqual(readShellMetrics(HOST_GRID), { sidebar: 280, center: 400, details: 480 })
  // Right bar closed: the host's own center floor is 0, so nothing is reserved.
  assert.deepEqual(
    readShellMetrics('280px minmax(0px, 1fr) minmax(0px, 0px)'),
    { sidebar: 280, center: 0, details: 0 },
  )
  assert.deepEqual(readShellMetrics(''), { sidebar: 0, center: 0, details: 0 })
})

test('clampPanelWidth honours the host center floor and the right bar max', () => {
  const open = { sidebar: 280, center: 400, details: 480 }
  // 1478 - 280 - 480 - 400 = 318, i.e. the 380 default yields to the floor.
  assert.equal(clampPanelWidth(380, 1478, open), 318)
  // Right bar closed leaves the requested width alone.
  assert.equal(clampPanelWidth(380, 1478, { sidebar: 280, center: 0, details: 0 }), 380)
  // Never above the contract maximum, never below the requested minimum.
  assert.equal(clampPanelWidth(999, 3000, { sidebar: 280, center: 400, details: 0 }), 560)
  assert.equal(clampPanelWidth(100, 1478, { sidebar: 280, center: 0, details: 0 }), 280)
  // Space left for the panel after the right bar's max (40px) is under the
  // usable minimum, so the right bar yields to the panel's 280px floor.
  assert.equal(clampPanelWidth(380, 1200, { sidebar: 280, center: 400, details: 480 }), 280)
  assert.equal(clampPanelWidth(380, 1200, { sidebar: 280, center: 400, details: 0 }), 380)
  // 900 - 280 - 400 = 220 left for the panel, so it shrinks under its own min
  // instead of sliding over the chat column.
  assert.equal(clampPanelWidth(380, 900, { sidebar: 280, center: 400, details: 480 }), 220)
  // Too narrow for sidebar + chat floor + any panel: stay closed.
  assert.equal(clampPanelWidth(380, 600, { sidebar: 280, center: 400, details: 0 }), 0)
})

test('reservedPadding is empty when collapsed', () => {
  assert.equal(reservedPadding(0), '')
  assert.equal(reservedPadding(318.6), '319px')
})

test('attach reserves the strip and never writes the host grid', () => {
  const { frame, controller } = setup()
  // The regression this fix is about: the host's own 3 tracks stay byte-identical.
  assert.equal(frame.style.gridTemplateColumns, HOST_GRID)
  assert.equal(frame.style.paddingRight, '318px')
  assert.equal(frame.style.boxSizing, 'border-box')

  const column = frame.querySelector('[data-obc-panel-col]')
  assert.ok(column !== null, 'panel column is appended to the frame')
  assert.equal(column.parentElement, frame)
  assert.equal(column.style.position, 'absolute')
  assert.equal(column.style.right, '0')
  assert.equal(column.style.width, '318px')
  assert.equal(column.style.visibility, 'visible')

  const handle = frame.querySelector('[class*="obc-panel-handle"]')
  assert.equal(handle.style.left, '1160px')
  assert.equal(handle.style.display, 'block')
  controller.dispose()
})

test('closing the panel releases the strip and hides the column', () => {
  const { frame, controller } = setup()
  controller.setOpen(false)
  assert.equal(frame.style.paddingRight, '')
  const column = frame.querySelector('[data-obc-panel-col]')
  assert.equal(column.style.width, '0px')
  assert.equal(column.style.visibility, 'hidden')
  assert.equal(frame.querySelector('[class*="obc-panel-handle"]').style.display, 'none')
  controller.dispose()
})

test('a replaced frame is re-attached and the old frame style restored', () => {
  const { frame, doc, controller } = setup()
  const oldColumn = frame.querySelector('[data-obc-panel-col]')
  frame.remove()
  const replacement = makeFrame()
  doc.body.appendChild(replacement)
  for (const observer of observers.mutation) observer.trigger()

  assert.equal(replacement.style.paddingRight, '318px')
  assert.equal(replacement.style.gridTemplateColumns, HOST_GRID)
  const newColumn = replacement.querySelector('[data-obc-panel-col]')
  assert.ok(newColumn !== null)
  assert.notEqual(newColumn, oldColumn)
  assert.equal(newColumn.style.width, '318px')
  // The detached frame must not keep a strip it no longer shows.
  assert.equal(frame.style.paddingRight, '')
  assert.equal(frame.querySelector('[data-obc-panel-col]'), null)
  controller.dispose()
})

test('a static frame becomes the containing block; dispose restores it', () => {
  const { frame, controller } = setup({ position: 'static' })
  assert.equal(frame.style.position, 'relative')
  controller.dispose()
  assert.equal(frame.style.position, '')
  assert.equal(frame.style.paddingRight, '')
})

test('resize re-clamps the strip without touching the host grid', () => {
  const { frame, controller } = setup()
  frame.width = 1600
  for (const observer of observers.resize) observer.trigger()
  // 1600 - 280 - 480 - 400 = 440 > 380, so the requested width fits.
  assert.equal(frame.style.paddingRight, '380px')
  assert.equal(frame.style.gridTemplateColumns, HOST_GRID)
  controller.dispose()
})

test('the column leaves the frame padding and the bottom row uncovered', () => {
  const frame = makeFrame()
  frame.computedPaddingTop = '32px'
  const bottomRow = new FakeElement('div')
  bottomRow.className = '_bottomRow'
  bottomRow.dataset.shellBottom = 'true'
  bottomRow.height = 24
  frame.appendChild(bottomRow)
  const { controller } = setup({ frame })
  const column = frame.querySelector('[data-obc-panel-col]')
  // An absolute child is offset from the padding box, so the Windows titlebar
  // padding and a filled shell.bottom slot have to be re-applied by hand.
  assert.equal(column.style.top, '32px')
  assert.equal(column.style.bottom, '24px')
  controller.dispose()
})

test('findFrame ignores a sidebarCol in a view without a centerCol', () => {
  const doc = createDocument()
  globalThis.document = doc
  const decoy = new FakeElement('div')
  decoy.className = '_dsbotView'
  const decoySidebar = new FakeElement('div')
  decoySidebar.className = '_sidebarCol'
  decoy.appendChild(decoySidebar)
  doc.body.appendChild(decoy)
  const frame = makeFrame()
  doc.body.appendChild(frame)
  assert.equal(findFrame(), frame)
})
