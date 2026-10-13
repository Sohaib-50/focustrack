export type Mode = 'focus' | 'shortBreak' | 'longBreak'

export interface Settings {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakEvery: number
  dailyGoalMinutes: number
}

export interface Task {
  id: string
  title: string
  done: boolean
  createdAt: number
  pomodoros: number
}

export interface DayStat {
  seconds: number
  sessions: number
}

export interface TimerState {
  mode: Mode
  running: boolean
  remainingMs: number
  anchor: number | null
  cycleCount: number
}

export interface AppState {
  settings: Settings
  tasks: Task[]
  activeTaskId: string | null
  timer: TimerState
  days: Record<string, DayStat>
  lastFocusDate: string | null
  streak: number
  bestStreak: number
}
