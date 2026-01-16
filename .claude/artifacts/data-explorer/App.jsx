function App() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRows, setSelectedRows] = useState([])

  const products = [
    { id: 1, name: "MacBook Pro 14\"", category: "Laptops", price: 1999, stock: 45, status: "In Stock" },
    { id: 2, name: "iPhone 15 Pro", category: "Phones", price: 999, stock: 128, status: "In Stock" },
    { id: 3, name: "AirPods Pro", category: "Audio", price: 249, stock: 0, status: "Out of Stock" },
    { id: 4, name: "iPad Air", category: "Tablets", price: 599, stock: 67, status: "In Stock" },
    { id: 5, name: "Apple Watch Ultra", category: "Wearables", price: 799, stock: 23, status: "Low Stock" },
    { id: 6, name: "Mac Mini M2", category: "Desktops", price: 599, stock: 89, status: "In Stock" },
    { id: 7, name: "Studio Display", category: "Monitors", price: 1599, stock: 12, status: "Low Stock" },
    { id: 8, name: "Magic Keyboard", category: "Accessories", price: 99, stock: 234, status: "In Stock" },
    { id: 9, name: "HomePod Mini", category: "Audio", price: 99, stock: 0, status: "Out of Stock" },
    { id: 10, name: "AirTag 4-Pack", category: "Accessories", price: 99, stock: 567, status: "In Stock" }
  ]

  const filteredProducts = products.filter(p =>
    !searchQuery ||
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleRow = (id) => {
    setSelectedRows(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    if (selectedRows.length === filteredProducts.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(filteredProducts.map(p => p.id))
    }
  }

  const handleRowClick = (product) => {
    window.canvasEmit("product-clicked", product)
  }

  const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0)
  const outOfStock = products.filter(p => p.stock === 0).length
  const lowStock = products.filter(p => p.stock > 0 && p.stock < 25).length

  const statusColors = {
    "In Stock": "bg-green-900 text-green-300",
    "Low Stock": "bg-yellow-900 text-yellow-300",
    "Out of Stock": "bg-red-900 text-red-300"
  }

  return (
    <div className="p-6 min-h-screen bg-background">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-foreground" style={{ wordSpacing: '0.25em' }}>Data Explorer</h1>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Products</p>
              <p className="text-2xl font-bold">{products.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Inventory Value</p>
              <p className="text-2xl font-bold">${(totalValue / 1000).toFixed(0)}k</p>
            </CardContent>
          </Card>
          <Card className={outOfStock > 0 ? "border-red-200" : ""}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Out of Stock</p>
              <p className="text-2xl font-bold">{outOfStock}</p>
            </CardContent>
          </Card>
          <Card className={lowStock > 0 ? "border-yellow-200" : ""}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Low Stock</p>
              <p className="text-2xl font-bold">{lowStock}</p>
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>Product Inventory</CardTitle>
            <CardDescription>Search, select, and manage products</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Search and Actions */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search products..."
                  className="w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {selectedRows.length > 0 && (
                  <span className="px-2 py-1 text-xs bg-muted rounded-full">
                    {selectedRows.length} selected
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {selectedRows.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.canvasEmit("bulk-action", { ids: selectedRows })}
                  >
                    Bulk Action ({selectedRows.length})
                  </Button>
                )}
                <Button size="sm" onClick={() => window.canvasEmit("add-product", {})}>
                  + Add Product
                </Button>
              </div>
            </div>

            {/* Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={filteredProducts.length > 0 && selectedRows.length === filteredProducts.length}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-muted-foreground"
                    />
                  </TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No products found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow
                      key={product.id}
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => handleRowClick(product)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(product.id)}
                          onChange={() => toggleRow(product.id)}
                          className="h-4 w-4 rounded border-muted-foreground"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>${product.price.toLocaleString()}</TableCell>
                      <TableCell className={product.stock === 0 ? "text-red-400" : product.stock < 25 ? "text-yellow-400" : ""}>
                        {product.stock}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded-full ${statusColors[product.status]}`}>
                          {product.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.canvasEmit("edit-product", product)}
                        >
                          ✎
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500"
                          onClick={() => window.canvasEmit("delete-product", product)}
                        >
                          ✕
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filteredProducts.length} of {products.length} products
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-xl mb-2">🔍</p>
              <p className="text-sm font-medium">Search</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-xl mb-2">☑️</p>
              <p className="text-sm font-medium">Selection</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-xl mb-2">🎨</p>
              <p className="text-sm font-medium">Custom Render</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-xl mb-2">👆</p>
              <p className="text-sm font-medium">Row Actions</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
