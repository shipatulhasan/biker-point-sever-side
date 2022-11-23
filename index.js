const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()
const jwt = require('jsonwebtoken')

const app = express()
const port = process.env.PORT || 5000

// middlewares
app.use(cors())
app.use(express.json())


// Database Connection
const uri = process.env.DB_URI
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
})


app.get('/', (req, res) => {
    res.send('Hello bubu from node')
  })
  
  app.listen(port, () => {
    console.log(`Server is running...on ${port}`)
  })
  