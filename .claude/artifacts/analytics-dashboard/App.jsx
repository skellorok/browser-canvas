function App() {
  const revenueData = [
    { month: "Jan", revenue: 4000, orders: 240 },
    { month: "Feb", revenue: 3000, orders: 198 },
    { month: "Mar", revenue: 5000, orders: 305 },
    { month: "Apr", revenue: 4500, orders: 278 },
    { month: "May", revenue: 6000, orders: 389 },
    { month: "Jun", revenue: 5500, orders: 342 }
  ]

  const trafficData = [
    { source: "Direct", value: 4000 },
    { source: "Search", value: 3000 },
    { source: "Social", value: 2000 },
    { source: "Referral", value: 1500 }
  ]

  const stats = [
    { title: "Total Revenue", value: "$45,231", change: "+20.1%", up: true },
    { title: "Orders", value: "1,752", change: "+12.5%", up: true },
    { title: "Customers", value: "8,549", change: "+8.2%", up: true },
    { title: "Conversion", value: "3.2%", change: "-0.4%", up: false }
  ]

  return (
    <div className="p-6 min-h-screen bg-background">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-foreground" style={{ wordSpacing: '0.25em' }}>Analytics Dashboard</h1>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, i) => (
            <Card key={i} className="cursor-pointer hover:shadow-md">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
                <p className={`text-sm mt-1 ${stat.up ? "text-green-500" : "text-red-400"}`}>
                  {stat.change} from last period
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Over Time</CardTitle>
              <CardDescription>Monthly revenue and order trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} name="Revenue ($)" />
                  <Area type="monotone" dataKey="orders" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} name="Orders" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Traffic Sources</CardTitle>
              <CardDescription>Where your visitors come from</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={trafficData}
                    dataKey="value"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {trafficData.map((entry, index) => (
                      <Cell key={index} fill={["#8884d8", "#82ca9d", "#ffc658", "#ff7300"][index]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Comparison</CardTitle>
              <CardDescription>Revenue by month</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="revenue" fill="#8884d8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest customer actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { user: "Sarah Chen", action: "placed order #1234", time: "2 min ago" },
                  { user: "Mike Johnson", action: "completed checkout", time: "5 min ago" },
                  { user: "Emily Davis", action: "subscribed to Pro plan", time: "12 min ago" },
                  { user: "Alex Kim", action: "left a 5-star review", time: "18 min ago" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-2 hover:bg-muted rounded-lg cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium text-sm">
                      {item.user.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{item.user}</span> {item.action}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
// refreshed Thu Jan  8 18:23:17 CST 2026
