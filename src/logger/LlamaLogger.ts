type Log = Record<string, any> // Replace 'any' with the correct type

export default class LlamaLogger {
  private _logs: Log[]
  private _metadata: Log

  constructor() {
    this._logs = []
    this._metadata = {}
  }

  reset(): void {
    this._logs = []
  }

  setMetadata(metadata: Log): void {
    this._metadata = { ...this._metadata, ...metadata }
  }

  unsetMetadata(metadataKeys: Set<string>): void {
    for (const key of metadataKeys) {
      delete this._metadata[key]
    }
  }

  getMetadata(): Log {
    return this._metadata
  }

  addLog(log: Log): void {
    const updatedLog: Log = { ...this._metadata, ...log }
    this._logs.push(updatedLog)
  }

  getLogs(): Log[] {
    return this._logs
  }
}
