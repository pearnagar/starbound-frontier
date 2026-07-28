/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const FORBIDDEN_IMPORTS = ['react', 'react-dom', 'zustand', 'pixi.js', 'howler', 'idb'] as const

// import.meta.url isn't a reliable file:// URL under every Vitest transform,
// so resolve the domain folder relative to the project root instead.
const domainDir = join(process.cwd(), 'src', 'game', 'domain')

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry)
    if (statSync(fullPath).isDirectory()) {
      return collectSourceFiles(fullPath)
    }
    return /\.tsx?$/.test(entry) ? [fullPath] : []
  })
}

describe('domain purity', () => {
  it('does not import React, Zustand, PixiJS, Howler, or idb', () => {
    const offenders: string[] = []

    for (const file of collectSourceFiles(domainDir)) {
      const content = readFileSync(file, 'utf-8')
      for (const forbidden of FORBIDDEN_IMPORTS) {
        const importPattern = new RegExp(`from\\s+["']${forbidden.replace('.', '\\.')}(["'/])`)
        if (importPattern.test(content)) {
          offenders.push(`${file} imports "${forbidden}"`)
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
