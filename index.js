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
  