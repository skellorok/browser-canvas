function App() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    department: "",
    message: ""
  })
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [submissions, setSubmissions] = useState([])

  const validate = () => {
    const newErrors = {}
    if (!formData.name.trim()) newErrors.name = "Name is required"
    if (!formData.email.trim()) newErrors.email = "Email is required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email"
    }
    if (!formData.message.trim()) newErrors.message = "Message is required"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) {
      const data = { ...formData, timestamp: new Date().toISOString() }
      setSubmissions(prev => [data, ...prev])
      window.canvasEmit("contact-submitted", data)
      setSubmitted(true)
    }
  }

  const handleReset = () => {
    setFormData({ name: "", email: "", department: "", message: "" })
    setErrors({})
    setSubmitted(false)
  }

  const handleChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  return (
    <div className="p-6 min-h-screen bg-background">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center text-foreground" style={{ wordSpacing: '0.25em' }}>Contact Form Demo</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Get in Touch</CardTitle>
              <CardDescription>Fill out the form and we'll respond within 24 hours.</CardDescription>
            </CardHeader>
            {submitted ? (
              <CardContent>
                <div className="p-4 bg-green-50 border border-green-200 rounded-md mb-4">
                  <p className="text-green-800">✓ Thanks! We'll be in touch soon.</p>
                </div>
                <Button onClick={handleReset} variant="outline" className="w-full">
                  Submit Another
                </Button>
              </CardContent>
            ) : (
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={handleChange("name")}
                      className={errors.name ? "border-red-500" : ""}
                    />
                    {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={handleChange("email")}
                      className={errors.email ? "border-red-500" : ""}
                    />
                    {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <select
                      id="department"
                      value={formData.department}
                      onChange={handleChange("department")}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Select department</option>
                      <option value="sales">Sales</option>
                      <option value="support">Support</option>
                      <option value="billing">Billing</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message *</Label>
                    <textarea
                      id="message"
                      placeholder="How can we help you today?"
                      value={formData.message}
                      onChange={handleChange("message")}
                      rows={4}
                      className={cn(
                        "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                        errors.message && "border-red-500"
                      )}
                    />
                    {errors.message && <p className="text-sm text-red-500">{errors.message}</p>}
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button type="button" variant="outline" onClick={handleReset}>
                    Clear
                  </Button>
                  <Button type="submit" className="flex-1">
                    Send Message
                  </Button>
                </CardFooter>
              </form>
            )}
          </Card>

          {/* Submissions Log */}
          <Card>
            <CardHeader>
              <CardTitle>Submissions</CardTitle>
              <CardDescription>Form data is captured via events.jsonl</CardDescription>
            </CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-4xl mb-2">📬</p>
                  <p>No submissions yet</p>
                  <p className="text-sm">Fill out the form to see data here</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {submissions.map((sub, i) => (
                    <div key={i} className="p-3 bg-muted rounded-lg text-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium">{sub.name}</span>
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                          {sub.department || "general"}
                        </span>
                      </div>
                      <p className="text-muted-foreground mb-1">{sub.email}</p>
                      <p className="text-muted-foreground text-xs">
                        {new Date(sub.timestamp).toLocaleTimeString()}
                      </p>
                      <p className="mt-2 text-foreground line-clamp-2">{sub.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-2xl mb-2">🛡️</p>
              <p className="font-medium">Validation</p>
              <p className="text-sm text-muted-foreground">Email, required fields</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-2xl mb-2">⚡</p>
              <p className="font-medium">Event Capture</p>
              <p className="text-sm text-muted-foreground">Data logged to events.jsonl</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-2xl mb-2">⚙️</p>
              <p className="font-medium">Customizable</p>
              <p className="text-sm text-muted-foreground">Flexible field definitions</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
