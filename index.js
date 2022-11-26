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


const run = async()=>{

  const usersCollection = client.db('bikerDb').collection("users")
  const categoriesCollection = client.db('bikerDb').collection("categories")
  const productsCollection = client.db('bikerDb').collection("products")


  try{


    // user api
    app.put('/user/:email',async(req,res)=>{
      const email = req.params.email
      const user = req.body
      const filter = {email:email}
      const options = { upsert: true };
      const updateDoc = {
        $set:user
      }
      const result = await usersCollection.updateOne(filter, updateDoc, options)
      const token = jwt.sign(user,process.env.ACCESS_TOKEN,{expiresIn:'1d'})
      res.send({result,token})
    })

    // get users
    app.get('/user/:email',async(req,res)=>{
      const email = req.params.email
      const filter = {email:email}
      const result = await usersCollection.findOne(filter)
      res.send(result)
    })


    // get category
    app.get('/categories',async(req,res)=>{
      const result = await categoriesCollection.find({}).toArray()
      res.send(result)
    })

    // products 

    app.post('/product',async(req,res)=>{
      const proudct = req.body
      const result = await productsCollection.insertOne(proudct)
      res.send(result)
    })

    // categories product
    app.get('/category/:id',async(req,res)=>{
      const id = req.params.id
      const query = {_id:ObjectId(id)}
      const product = await categoriesCollection.findOne(query) 
      const filter = {category:product.name}
      const result = await productsCollection.find(filter).toArray()
      res.send(result)
    })

    // seller's products
    app.get('/product',async(req,res)=>{
      const email = req.query.email
      const filter = {'seller.email':email}
      const result = await productsCollection.find(filter).toArray()
      res.send(result)
    })
    // seller's delete product
    app.delete('/product/:id',async(req,res)=>{
      const id = req.params.id
      const filter = {_id:ObjectId(id)}
      const result = await productsCollection.deleteOne(filter)
      res.send(result)
    })



  }
  finally{

  }

}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Hello bubu from node')
  })
  
  app.listen(port, () => {
    console.log(`Server is running...on ${port}`)
  })
  