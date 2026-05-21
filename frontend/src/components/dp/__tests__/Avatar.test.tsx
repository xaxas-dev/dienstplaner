import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Avatar } from '../Avatar'

describe('Avatar', () => {
  it('zeigt shortName vor generierten Initialen', () => {
    render(<Avatar name="Dr. Anna Berger" shortName="AB" id={1} />)

    expect(screen.getByText('AB')).toBeInTheDocument()
    expect(screen.queryByText('DA')).not.toBeInTheDocument()
  })

  it('generiert Initialen ohne akademische Titel', () => {
    render(<Avatar name="Dr. Anna Berger" id={1} />)

    expect(screen.getByText('AB')).toBeInTheDocument()
  })

  it('ignoriert PD beim Initialen-Fallback', () => {
    render(<Avatar name="PD Max Meyer" id={1} />)

    expect(screen.getByText('MM')).toBeInTheDocument()
  })
})
