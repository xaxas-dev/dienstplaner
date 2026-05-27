import { describe, it, expect } from 'vitest'
import { makeDoctorDragId, parseDoctorDragId } from '../components/DoctorDragSource'
import { makeBereichHeaderDropId, parseBereichHeaderDropId } from '../components/BereichHeaderRow'
import { makeShiftTypeDragId, parseShiftTypeDragId } from '../components/ShiftTypeDragBar'

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
    expect(parseDoctorDragId('rotation-header-7')).toBeNull()
    expect(parseDoctorDragId('')).toBeNull()
    expect(parseDoctorDragId('7')).toBeNull()
  })

  it('gibt null für nicht-numerisches Suffix zurück', () => {
    expect(parseDoctorDragId('doctor-abc')).toBeNull()
    expect(parseDoctorDragId('doctor-NaN')).toBeNull()
  })
})

describe('makeBereichHeaderDropId / parseBereichHeaderDropId', () => {
  it('roundtrip ergibt ursprüngliche departmentId', () => {
    expect(parseBereichHeaderDropId(makeBereichHeaderDropId(10))).toBe(10)
    expect(parseBereichHeaderDropId(makeBereichHeaderDropId(99))).toBe(99)
  })

  it('ID-Format ist rotation-header-{deptId}', () => {
    expect(makeBereichHeaderDropId(5)).toBe('rotation-header-5')
  })

  it('parst gültige Header-Drop-IDs korrekt', () => {
    expect(parseBereichHeaderDropId('rotation-header-7')).toBe(7)
    expect(parseBereichHeaderDropId('rotation-header-100')).toBe(100)
  })

  it('gibt null für falsches Präfix zurück', () => {
    expect(parseBereichHeaderDropId('doctor-1')).toBeNull()
    expect(parseBereichHeaderDropId('')).toBeNull()
    expect(parseBereichHeaderDropId('10')).toBeNull()
  })

  it('gibt null für nicht-numerische departmentId zurück', () => {
    expect(parseBereichHeaderDropId('rotation-header-abc')).toBeNull()
  })

  it('Doctor-Drag-ID wird nicht als Bereich-Header-Drop-ID geparst', () => {
    expect(parseBereichHeaderDropId(makeDoctorDragId(42))).toBeNull()
  })

  it('Bereich-Header-Drop-ID wird nicht als Doctor-Drag-ID geparst', () => {
    expect(parseDoctorDragId(makeBereichHeaderDropId(10))).toBeNull()
  })
})

describe('makeShiftTypeDragId / parseShiftTypeDragId', () => {
  it('roundtrip ergibt ursprüngliche shiftTypeId', () => {
    expect(parseShiftTypeDragId(makeShiftTypeDragId(1))).toBe(1)
    expect(parseShiftTypeDragId(makeShiftTypeDragId(42))).toBe(42)
  })

  it('ID-Format ist shift-{shiftTypeId}', () => {
    expect(makeShiftTypeDragId(3)).toBe('shift-3')
  })

  it('parst gültige ShiftType-IDs korrekt', () => {
    expect(parseShiftTypeDragId('shift-7')).toBe(7)
    expect(parseShiftTypeDragId('shift-100')).toBe(100)
  })

  it('gibt null für falsches Präfix zurück', () => {
    expect(parseShiftTypeDragId('doctor-1')).toBeNull()
    expect(parseShiftTypeDragId('rotation-header-1')).toBeNull()
    expect(parseShiftTypeDragId('')).toBeNull()
  })

  it('gibt null für nicht-numerisches Suffix zurück', () => {
    expect(parseShiftTypeDragId('shift-abc')).toBeNull()
    expect(parseShiftTypeDragId('shift-NaN')).toBeNull()
  })

  it('ShiftType-Drag-ID wird nicht als Doctor-Drag-ID geparst', () => {
    expect(parseDoctorDragId(makeShiftTypeDragId(3))).toBeNull()
  })
})
