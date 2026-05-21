import { describe, it, expect } from 'vitest'
import { makeDoctorDragId, parseDoctorDragId } from '../components/DoctorDragSource'
import { makeRotationDropId, parseRotationDropId } from '../components/RotationGrid'

describe('makeDoctorDragId / parseDoctorDragId', () => {
  it('roundtrip ergibt ursprüngliche ID', () => {
    expect(parseDoctorDragId(makeDoctorDragId(42))).toBe(42)
    expect(parseDoctorDragId(makeDoctorDragId(1))).toBe(1)
  })

  it('parst gültige Doctor-IDs korrekt', () => {
    expect(parseDoctorDragId('doctor-7')).toBe(7)
    expect(parseDoctorDragId('doctor-100')).toBe(100)
  })

  it('gibt null für falsches Präfix zurück', () => {
    expect(parseDoctorDragId('rotation-7-2026-05-01')).toBeNull()
    expect(parseDoctorDragId('')).toBeNull()
    expect(parseDoctorDragId('7')).toBeNull()
  })

  it('gibt null für nicht-numerisches Suffix zurück', () => {
    expect(parseDoctorDragId('doctor-abc')).toBeNull()
    expect(parseDoctorDragId('doctor-NaN')).toBeNull()
  })
})

describe('makeRotationDropId / parseRotationDropId', () => {
  it('roundtrip ergibt ursprüngliche Werte', () => {
    const result = parseRotationDropId(makeRotationDropId(10, '2026-05-20'))
    expect(result).toEqual({ departmentId: 10, day: '2026-05-20' })
  })

  it('parst Datum korrekt trotz Bindestrichen im Datum', () => {
    const result = parseRotationDropId('rotation-99-2026-01-15')
    expect(result).toEqual({ departmentId: 99, day: '2026-01-15' })
  })

  it('ID-Format ist rotation-{deptId}-{date}', () => {
    expect(makeRotationDropId(5, '2026-06-01')).toBe('rotation-5-2026-06-01')
  })

  it('gibt null für falsches Präfix zurück', () => {
    expect(parseRotationDropId('doctor-1')).toBeNull()
    expect(parseRotationDropId('')).toBeNull()
    expect(parseRotationDropId('10-2026-05-20')).toBeNull()
  })

  it('gibt null für nicht-numerische departmentId zurück', () => {
    expect(parseRotationDropId('rotation-abc-2026-05-20')).toBeNull()
  })

  it('gibt null wenn kein Trennzeichen nach Präfix vorhanden', () => {
    expect(parseRotationDropId('rotation-')).toBeNull()
  })

  it('Drop-ID eines Arztes wird nicht als Rotation-Drop-ID geparst', () => {
    expect(parseRotationDropId(makeDoctorDragId(42))).toBeNull()
  })

  it('Rotation-Drop-ID wird nicht als Doctor-Drag-ID geparst', () => {
    expect(parseDoctorDragId(makeRotationDropId(10, '2026-05-20'))).toBeNull()
  })
})
