import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  STORAGE_KEY,
  addDays,
  defaultSettings,
  durationMs,
  playChime,
  todayKey,
  uid,
} from './lib'
import type { AppState, Mode, Settings } from './types'

function freshTimer(settings: Settings = defaultSettings): AppState['timer'] {
  return {
    mode: 'focus',
    running: false,
    remainingMs: durationMs('focus', settings),
    anchor: null,
    cycleCount: 0,
  }
}

function emptyState(): AppState {
  return {
    settings: { ...defaultSettings },
    tasks: [],
    activeTaskId: null,
    timer: freshTimer(),
    days: {},
    lastFocusDate: null,
    streak: 0,
    bestStreak: 0,
  }
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<AppState>
    const settings = { ...defaultSettings, ...parsed.settings }
    return {
      ...emptyState(),
      ...parsed,
      settings,
      tasks: parsed.tasks ?? [],
      days: parsed.days ?? {},
      timer: {
        ...freshTimer(settings),
        ...parsed.timer,
        remainingMs: parsed.timer?.remainingMs ?? durationMs(parsed.timer?.mode ?? 'focus', settings),
      },
    }
  } catch {
    return emptyState()
  }
}

function remainingNow(timer: AppState['timer'], now: number): number {
  if (!timer.running || !timer.anchor) return timer.remainingMs
  return Math.max(0, timer.remainingMs - (now - timer.anchor))
}

function recordFocus(state: AppState, elapsedMs: number, now: number): AppState {
  const seconds = Math.max(0, Math.round(elapsedMs / 1000))
  if (seconds < 5) return state

  const day = todayKey(new Date(now))
  const prev = state.days[day] ?? { seconds: 0, sessions: 0 }
  const sessions = seconds >= 60 ? prev.sessions + 1 : prev.sessions

  let streak = state.streak
  let lastFocusDate = state.lastFocusDate
  if (state.lastFocusDate !== day) {
    streak = state.lastFocusDate === addDays(day, -1) ? state.streak + 1 : 1
    lastFocusDate = day
  }

  const tasks = state.tasks.map((task) =>
    task.id === state.activeTaskId && seconds >= 60
      ? { ...task, pomodoros: task.pomodoros + 1 }
      : task,
  )

  return {
    ...state,
    days: { ...state.days, [day]: { seconds: prev.seconds + seconds, sessions } },
    lastFocusDate,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    tasks,
  }
}

function nextMode(state: AppState): Mode {
  return state.timer.mode === 'focus' ? 'shortBreak' : 'focus'
}

function switchMode(state: AppState, mode: Mode): AppState {
  const cycleCount =
    state.timer.mode === 'focus' && mode !== 'focus'
      ? state.timer.cycleCount + 1
      : mode === 'focus'
        ? state.timer.cycleCount
        : state.timer.cycleCount

  return {
    ...state,
    timer: {
      mode,
      running: false,
      remainingMs: durationMs(mode, state.settings),
      anchor: null,
      cycleCount,
    },
  }
}

function finishPhase(state: AppState, now: number): AppState {
  const elapsed = durationMs(state.timer.mode, state.settings) - remainingNow(state.timer, now)
  const withStats =
    state.timer.mode === 'focus' ? recordFocus(state, elapsed, now) : state
  return switchMode(withStats, nextMode(withStats))
}

export function useFocusTrack() {
  const [state, setState] = useState<AppState>(loadState)
  const [now, setNow] = useState(() => Date.now())
  const finishing = useRef(false)

  const remaining = remainingNow(state.timer, now)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    if (!state.timer.running) return
    const id = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [state.timer.running])

  useEffect(() => {
    if (!state.timer.running || remaining > 0 || finishing.current) return
    finishing.current = true
    playChime()
    setState((s) => finishPhase(s, Date.now()))
    finishing.current = false
  }, [remaining, state.timer.running])

  useEffect(() => {
    const sync = () => setNow(Date.now())
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('focus', sync)
    }
  }, [])

  const start = useCallback(() => {
    setNow(Date.now())
    setState((s) => ({
      ...s,
      timer: { ...s.timer, running: true, anchor: Date.now() },
    }))
  }, [])

  const pause = useCallback(() => {
    const t = Date.now()
    setNow(t)
    setState((s) => ({
      ...s,
      timer: {
        ...s.timer,
        running: false,
        remainingMs: remainingNow(s.timer, t),
        anchor: null,
      },
    }))
  }, [])

  const reset = useCallback(() => {
    setState((s) => ({
      ...s,
      timer: {
        ...s.timer,
        running: false,
        remainingMs: durationMs(s.timer.mode, s.settings),
        anchor: null,
      },
    }))
  }, [])

  const skip = useCallback(() => {
    playChime()
    setState((s) => finishPhase(s, Date.now()))
  }, [])

  const setPhase = useCallback((phase: 'focus' | 'break') => {
    setState((s) => {
      const mode: Mode = phase === 'focus' ? 'focus' : 'shortBreak'
      if (s.timer.mode === mode) return s
      return {
        ...s,
        timer: {
          ...s.timer,
          mode,
          running: false,
          remainingMs: durationMs(mode, s.settings),
          anchor: null,
        },
      }
    })
  }, [])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => {
      const settings = { ...s.settings, ...patch }
      const running = s.timer.running
      return {
        ...s,
        settings,
        timer: running
          ? s.timer
          : {
              ...s.timer,
              remainingMs: durationMs(s.timer.mode, settings),
            },
      }
    })
  }, [])

  const addTask = useCallback((title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return
    const task = {
      id: uid(),
      title: trimmed,
      done: false,
      createdAt: Date.now(),
      pomodoros: 0,
    }
    setState((s) => ({
      ...s,
      tasks: [task, ...s.tasks],
      activeTaskId: s.activeTaskId ?? task.id,
    }))
  }, [])

  const toggleTask = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task)),
    }))
  }, [])

  const removeTask = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      tasks: s.tasks.filter((task) => task.id !== id),
      activeTaskId: s.activeTaskId === id ? null : s.activeTaskId,
    }))
  }, [])

  const selectTask = useCallback((id: string) => {
    setState((s) => ({ ...s, activeTaskId: s.activeTaskId === id ? null : id }))
  }, [])

  const today = todayKey()
  const weekKeys = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)), [today])
  const todaySeconds = state.days[today]?.seconds ?? 0
  const weekSeconds = weekKeys.reduce((sum, key) => sum + (state.days[key]?.seconds ?? 0), 0)
  const todaySessions = state.days[today]?.sessions ?? 0
  const goalRatio = Math.min(1, todaySeconds / (state.settings.dailyGoalMinutes * 60 || 1))

  return {
    state,
    remaining,
    todaySeconds,
    weekSeconds,
    todaySessions,
    weekKeys,
    goalRatio,
    start,
    pause,
    reset,
    skip,
    setPhase,
    updateSettings,
    addTask,
    toggleTask,
    removeTask,
    selectTask,
  }
}
