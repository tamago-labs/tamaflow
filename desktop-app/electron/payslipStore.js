// Payslip template store — persists templates at userData/payslip-templates.json.
// Same pattern as companyStore.js.

const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const REGISTRY_FILE = 'payslip-templates.json'

class PayslipStore {
  constructor() {
    const userDataPath = app.getPath('userData')
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true })
    }
    this.filePath = path.join(userDataPath, REGISTRY_FILE)
    this.templates = []
    this._load()
  }

  _load() {
    if (!fs.existsSync(this.filePath)) {
      this.templates = []
      return
    }
    try {
      const data = fs.readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(data)
      if (parsed && Array.isArray(parsed.templates)) {
        this.templates = parsed.templates
      }
    } catch (err) {
      console.error('[PayslipStore] Failed to load templates:', err)
      this.templates = []
    }
  }

  list() {
    return this.templates
  }

  get(id) {
    return this.templates.find((t) => t.id === id) || null
  }

  save(template) {
    const idx = this.templates.findIndex((t) => t.id === template.id)
    if (idx >= 0) {
      this.templates[idx] = { ...template, updatedAt: new Date().toISOString() }
    } else {
      this.templates.push({
        ...template,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    }
    this._atomicWrite()
    return template
  }

  remove(id) {
    this.templates = this.templates.filter((t) => t.id !== id)
    this._atomicWrite()
  }

  _atomicWrite() {
    const file = { version: 1, templates: this.templates }
    const tmpPath = `${this.filePath}.tmp`
    fs.writeFileSync(tmpPath, JSON.stringify(file, null, 2), 'utf-8')
    fs.renameSync(tmpPath, this.filePath)
  }
}

module.exports = { PayslipStore }
