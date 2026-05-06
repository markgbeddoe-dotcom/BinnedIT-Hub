import { describe, it, expect } from 'vitest'
import {
  canTransition,
  nextAllowedActions,
  isActionAllowed,
  JOB_STATES,
  ACTIVE_STATUSES,
} from './jobStateMachine'

describe('canTransition — raw forward-edge graph', () => {
  it('allows pending → en_route', () => {
    expect(canTransition('pending', 'en_route')).toBe(true)
  })

  it('allows en_route → arrived', () => {
    expect(canTransition('en_route', 'arrived')).toBe(true)
  })

  it('allows arrived → in_progress', () => {
    expect(canTransition('arrived', 'in_progress')).toBe(true)
  })

  it('allows in_progress → completed', () => {
    expect(canTransition('in_progress', 'completed')).toBe(true)
  })

  it('forbids skipping arrived (en_route → in_progress)', () => {
    expect(canTransition('en_route', 'in_progress')).toBe(false)
  })

  it('forbids backwards transitions (completed → in_progress)', () => {
    expect(canTransition('completed', 'in_progress')).toBe(false)
  })

  it('treats legacy "scheduled" as pre-en_route', () => {
    expect(canTransition('scheduled', 'en_route')).toBe(true)
  })
})

describe('nextAllowedActions — en_route → arrived requires checklist', () => {
  it('blocks mark_arrived when checklist not done', () => {
    const actions = nextAllowedActions('en_route', {
      hasDeliveryPhoto: false,
      checklistDoneToday: false,
    })
    const arrive = actions.find(a => a.target === 'arrived')
    expect(arrive).toBeDefined()
    expect(arrive.blocked).toBe(true)
    expect(arrive.reason).toMatch(/checklist/i)
  })

  it('allows mark_arrived when checklist done', () => {
    const actions = nextAllowedActions('en_route', {
      hasDeliveryPhoto: false,
      checklistDoneToday: true,
    })
    const arrive = actions.find(a => a.target === 'arrived')
    expect(arrive).toBeDefined()
    expect(arrive.blocked).toBe(false)
  })
})

describe('nextAllowedActions — arrived → in_progress', () => {
  it('always allows start_job from arrived (no extra gate)', () => {
    const actions = nextAllowedActions('arrived', {
      hasDeliveryPhoto: false,
      checklistDoneToday: true,
    })
    const start = actions.find(a => a.target === 'in_progress')
    expect(start).toBeDefined()
    expect(start.blocked).toBe(false)
  })

  it('does NOT offer a complete_job action directly from arrived', () => {
    const actions = nextAllowedActions('arrived', {
      hasDeliveryPhoto: true,
      checklistDoneToday: true,
    })
    expect(actions.find(a => a.target === 'completed')).toBeUndefined()
  })
})

describe('nextAllowedActions — in_progress → completed requires delivery photo', () => {
  it('blocks complete_job when no delivery photo', () => {
    const actions = nextAllowedActions('in_progress', {
      hasDeliveryPhoto: false,
      checklistDoneToday: true,
    })
    const complete = actions.find(a => a.target === 'completed')
    expect(complete).toBeDefined()
    expect(complete.blocked).toBe(true)
    expect(complete.reason).toMatch(/delivery photo/i)
  })

  it('allows complete_job when delivery photo present', () => {
    const actions = nextAllowedActions('in_progress', {
      hasDeliveryPhoto: true,
      checklistDoneToday: true,
    })
    const complete = actions.find(a => a.target === 'completed')
    expect(complete).toBeDefined()
    expect(complete.blocked).toBe(false)
  })
})

describe('isActionAllowed — convenience wrapper', () => {
  it('returns false when action is gated', () => {
    expect(
      isActionAllowed('en_route', 'arrived', { checklistDoneToday: false })
    ).toBe(false)
  })

  it('returns true when both gates pass', () => {
    expect(
      isActionAllowed('in_progress', 'completed', { hasDeliveryPhoto: true })
    ).toBe(true)
  })

  it('returns false for an invalid (skipping) transition', () => {
    expect(
      isActionAllowed('arrived', 'completed', {
        hasDeliveryPhoto: true,
        checklistDoneToday: true,
      })
    ).toBe(false)
  })
})

describe('terminal states emit no actions', () => {
  it('completed → []', () => {
    expect(nextAllowedActions('completed', { hasDeliveryPhoto: true })).toEqual([])
  })

  it('cancelled → []', () => {
    expect(nextAllowedActions('cancelled')).toEqual([])
  })
})

describe('exported constants', () => {
  it('JOB_STATES contains the new lifecycle members', () => {
    expect(JOB_STATES.EN_ROUTE).toBe('en_route')
    expect(JOB_STATES.ARRIVED).toBe('arrived')
    expect(JOB_STATES.IN_PROGRESS).toBe('in_progress')
    expect(JOB_STATES.COMPLETED).toBe('completed')
  })

  it('ACTIVE_STATUSES includes en_route + arrived', () => {
    expect(ACTIVE_STATUSES).toContain('en_route')
    expect(ACTIVE_STATUSES).toContain('arrived')
    expect(ACTIVE_STATUSES).not.toContain('completed')
    expect(ACTIVE_STATUSES).not.toContain('cancelled')
  })
})
