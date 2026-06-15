const url = 'https://hjhqemsyufsifmgespur.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqaHFlbXN5dWZzaWZtZ2VzcHVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5OTYzMDksImV4cCI6MjA5NjU3MjMwOX0.C3q3hCrcbdKxDmvCpEzAZ4sO3AKXXdfAVE6fq4E7M_g'

async function run() {
  console.log('Connecting to:', url)

  // 1. Authenticate via Auth REST API
  console.log('Authenticating via REST API...')
  const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'admin@mei.com',
      password: 'MeiAdmin@123'
    })
  })

  if (!authRes.ok) {
    console.error('Authentication failed:', authRes.status, await authRes.text())
    return
  }

  const authData = await authRes.json()
  const token = authData.access_token
  console.log('Authenticated successfully, got token!')

  // 2. Get Categories
  const catRes = await fetch(`${url}/rest/v1/categories?deleted_at=is.null`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${token}`
    }
  })

  if (!catRes.ok) {
    console.error('Failed to get categories:', await catRes.text())
    return
  }

  const categories: any = await catRes.json()
  console.log('Categories found:', categories?.length)
  if (!categories || categories.length === 0) {
    console.log('No categories found!')
    return
  }

  // 3. Try inserting a product to see the database error
  const testProduct = {
    name: 'Scratch Test Product',
    slug: 'scratch-test-product-' + Date.now(),
    category_id: categories[0].id,
    price: 99.99,
    status: 'DRAFT',
    work_types: ['ZARDOZI'],
    description: 'Testing insert from scratch script under admin auth'
  }

  console.log('Attempting to insert test product under admin JWT:', testProduct)
  const insRes = await fetch(`${url}/rest/v1/products`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(testProduct)
  })

  if (!insRes.ok) {
    console.error('INSERT ERROR:', insRes.status, await insRes.text())
  } else {
    const data = await insRes.json()
    console.log('INSERT SUCCESS:', data)
    
    // Clean up
    const delRes = await fetch(`${url}/rest/v1/products?id=eq.${data[0].id}`, {
      method: 'DELETE',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${token}`
      }
    })
    console.log('Cleanup result:', delRes.ok ? 'Success' : 'Failed: ' + await delRes.text())
  }
}

run().catch(console.error)
