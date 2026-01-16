function App() {
  const [state, setState] = useCanvasState()

  // Initialize default state if empty
  const tasks = state.tasks || [
    { id: 1, title: "Design homepage mockup", current: 8, max: 10 },
    { id: 2, title: "Write API documentation", current: 3, max: 5 },
    { id: 3, title: "Review pull requests", current: 12, max: 15 },
    { id: 4, title: "Set up CI/CD pipeline", current: 2, max: 8 },
    { id: 5, title: "User testing sessions", current: 0, max: 6 }
  ]

  const completedCount = tasks.filter(t => t.current >= t.max).length
  const inProgressCount = tasks.filter(t => t.current > 0 && t.current < t.max).length
  const totalProgress = tasks.reduce((acc, t) => acc + (t.current / t.max), 0) / tasks.length * 100

  const updateTask = (taskId, increment) => {
    const newTasks = tasks.map(t => {
      if (t.id === taskId) {
        const newCurrent = Math.max(0, Math.min(t.max, t.current + increment))
        return { ...t, current: newCurrent }
      }
      return t
    })
    setState({ ...state, tasks: newTasks })
  }

  const addTask = () => {
    const title = `New Task ${tasks.length + 1}`
    const newTask = { id: Date.now(), title, current: 0, max: 5 }
    setState({ ...state, tasks: [...tasks, newTask] })
  }

  const removeTask = (taskId) => {
    setState({ ...state, tasks: tasks.filter(t => t.id !== taskId) })
  }

  return (
    <div className="p-6 min-h-screen bg-background">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-foreground" style={{ wordSpacing: '0.25em' }}>Task Manager</h1>
          <Button onClick={addTask}>+ Add Task</Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Overall Progress</p>
              <p className="text-2xl font-bold">{Math.round(totalProgress)}%</p>
              <p className="text-sm text-muted-foreground">Across all tasks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-2xl font-bold">{inProgressCount}</p>
              <p className="text-sm text-muted-foreground">Active tasks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold">{completedCount}</p>
              <p className="text-sm text-muted-foreground">Finished tasks</p>
            </CardContent>
          </Card>
        </div>

        {/* Task List */}
        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
            <CardDescription>Click +/- to update progress. State syncs with _state.json</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {tasks.map((task) => {
                const percentage = (task.current / task.max) * 100
                const isComplete = task.current >= task.max

                return (
                  <div key={task.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${
                          isComplete ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground"
                        }`}>
                          {isComplete && "✓"}
                        </span>
                        <span className={isComplete ? "line-through text-muted-foreground" : ""}>
                          {task.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-16 text-right">
                          {task.current} / {task.max}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateTask(task.id, -1)}
                          disabled={task.current <= 0}
                        >
                          −
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateTask(task.id, 1)}
                          disabled={task.current >= task.max}
                        >
                          +
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTask(task.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕
                        </Button>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isComplete ? "bg-green-500" : "bg-blue-600"
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              <strong>Two-way state sync:</strong> This demo uses <code className="bg-muted px-1 rounded">useCanvasState()</code> for
              bidirectional communication. The agent can read/write <code className="bg-muted px-1 rounded">_state.json</code> to
              update tasks programmatically.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
