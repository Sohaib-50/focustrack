import { useEffect, useState, type FormEvent } from 'react'
import { durationMs, formatClock, formatMinutes, weekdayLabel } from './lib'
import { useFocusTrack } from './store'

function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
}) {
  return (
    <div className="stepper">
      <span>{label}</span>
      <button type="button" onClick={() => onChange(Math.max(min, value - step))} aria-label={`Decrease ${label}`}>
        −
      </button>
      <em>{value}</em>
      <button type="button" onClick={() => onChange(Math.min(max, value + step))} aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  )
}

export default function App() {
  const app = useFocusTrack()
  const [draft, setDraft] = useState('')
  const { state, remaining } = app
  const total = durationMs(state.timer.mode, state.settings)
  const progress = Math.min(1, Math.max(0, 1 - remaining / total))
  const onBreak = state.timer.mode !== 'focus'
  const activeTask = state.tasks.find((task) => task.id === state.activeTaskId && !task.done)
  const size = 268
  const stroke = 4
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const maxWeek = Math.max(1, ...app.weekKeys.map((key) => state.days[key]?.seconds ?? 0))

  useEffect(() => {
    document.title = state.timer.running
      ? `${formatClock(remaining)} · FocusTrack`
      : 'FocusTrack'
  }, [remaining, state.timer.running])

  function onAdd(event: FormEvent) {
    event.preventDefault()
    app.addTask(draft)
    setDraft('')
  }

  return (
    <div className="app">
      <header className="top">
        <p className="logo">FocusTrack</p>
        <p className="goal-copy">
          {Math.round(app.todaySeconds / 60)}/{state.settings.dailyGoalMinutes}m
        </p>
      </header>
      <div className="goal-track" aria-label="Daily goal progress">
        <div className="goal-fill" style={{ width: `${app.goalRatio * 100}%` }} />
      </div>

      <section className="timer">
        <div className="modes">
          <button type="button" className={!onBreak ? 'on' : undefined} onClick={() => app.setPhase('focus')}>
            Focus
          </button>
          <button type="button" className={onBreak ? 'on' : undefined} onClick={() => app.setPhase('break')}>
            Break
          </button>
        </div>

        <div className="ring" data-break={onBreak}>
          <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
            <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
            <circle
              className="ring-progress"
              cx={size / 2}
              cy={size / 2}
              r={r}
              strokeWidth={stroke}
              strokeDasharray={c}
              strokeDashoffset={c * (1 - progress)}
            />
          </svg>
          <p className="clock">{formatClock(remaining)}</p>
        </div>

        {activeTask && <p className="now">{activeTask.title}</p>}

        <button className="primary" type="button" onClick={state.timer.running ? app.pause : app.start}>
          {state.timer.running ? 'Pause' : remaining === total ? 'Start' : 'Resume'}
        </button>
        <div className="quiet-actions">
          <button type="button" onClick={app.reset}>
            Reset
          </button>
        </div>

        <div className="prefs">
          <Stepper
            label="Focus"
            value={state.settings.focusMinutes}
            min={1}
            max={90}
            onChange={(focusMinutes) => app.updateSettings({ focusMinutes })}
          />
          <Stepper
            label="Break"
            value={state.settings.shortBreakMinutes}
            min={1}
            max={30}
            onChange={(shortBreakMinutes) => app.updateSettings({ shortBreakMinutes })}
          />
          <Stepper
            label="Goal"
            value={state.settings.dailyGoalMinutes}
            min={15}
            max={480}
            step={15}
            onChange={(dailyGoalMinutes) => app.updateSettings({ dailyGoalMinutes })}
          />
        </div>
      </section>

      <section className="pulse">
        <div>
          <span>Today</span>
          <strong>{formatMinutes(app.todaySeconds)}</strong>
        </div>
        <div>
          <span>Streak</span>
          <strong>{state.streak}d</strong>
        </div>
        <div className="bars" aria-label="Last 7 days">
          {app.weekKeys.map((key) => {
            const seconds = state.days[key]?.seconds ?? 0
            return (
              <i
                key={key}
                title={`${weekdayLabel(key)} · ${formatMinutes(seconds)}`}
                style={{ height: `${Math.max(4, (seconds / maxWeek) * 28)}px` }}
              />
            )
          })}
        </div>
      </section>

      <section className="tasks">
        <form onSubmit={onAdd}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add a task"
            aria-label="New task"
          />
          <button className="sr" type="submit">
            Add
          </button>
        </form>
        <ul>
          {state.tasks.map((task) => (
            <li key={task.id} className={task.id === state.activeTaskId ? 'active' : undefined}>
              <button
                className={task.done ? 'check on' : 'check'}
                type="button"
                aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
                onClick={() => app.toggleTask(task.id)}
              />
              <button type="button" className="name" onClick={() => app.selectTask(task.id)}>
                <span className={task.done ? 'done' : undefined}>{task.title}</span>
              </button>
              <button className="remove" type="button" onClick={() => app.removeTask(task.id)} aria-label="Delete">
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
